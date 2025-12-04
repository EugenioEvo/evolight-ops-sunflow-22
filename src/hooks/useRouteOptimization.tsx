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
}

interface OptimizeContext {
  tecnicoId?: string;
  dataRota?: string;
}

type Provider = 'mapbox' | 'osrm' | 'local';

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
    
    try {
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

      let data: any, error: any, provider: Provider = 'local';
      
      // Tentar Mapbox primeiro
      try {
        const mapboxResult = await supabase.functions.invoke('mapbox-directions', {
          body: { coordinates }
        });
        data = mapboxResult.data;
        error = mapboxResult.error;

        // Validação de token Mapbox
        if (data && data.success === false && String(data.error || '').includes('MAPBOX_ACCESS_TOKEN')) {
          toast.warning('Token Mapbox não configurado. Usando OSRM/Local.');
        }
      } catch {
        // Mapbox falhou, tentar OSRM
      }

      // Se Mapbox não funcionou, tentar OSRM
      if (!data || !data.success || data.fallback) {
        try {
          const osrmResult = await supabase.functions.invoke('optimize-route-osrm', {
            body: { coordinates }
          });
          data = osrmResult.data;
          error = osrmResult.error;
        } catch {
          // OSRM também falhou
        }
      }

      if (error) {
        throw error;
      }

      // Se APIs falharam, usar algoritmo local
      if (!data || !data.success || data.fallback) {
        toast.warning('Usando otimização local (APIs indisponíveis)');
        
        const localOptimized = optimizeRouteAdvanced(tickets);
        setOptimizedRoute({ success: true, fallback: true });
        provider = 'local';

        return {
          tickets: localOptimized,
          provider,
          data: null
        };
      }

      // Determinar provedor usado
      provider = data.optimizationUsed ? 'mapbox' : (data.route?.geometry ? 'osrm' : 'local');
      
      setOptimizedRoute(data);
      
      toast.success(
        `Rota otimizada: ${data.route.distanceKm} km, ${data.route.durationFormatted}`,
        {
          description: `Usando ${provider === 'mapbox' ? 'Mapbox' : provider === 'osrm' ? 'OSRM' : 'método local'}`
        }
      );

      // Reordenar tickets
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
      try {
        if (ctx.tecnicoId && ctx.dataRota && data.route?.geometry) {
          await supabase.from('route_optimizations').insert({
            tecnico_id: ctx.tecnicoId,
            data_rota: ctx.dataRota,
            geometry: data.route.geometry,
            optimization_method: provider,
            distance_km: Number(data.route.distanceKm),
            duration_minutes: Number(data.route.durationMinutes),
            waypoints_order: data.optimizedOrder || [],
            ticket_ids: reorderedTickets.map(t => (t as any).ticketId || t.id)
          });
        }
      } catch {
        // Não foi possível salvar a rota
      }

      return {
        tickets: reorderedTickets,
        provider,
        data
      };

    } catch {
      toast.error('Erro ao otimizar rota, usando método local');
      
      const localOptimized = optimizeRouteAdvanced(tickets);
      setOptimizedRoute({ success: true, fallback: true });
      
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
