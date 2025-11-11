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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coordinates } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Pelo menos 2 coordenadas são necessárias');
    }

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    console.log(`🗺️  Otimizando rota Mapbox com ${coordinates.length} pontos`);

    // Construir string de coordenadas: lon,lat;lon,lat;...
    const coordsString = coordinates
      .map((c: Coordinate) => `${c.longitude},${c.latitude}`)
      .join(';');

    // Usar Mapbox Optimization API (max 12 waypoints no tier gratuito)
    // Para mais de 12, usar Directions API sem otimização automática
    const useOptimization = coordinates.length <= 12;
    
    let mapboxUrl: string;
    
    if (useOptimization) {
      // Optimization API - reordena os waypoints para rota mais eficiente
      mapboxUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&language=pt-BR`;
    } else {
      // Directions API - ordem fixa dos waypoints
      mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&language=pt-BR`;
    }

    const mapboxResponse = await fetch(mapboxUrl);

    if (!mapboxResponse.ok) {
      const errorText = await mapboxResponse.text();
      console.error('Mapbox error:', mapboxResponse.status, errorText);
      throw new Error(`Mapbox API error: ${mapboxResponse.status}`);
    }

    const data = await mapboxResponse.json();

    if (data.code !== 'Ok' || !data.trips?.[0] && !data.routes?.[0]) {
      throw new Error('Mapbox não encontrou rota válida');
    }

    // Optimization retorna 'trips', Directions retorna 'routes'
    const route = data.trips?.[0] || data.routes?.[0];

    // Se usou optimization, pegar a ordem otimizada dos waypoints
    let optimizedOrder = coordinates.map((c: Coordinate, i: number) => ({
      id: c.id,
      order: i + 1
    }));

    if (useOptimization && data.waypoints) {
      // Mapbox retorna waypoints_index indicando a ordem otimizada
      optimizedOrder = data.waypoints
        .filter((wp: any) => wp.waypoint_index !== undefined)
        .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index)
        .map((wp: any, i: number) => ({
          id: coordinates[wp.waypoint_index].id,
          order: i + 1
        }));
    }

    const result = {
      success: true,
      route: {
        distance: route.distance, // metros
        duration: route.duration, // segundos
        distanceKm: (route.distance / 1000).toFixed(1),
        durationMinutes: Math.round(route.duration / 60),
        durationFormatted: formatDuration(route.duration),
        geometry: route.geometry?.coordinates || [] // [lon, lat] pairs
      },
      waypoints: data.waypoints || [],
      optimizedOrder,
      optimizationUsed: useOptimization
    };

    console.log(`✅ Rota otimizada: ${result.route.distanceKm} km, ${result.route.durationFormatted}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro ao otimizar rota:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        fallback: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Retorna 200 para permitir fallback no client
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
