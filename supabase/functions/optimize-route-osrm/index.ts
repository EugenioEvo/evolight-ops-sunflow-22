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

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry?: {
    coordinates: [number, number][];
  };
}

interface OSRMResponse {
  code: string;
  routes?: OSRMRoute[];
  waypoints?: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coordinates } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Pelo menos 2 coordenadas são necessárias para otimização');
    }

    console.log(`Otimizando rota com ${coordinates.length} pontos`);

    // Construir string de coordenadas para OSRM (lon,lat format)
    const coordsString = coordinates
      .map((coord: Coordinate) => `${coord.longitude},${coord.latitude}`)
      .join(';');

    // Chamar API do OSRM (servidor público)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=false`;
    
    console.log('Chamando OSRM:', osrmUrl.substring(0, 100) + '...');

    const osrmResponse = await fetch(osrmUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Lovable-Route-Optimizer/1.0'
      }
    });

    if (!osrmResponse.ok) {
      throw new Error(`OSRM API error: ${osrmResponse.status}`);
    }

    const data: OSRMResponse = await osrmResponse.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM não encontrou rota válida');
    }

    const route = data.routes[0];

    // Retornar rota otimizada
    const result = {
      success: true,
      route: {
        distance: route.distance, // metros
        duration: route.duration, // segundos
        distanceKm: (route.distance / 1000).toFixed(1),
        durationMinutes: Math.round(route.duration / 60),
        durationFormatted: formatDuration(route.duration),
        geometry: route.geometry?.coordinates || []
      },
      waypoints: data.waypoints || [],
      optimizedOrder: coordinates.map((c: Coordinate, i: number) => ({
        id: c.id,
        order: i + 1
      }))
    };

    console.log(`Rota otimizada: ${result.route.distanceKm} km, ${result.route.durationFormatted}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao otimizar rota:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        fallback: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Retorna 200 para indicar fallback
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
