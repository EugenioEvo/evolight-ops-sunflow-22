import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Coordinate {
  latitude: number;
  longitude: number;
  id: string;
  prioridade?: string;
  dataProgramada?: string;
  isStartPoint?: boolean;
}

// Haversine distance para ordenação local
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest neighbor para pré-ordenar pontos quando há muitos waypoints
function nearestNeighborOrder(coords: Coordinate[]): Coordinate[] {
  if (coords.length <= 2) return coords;
  
  const startPoint = coords.find(c => c.isStartPoint);
  const others = coords.filter(c => !c.isStartPoint);
  
  if (!startPoint || others.length === 0) return coords;
  
  const ordered: Coordinate[] = [startPoint];
  const remaining = [...others];
  
  let current = startPoint;
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        current.latitude, current.longitude,
        remaining[i].latitude, remaining[i].longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    current = remaining[nearestIdx];
    ordered.push(current);
    remaining.splice(nearestIdx, 1);
  }
  
  return ordered;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { coordinates } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Pelo menos 2 coordenadas são necessárias');
    }

    const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_ACCESS_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    console.log(`🗺️ [Mapbox] Otimizando rota com ${coordinates.length} pontos`);

    // Identificar ponto inicial
    const startPoint = coordinates.find((c: Coordinate) => c.isStartPoint);
    const otherPoints = coordinates.filter((c: Coordinate) => !c.isStartPoint);
    
    let orderedCoords: Coordinate[];
    let mapboxUrl: string;
    let useOptimizationApi = false;
    
    if (coordinates.length <= 12) {
      // Use Optimization API for up to 12 waypoints (supports reordering)
      orderedCoords = startPoint ? [startPoint, ...otherPoints] : coordinates;
      const coordString = orderedCoords
        .map((c: Coordinate) => `${c.longitude},${c.latitude}`)
        .join(';');
      
      mapboxUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordString}?source=first&access_token=${MAPBOX_ACCESS_TOKEN}&steps=true&geometries=geojson&overview=full`;
      useOptimizationApi = true;
      console.log(`📍 [Mapbox] Usando Optimization API (${coordinates.length} pontos)`);
    } else {
      // For >12 waypoints: pre-order with nearest neighbor, then use Directions API
      console.log(`📍 [Mapbox] >12 pontos: aplicando nearest neighbor antes de Directions API`);
      orderedCoords = nearestNeighborOrder(coordinates);
      
      const coordString = orderedCoords
        .map((c: Coordinate) => `${c.longitude},${c.latitude}`)
        .join(';');
      
      mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}?access_token=${MAPBOX_ACCESS_TOKEN}&steps=true&geometries=geojson&overview=full`;
    }

    const response = await fetch(mapboxUrl);
    const mapboxData = await response.json();

    if (mapboxData.code !== 'Ok') {
      console.error(`❌ [Mapbox] API error: ${mapboxData.message}`);
      throw new Error(`Mapbox API error: ${mapboxData.message || 'Unknown error'}`);
    }

    // Mapbox Optimization API returns 'trips', Directions returns 'routes'
    const route = mapboxData.trips?.[0] || mapboxData.routes?.[0];

    if (!route) {
      throw new Error('No route found');
    }

    // Build optimized order
    let optimizedOrder: Array<{ id: string; order: number }>;
    
    if (useOptimizationApi && mapboxData.waypoints) {
      // Optimization API provides waypoint_index for reordering
      optimizedOrder = mapboxData.waypoints.map((wp: any, idx: number) => ({
        id: orderedCoords[wp.waypoint_index]?.id || `unknown-${idx}`,
        order: idx + 1
      }));
    } else {
      // Directions API: use the pre-ordered sequence
      optimizedOrder = orderedCoords.map((c: Coordinate, i: number) => ({ 
        id: c.id, 
        order: i + 1 
      }));
    }

    const result = {
      success: true,
      route: {
        distance: route.distance,
        duration: route.duration,
        distanceKm: (route.distance / 1000).toFixed(1),
        durationMinutes: Math.round(route.duration / 60),
        durationFormatted: formatDuration(route.duration),
        geometry: route.geometry?.coordinates || []
      },
      optimizedOrder,
      optimizationUsed: useOptimizationApi,
      provider: 'mapbox',
      preOrdered: !useOptimizationApi
    };

    const elapsed = Date.now() - startTime;
    console.log(`✅ [Mapbox] Rota otimizada em ${elapsed}ms: ${result.route.distanceKm} km, ${result.route.durationFormatted}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [Mapbox] Erro após ${elapsed}ms:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'mapbox'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}
