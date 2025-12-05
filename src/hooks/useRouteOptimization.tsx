import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { optimizeRouteAdvanced } from '@/components/RouteOptimization';

interface Ticket {
  id: string;
  coordenadas: [number, number];
  hasRealCoords: boolean;
  prioridade: string;
  dataProgramada?: string;
  tecnicoId?: string;
}

interface OptimizedRoute {
  success: boolean;
  route?: {
    distance: number;
    duration: number;
    distanceKm: string;
    durationMinutes: number;
    durationFormatted: string;
    geometry: [number, number][];
  };
  optimizedOrder?: Array<{ id: string; order: number }>;
  fallback?: boolean;
  provider?: string;
}

interface OptimizeContext {
  tecnicoId?: string;
  dataRota?: string;
}

type Provider = 'mapbox' | 'osrm' | 'local';

// Constantes de configuração
const MAX_MAPBOX_WAYPOINTS = 25; // Mapbox Directions suporta até 25
const MAX_OSRM_WAYPOINTS = 100; // OSRM suporta mais

// Endereço fixo da Evolight como ponto inicial
const EVOLIGHT_START = {
  latitude: -16.6869,
  longitude: -49.2648,
  address: 'Avenida T9 1001, Setor Bueno, Goiânia-GO, CEP 74215-025'
};

export const useRouteOptimization = () => {
  const [loading, setLoading] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);

  const optimizeRoute = async (tickets: Ticket[], ctx: OptimizeContext = {}) => {
    const validTickets = tickets.filter(t => t.hasRealCoords);
    
    if (validTickets.length < 1) {
      toast.error('Necessário pelo menos 1 endereço geocodificado');
      return null;
    }

    setLoading(true);
    const startTime = Date.now();
    
    try {
      // Verificar se temos muitos waypoints
      const totalWaypoints = validTickets.length + 1; // +1 para Evolight
      if (totalWaypoints > MAX_MAPBOX_WAYPOINTS) {
        console.log(`[RouteOpt] ${totalWaypoints} waypoints - acima do limite Mapbox (${MAX_MAPBOX_WAYPOINTS})`);
      }

      const coordinates = [
        {
          id: 'evolight-start',
          latitude: EVOLIGHT_START.latitude,
          longitude: EVOLIGHT_START.longitude,
          prioridade: 'start',
          isStartPoint: true
        },
        ...validTickets.map(t => ({
          id: t.id,
          latitude: t.coordenadas[0],
          longitude: t.coordenadas[1],
          prioridade: t.prioridade,
          dataProgramada: t.dataProgramada
        }))
      ];

      let data: any, provider: Provider = 'local';
      
      // Tentar Mapbox primeiro
      console.log(`[RouteOpt] Tentando Mapbox com ${coordinates.length} coordenadas...`);
      try {
        const mapboxResult = await supabase.functions.invoke('mapbox-directions', {
          body: { coordinates }
        });
        
        if (mapboxResult.error) {
          console.warn('[RouteOpt] Mapbox invoke error:', mapboxResult.error);
        } else if (mapboxResult.data?.success) {
          data = mapboxResult.data;
          provider = 'mapbox';
          console.log(`[RouteOpt] Mapbox OK em ${Date.now() - startTime}ms`);
        } else if (mapboxResult.data?.error?.includes('MAPBOX_ACCESS_TOKEN')) {
          console.warn('[RouteOpt] Token Mapbox não configurado');
          toast.warning('Token Mapbox não configurado. Usando OSRM.');
        } else {
          console.warn('[RouteOpt] Mapbox fallback:', mapboxResult.data?.error);
        }
      } catch (err) {
        console.warn('[RouteOpt] Mapbox exception:', err);
      }

      // Se Mapbox não funcionou, tentar OSRM
      if (!data?.success) {
        console.log('[RouteOpt] Tentando OSRM...');
        try {
          const osrmResult = await supabase.functions.invoke('optimize-route-osrm', {
            body: { coordinates }
          });
          
          if (osrmResult.error) {
            console.warn('[RouteOpt] OSRM invoke error:', osrmResult.error);
          } else if (osrmResult.data?.success) {
            data = osrmResult.data;
            provider = 'osrm';
            console.log(`[RouteOpt] OSRM OK em ${Date.now() - startTime}ms`);
          } else {
            console.warn('[RouteOpt] OSRM fallback:', osrmResult.data?.error);
          }
        } catch (err) {
          console.warn('[RouteOpt] OSRM exception:', err);
        }
      }

      // Se APIs falharam, usar algoritmo local
      if (!data?.success) {
        console.log('[RouteOpt] Usando algoritmo local');
        toast.warning('Usando otimização local (APIs indisponíveis)');
        
        const localOptimized = optimizeRouteAdvanced(tickets);
        setOptimizedRoute({ success: true, fallback: true, provider: 'local' });

        return {
          tickets: localOptimized,
          provider: 'local' as const,
          data: null
        };
      }

      // Atualizar provider baseado na resposta
      provider = data.provider || (data.optimizationUsed ? 'mapbox' : 'osrm');
      
      setOptimizedRoute({ ...data, provider });
      
      const providerLabel = provider === 'mapbox' ? 'Mapbox' : provider === 'osrm' ? 'OSRM' : 'Local';
      toast.success(
        `Rota otimizada: ${data.route.distanceKm} km, ${data.route.durationFormatted}`,
        { description: `Via ${providerLabel}${data.preOrdered ? ' (pré-ordenado)' : ''}` }
      );

      // Reordenar tickets baseado na ordem otimizada
      const orderMap = new Map(
        (data.optimizedOrder || [])
          .filter((o: any) => o.id !== 'evolight-start')
          .map((o: any) => [o.id, o.order])
      );
      
      const reorderedTickets = [...tickets].sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 999;
        const orderB = orderMap.get(b.id) ?? 999;
        return (orderA as number) - (orderB as number);
      });

      // Persistir rota no banco se tivermos contexto
      if (ctx.tecnicoId && ctx.dataRota && data.route?.geometry) {
        try {
          await supabase.from('route_optimizations').upsert({
            tecnico_id: ctx.tecnicoId,
            data_rota: ctx.dataRota,
            geometry: data.route.geometry,
            optimization_method: provider,
            distance_km: Number(data.route.distanceKm),
            duration_minutes: Number(data.route.durationMinutes),
            waypoints_order: data.optimizedOrder || [],
            ticket_ids: reorderedTickets.map(t => (t as any).ticketId || t.id),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tecnico_id,data_rota'
          });
        } catch (err) {
          console.warn('[RouteOpt] Erro ao persistir rota:', err);
        }
      }

      console.log(`[RouteOpt] Completo em ${Date.now() - startTime}ms via ${provider}`);

      return {
        tickets: reorderedTickets,
        provider,
        data
      };

    } catch (err) {
      console.error('[RouteOpt] Erro geral:', err);
      toast.error('Erro ao otimizar rota, usando método local');
      
      const localOptimized = optimizeRouteAdvanced(tickets);
      setOptimizedRoute({ success: true, fallback: true, provider: 'local' });
      
      return {
        tickets: localOptimized,
        provider: 'local' as const,
        data: null
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    optimizeRoute,
    loading,
    optimizedRoute
  };
};
