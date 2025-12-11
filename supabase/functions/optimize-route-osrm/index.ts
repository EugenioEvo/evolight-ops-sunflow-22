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

// Lista de servidores OSRM com fallback
const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
];

// Função para fazer requisição com retry e backoff exponencial
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Se recebeu 429 (rate limit), espera e tenta novamente
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`⏳ [OSRM] Rate limited, aguardando ${delay}ms antes de retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Se resposta OK ou erro diferente de rate limit, retorna
      return response;
    } catch (err) {
      lastError = err as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`⚠️ [OSRM] Tentativa ${attempt + 1} falhou: ${err}. Retry em ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Função para tentar múltiplos servidores
async function tryOSRMServers(
  coordsString: string,
  startTime: number
): Promise<{ data: OSRMTripResponse; server: string }> {
  let lastError: Error | null = null;
  
  for (const server of OSRM_SERVERS) {
    const osrmUrl = `${server}/trip/v1/driving/${coordsString}?source=first&roundtrip=false&overview=full&geometries=geojson&steps=false`;
    
    console.log(`📍 [OSRM] Tentando servidor: ${server}`);
    
    try {
      const response = await fetchWithRetry(osrmUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Evolight-Route-Optimizer/1.0'
        }
      }, 2, 500); // 2 retries, 500ms base delay
      
      if (!response.ok) {
        console.warn(`❌ [OSRM] ${server} retornou HTTP ${response.status}`);
        continue;
      }
      
      const data: OSRMTripResponse = await response.json();
      
      if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
        console.log(`✅ [OSRM] Sucesso com ${server} em ${Date.now() - startTime}ms`);
        return { data, server };
      }
      
      console.warn(`⚠️ [OSRM] ${server} retornou código: ${data.code}`);
      lastError = new Error(`OSRM code: ${data.code}`);
    } catch (err) {
      console.warn(`❌ [OSRM] Falha no servidor ${server}:`, err);
      lastError = err as Error;
    }
  }
  
  throw lastError || new Error('Todos os servidores OSRM falharam');
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

    console.log(`🚀 [OSRM] Iniciando otimização com ${coordinates.length} pontos`);

    // Validar coordenadas
    const validCoords = coordinates.filter((c: Coordinate) => {
      const isValid = typeof c.latitude === 'number' && 
                      typeof c.longitude === 'number' &&
                      !isNaN(c.latitude) && 
                      !isNaN(c.longitude) &&
                      c.latitude >= -90 && c.latitude <= 90 &&
                      c.longitude >= -180 && c.longitude <= 180;
      
      if (!isValid) {
        console.warn(`⚠️ [OSRM] Coordenada inválida ignorada:`, c);
      }
      return isValid;
    });

    if (validCoords.length < 2) {
      throw new Error(`Apenas ${validCoords.length} coordenadas válidas (mínimo: 2)`);
    }

    console.log(`📊 [OSRM] ${validCoords.length} coordenadas válidas de ${coordinates.length}`);

    // Identificar ponto inicial (Evolight)
    const startPoint = validCoords.find((c: Coordinate) => c.isStartPoint);
    const otherPoints = validCoords.filter((c: Coordinate) => !c.isStartPoint);
    const orderedCoords = startPoint ? [startPoint, ...otherPoints] : validCoords;

    // Construir string de coordenadas para OSRM (lon,lat format)
    const coordsString = orderedCoords
      .map((coord: Coordinate) => `${coord.longitude},${coord.latitude}`)
      .join(';');

    console.log(`📍 [OSRM] Coordenadas: ${coordsString.substring(0, 100)}...`);

    // Tentar servidores OSRM com fallback
    const { data, server } = await tryOSRMServers(coordsString, startTime);
    
    const trip = data.trips![0];

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
      server: server,
      reordered: true,
      validCoords: validCoords.length,
      totalCoords: coordinates.length
    };

    const elapsed = Date.now() - startTime;
    console.log(`✅ [OSRM] Rota otimizada em ${elapsed}ms: ${result.route.distanceKm} km, ${result.route.durationFormatted} via ${server}`);

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
        provider: 'osrm',
        elapsed
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
