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

export const useRouteOptimization = () => {
  const [loading, setLoading] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);

  const optimizeRoute = async (tickets: Ticket[]) => {
    // Validar tickets com coordenadas
    const validTickets = tickets.filter(t => t.hasRealCoords);
    
    if (validTickets.length < 2) {
      toast.error('Necessário pelo menos 2 endereços geocodificados');
      return null;
    }

    setLoading(true);
    
    try {
      // Preparar coordenadas para OSRM
      const coordinates = validTickets.map(t => ({
        id: t.id,
        latitude: t.coordenadas[0],
        longitude: t.coordenadas[1],
        prioridade: t.prioridade,
        dataProgramada: t.dataProgramada
      }));

      console.log('Otimizando rota com Mapbox/OSRM para', coordinates.length, 'pontos');

      // Tentar Mapbox primeiro (mais preciso), fallback para OSRM
      let data, error;
      
      try {
        const mapboxResult = await supabase.functions.invoke('mapbox-directions', {
          body: { coordinates }
        });
        data = mapboxResult.data;
        error = mapboxResult.error;
      } catch (mapboxError) {
        console.warn('Mapbox falhou, usando OSRM:', mapboxError);
        const osrmResult = await supabase.functions.invoke('optimize-route-osrm', {
          body: { coordinates }
        });
        data = osrmResult.data;
        error = osrmResult.error;
      }

      if (error) {
        console.error('Erro ao chamar API de rotas:', error);
        throw error;
      }

      // Se API falhou, usar algoritmo local (fallback)
      if (!data.success || data.fallback) {
        console.warn('APIs externas falharam, usando algoritmo local');
        toast.warning('Usando otimização local (APIs indisponíveis)');
        
        // Usar algoritmo existente
        const localOptimized = optimizeRouteAdvanced(tickets);
        
        setOptimizedRoute({
          success: true,
          fallback: true,
          optimizedOrder: localOptimized.map((t, i) => ({
            id: t.id,
            order: i + 1
          }))
        });

        return localOptimized;
      }

      // Sucesso com API externa
      console.log('Rota otimizada com sucesso:', data.route);
      
      setOptimizedRoute(data);

      const provider = data.optimizationUsed ? 'Mapbox' : (data.route.geometry ? 'OSRM' : 'Local');
      
      toast.success(
        `Rota otimizada: ${data.route.distanceKm} km, ${data.route.durationFormatted}`,
        {
          description: `Usando ${provider} com dados reais de tráfego`
        }
      );

      // Reordenar tickets baseado na ordem otimizada
      const orderMap = new Map(data.optimizedOrder.map((o: any) => [o.id, o.order]));
      const reorderedTickets = [...tickets].sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 999;
        const orderB = orderMap.get(b.id) ?? 999;
        return (orderA as number) - (orderB as number);
      });

      return reorderedTickets;

    } catch (error) {
      console.error('Erro na otimização:', error);
      toast.error('Erro ao otimizar rota, usando método local');
      
      // Fallback para algoritmo local
      const localOptimized = optimizeRouteAdvanced(tickets);
      
      setOptimizedRoute({
        success: true,
        fallback: true
      });

      return localOptimized;
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
