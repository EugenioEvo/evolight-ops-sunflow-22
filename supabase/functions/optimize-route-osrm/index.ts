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

interface OSRMTrip {
  distance: number;
  duration: number;
  geometry?: {
    coordinates: [number, number][];
  };
}

interface OSRMTripResponse {
  code: string;
  trips?: OSRMTrip[];
  waypoints?: Array<{
    waypoint_index: number;
    trips_index: number;
    location: [number, number];
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { coordinates } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Pelo menos 2 coordenadas são necessárias para otimização');
    }

    console.log(`🚀 [OSRM] Otimizando rota com ${coordinates.length} pontos`);

    // Identificar ponto inicial (Evolight)
    const startPoint = coordinates.find((c: Coordinate) => c.isStartPoint);
    const otherPoints = coordinates.filter((c: Coordinate) => !c.isStartPoint);
    const orderedCoords = startPoint ? [startPoint, ...otherPoints] : coordinates;

    // Construir string de coordenadas para OSRM (lon,lat format)
    const coordsString = orderedCoords
      .map((coord: Coordinate) => `${coord.longitude},${coord.latitude}`)
      .join(';');

    // Usar OSRM Trip API para reordenação otimizada
    // source=first: manter primeiro ponto fixo (Evolight)
    // roundtrip=false: não voltar ao início
    const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsString}?source=first&roundtrip=false&overview=full&geometries=geojson&steps=false`;
    
    console.log(`📍 [OSRM] URL: ${osrmUrl.substring(0, 80)}...`);

    const osrmResponse = await fetch(osrmUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Evolight-Route-Optimizer/1.0'
      }
    });

    if (!osrmResponse.ok) {
      console.error(`❌ [OSRM] HTTP error: ${osrmResponse.status}`);
      throw new Error(`OSRM API error: ${osrmResponse.status}`);
    }

    const data: OSRMTripResponse = await osrmResponse.json();

    if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
      console.error(`❌ [OSRM] Invalid response: ${data.code}`);
      throw new Error('OSRM não encontrou rota válida');
    }

    const trip = data.trips[0];

    // Extrair ordem otimizada dos waypoints
    const optimizedOrder = data.waypoints 
      ? data.waypoints.map((wp, idx) => ({
          id: orderedCoords[wp.waypoint_index]?.id || `unknown-${idx}`,
          order: idx + 1,
          originalIndex: wp.waypoint_index
        }))
      : orderedCoords.map((c: Coordinate, i: number) => ({
          id: c.id,
          order: i + 1,
          originalIndex: i
        }));

    const result = {
      success: true,
      route: {
        distance: trip.distance,
        duration: trip.duration,
        distanceKm: (trip.distance / 1000).toFixed(1),
        durationMinutes: Math.round(trip.duration / 60),
        durationFormatted: formatDuration(trip.duration),
        geometry: trip.geometry?.coordinates || []
      },
      waypoints: data.waypoints || [],
      optimizedOrder,
      provider: 'osrm',
      reordered: true
    };

    const elapsed = Date.now() - startTime;
    console.log(`✅ [OSRM] Rota otimizada em ${elapsed}ms: ${result.route.distanceKm} km, ${result.route.durationFormatted}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [OSRM] Erro após ${elapsed}ms:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        fallback: true,
        provider: 'osrm'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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
