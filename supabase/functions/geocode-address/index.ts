import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações de rate limit
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requisições
const RATE_LIMIT_WINDOW_MINUTES = 1; // por minuto

// Função de retry com backoff exponencial
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Se 429 (rate limit), esperar e tentar novamente
      if (response.status === 429) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limit atingido. Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Se sucesso ou erro não recuperável, retornar
      if (response.ok || response.status === 404) {
        return response;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Tentativa ${attempt + 1} falhou. Aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Todas as tentativas falharam');
}

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
    console.log(`[geocode-address] Request de IP: ${clientIP}`);

    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_geocoding_rate_limit', {
        p_ip: clientIP,
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
      });

    if (rateLimitError) {
      console.error('[geocode-address] Erro ao verificar rate limit:', rateLimitError);
    }

    if (rateLimitOk === false) {
      console.warn(`[geocode-address] Rate limit excedido para IP: ${clientIP}`);
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

    // 1. Verificar cache global de endereços primeiro
    if (!force_refresh) {
      const { data: cachedAddress } = await supabase
        .from('geocoding_cache')
        .select('latitude, longitude, formatted_address, cached_at')
        .eq('address_normalized', address.toLowerCase().trim())
        .maybeSingle();

      if (cachedAddress) {
        // Cache válido por 90 dias
        const cacheAge = Date.now() - new Date(cachedAddress.cached_at).getTime();
        if (cacheAge < 90 * 24 * 60 * 60 * 1000) {
          console.log(`[geocode-address] Cache global hit para endereço: ${address}`);
          
          // Atualizar ticket se fornecido
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

    // 2. Geocodificar via Nominatim com retry automático
    console.log(`[geocode-address] Geocodificando endereço: ${address}`);
    
    // Marcar ticket como em processamento
    if (ticket_id) {
      await supabase
        .from('tickets')
        .update({ geocoding_status: 'processing' })
        .eq('id', ticket_id);
    }
    
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.append('q', address);
    nominatimUrl.searchParams.append('format', 'json');
    nominatimUrl.searchParams.append('limit', '1');
    nominatimUrl.searchParams.append('countrycodes', 'br');
    nominatimUrl.searchParams.append('addressdetails', '1');

    const response = await fetchWithRetry(
      nominatimUrl.toString(),
      {
        headers: {
          'User-Agent': 'SunFlow-Geocoding/1.0'
        }
      },
      3,  // 3 tentativas
      1000 // 1s delay inicial
    );

    if (!response.ok) {
      // Marcar como falha
      if (ticket_id) {
        await supabase
          .from('tickets')
          .update({ geocoding_status: 'failed' })
          .eq('id', ticket_id);
      }
      throw new Error(`Nominatim retornou erro: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      // Marcar como falha
      if (ticket_id) {
        await supabase
          .from('tickets')
          .update({ geocoding_status: 'failed' })
          .eq('id', ticket_id);
      }
      throw new Error('Endereço não encontrado');
    }

    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      formatted_address: data[0].display_name,
      cached: false
    };

    // 3. Salvar no cache global
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

    // 4. Atualizar ticket se fornecido
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
      
      console.log(`[geocode-address] Geocodificado ticket ${ticket_id}: ${address} -> [${result.latitude}, ${result.longitude}]`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[geocode-address] Erro na geocodificação:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});