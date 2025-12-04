import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações de rate limit
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requisições
const RATE_LIMIT_WINDOW_MINUTES = 1; // por minuto

// Extrair IP do request
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    console.log(`[mapbox-geocode] Request de IP: ${clientIP}`);

    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_geocoding_rate_limit', {
        p_ip: clientIP,
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
      });

    if (rateLimitError) {
      console.error('[mapbox-geocode] Erro ao verificar rate limit:', rateLimitError);
    }

    if (rateLimitOk === false) {
      console.warn(`[mapbox-geocode] Rate limit excedido para IP: ${clientIP}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit excedido. Aguarde um momento antes de tentar novamente.',
        retry_after: 60
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }

    const { address, ticket_id, force_refresh = false } = await req.json();

    if (!address) {
      throw new Error('Endereço é obrigatório');
    }

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    // 1. Verificar cache global primeiro
    if (!force_refresh) {
      const { data: cachedAddress } = await supabase
        .from('geocoding_cache')
        .select('latitude, longitude, formatted_address, cached_at')
        .eq('address_normalized', address.toLowerCase().trim())
        .maybeSingle();

      if (cachedAddress) {
        const cacheAge = Date.now() - new Date(cachedAddress.cached_at).getTime();
        if (cacheAge < 90 * 24 * 60 * 60 * 1000) { // 90 dias
          console.log(`[mapbox-geocode] ✅ Cache hit: ${address}`);
          
          if (ticket_id) {
            await supabase
              .from('tickets')
              .update({
                latitude: cachedAddress.latitude,
                longitude: cachedAddress.longitude,
                geocoded_at: new Date().toISOString(),
                geocoding_status: 'geocoded'
              })
              .eq('id', ticket_id);
          }
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              latitude: cachedAddress.latitude,
              longitude: cachedAddress.longitude,
              formatted_address: cachedAddress.formatted_address,
              cached: true
            }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 2. Marcar como processando
    if (ticket_id) {
      await supabase
        .from('tickets')
        .update({ geocoding_status: 'processing' })
        .eq('id', ticket_id);
    }

    console.log(`[mapbox-geocode] 🗺️  Geocodificando via Mapbox: ${address}`);

    // 3. Limpar e simplificar o endereço para melhorar a taxa de sucesso
    let cleanAddress = address
      // Remover detalhes muito específicos que o Mapbox não usa bem
      .replace(/Q\.\s*\d+/gi, '') // Remove "Q. 02"
      .replace(/L\.\s*[\d-]+/gi, '') // Remove "L. 08-11"
      .replace(/S\/N/gi, '') // Remove "S/N"
      .replace(/ETAPA\s+(I|II|III|IV|V)+/gi, '') // Remove "ETAPA II"
      .replace(/\s*-\s*/g, ' ') // Remove traços extras
      .replace(/,\s*,/g, ',') // Remove vírgulas duplicadas
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();

    // Se ficar muito curto após limpeza, usar endereço original
    if (cleanAddress.length < 10) {
      cleanAddress = address;
    }

    console.log(`[mapbox-geocode] 📍 Endereço limpo: ${cleanAddress}`);

    // 4. Chamar Mapbox Geocoding API
    const mapboxUrl = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(cleanAddress) + '.json');
    mapboxUrl.searchParams.append('access_token', MAPBOX_TOKEN);
    mapboxUrl.searchParams.append('country', 'BR'); // Restringir ao Brasil
    mapboxUrl.searchParams.append('limit', '1');
    mapboxUrl.searchParams.append('language', 'pt-BR');
    mapboxUrl.searchParams.append('types', 'address,place,locality'); // Tipos de resultados aceitos

    const mapboxResponse = await fetch(mapboxUrl.toString());

    if (!mapboxResponse.ok) {
      const errorBody = await mapboxResponse.text();
      console.error(`[mapbox-geocode] ❌ Erro Mapbox (${mapboxResponse.status}): ${errorBody}`);
      
      if (ticket_id) {
        await supabase.from('tickets').update({ geocoding_status: 'failed' }).eq('id', ticket_id);
      }
      throw new Error(`Mapbox API error: ${mapboxResponse.status} - ${errorBody}`);
    }

    const data = await mapboxResponse.json();

    if (!data.features || data.features.length === 0) {
      if (ticket_id) {
        await supabase.from('tickets').update({ geocoding_status: 'failed' }).eq('id', ticket_id);
      }
      throw new Error('Endereço não encontrado');
    }

    const feature = data.features[0];
    
    // Mapbox retorna [longitude, latitude] - precisa inverter!
    const result = {
      latitude: feature.center[1],  // Lat é o segundo valor
      longitude: feature.center[0], // Lon é o primeiro valor
      formatted_address: feature.place_name,
      cached: false
    };

    console.log(`[mapbox-geocode] ✅ Geocodificado: ${address} -> [${result.latitude}, ${result.longitude}]`);

    // 4. Salvar no cache
    await supabase
      .from('geocoding_cache')
      .upsert({
        address_normalized: address.toLowerCase().trim(),
        original_address: address,
        latitude: result.latitude,
        longitude: result.longitude,
        formatted_address: result.formatted_address,
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'address_normalized'
      });

    // 5. Atualizar ticket
    if (ticket_id) {
      await supabase
        .from('tickets')
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          geocoded_at: new Date().toISOString(),
          geocoding_status: 'geocoded'
        })
        .eq('id', ticket_id);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[mapbox-geocode] ❌ Erro na geocodificação:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});