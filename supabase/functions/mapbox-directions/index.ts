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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coordinates } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Pelo menos 2 coordenadas são necessárias');
    }

    const MAPBOX_ACCESS_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_ACCESS_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    console.log(`🗺️  Otimizando rota Mapbox com ${coordinates.length} pontos`);

    // Identificar ponto inicial
    const startPoint = coordinates.find((c: Coordinate) => c.isStartPoint);
    const otherPoints = coordinates.filter((c: Coordinate) => !c.isStartPoint);
    
    // Build coordinates string (ponto inicial primeiro)
    const orderedCoords = startPoint ? [startPoint, ...otherPoints] : coordinates;
    const coordString = orderedCoords
      .map((c: Coordinate) => `${c.longitude},${c.latitude}`)
      .join(';');

    // Decide which API to use based on number of waypoints
    let mapboxUrl: string;
    
    if (coordinates.length <= 12) {
      // Use Optimization API for up to 12 waypoints
      // Fixar o primeiro ponto (source=first) para garantir que a rota comece na Evolight
      mapboxUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordString}?source=first&access_token=${MAPBOX_ACCESS_TOKEN}&steps=true&geometries=geojson&overview=full`;
    } else {
      // Use Directions API for more waypoints
      mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}?access_token=${MAPBOX_ACCESS_TOKEN}&steps=true&geometries=geojson&overview=full`;
    }

    const response = await fetch(mapboxUrl);
    const mapboxData = await response.json();

    if (mapboxData.code !== 'Ok') {
      throw new Error(`Mapbox API error: ${mapboxData.message || 'Unknown error'}`);
    }

    // Mapbox Optimization API returns 'trips', Directions returns 'routes'
    const route = mapboxData.trips?.[0] || mapboxData.routes?.[0];

    if (!route) {
      throw new Error('No route found');
    }

    // Format result
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
      // Extract optimized waypoint order if using Optimization API
      optimizedOrder: orderedCoords.map((c: Coordinate, i: number) => ({ id: c.id, order: i + 1 })),
      optimizationUsed: coordinates.length <= 12
    };

    // Extract optimized waypoint order if using Optimization API
    if (coordinates.length <= 12 && mapboxData.waypoints) {
      result.optimizedOrder = mapboxData.waypoints.map((wp: any, idx: number) => ({
        id: orderedCoords[wp.waypoint_index].id,
        order: idx + 1
      }));
    }

    console.log(`✅ Rota otimizada: ${result.route.distanceKm} km, ${result.route.durationFormatted}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Mapbox error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 to allow client-side fallback
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
