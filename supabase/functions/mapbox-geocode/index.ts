import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, ticket_id, force_refresh = false } = await req.json();

    if (!address) {
      throw new Error('Endereço é obrigatório');
    }

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
          console.log(`✅ Cache hit: ${address}`);
          
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

    console.log(`🗺️  Geocodificando via Mapbox: ${address}`);

    // 3. Chamar Mapbox Geocoding API
    const mapboxUrl = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json');
    mapboxUrl.searchParams.append('access_token', MAPBOX_TOKEN);
    mapboxUrl.searchParams.append('country', 'BR'); // Restringir ao Brasil
    mapboxUrl.searchParams.append('limit', '1');
    mapboxUrl.searchParams.append('language', 'pt-BR');

    const mapboxResponse = await fetch(mapboxUrl.toString());

    if (!mapboxResponse.ok) {
      if (ticket_id) {
        await supabase.from('tickets').update({ geocoding_status: 'failed' }).eq('id', ticket_id);
      }
      throw new Error(`Mapbox API error: ${mapboxResponse.status}`);
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

    console.log(`✅ Geocodificado: ${address} -> [${result.latitude}, ${result.longitude}]`);

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
    console.error('❌ Erro na geocodificação:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
