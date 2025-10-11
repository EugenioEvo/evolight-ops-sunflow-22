import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar cache se não forçar refresh
    if (!force_refresh && ticket_id) {
      const { data: cachedTicket } = await supabase
        .from('tickets')
        .select('latitude, longitude, geocoded_at')
        .eq('id', ticket_id)
        .single();

      if (cachedTicket?.latitude && cachedTicket?.longitude) {
        // Cache válido por 30 dias
        const cacheAge = Date.now() - new Date(cachedTicket.geocoded_at).getTime();
        if (cacheAge < 30 * 24 * 60 * 60 * 1000) {
          console.log(`Cache hit para ticket ${ticket_id}`);
          return new Response(JSON.stringify({
            success: true,
            data: {
              latitude: cachedTicket.latitude,
              longitude: cachedTicket.longitude,
              cached: true
            }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Geocodificar via Nominatim
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.append('q', address);
    nominatimUrl.searchParams.append('format', 'json');
    nominatimUrl.searchParams.append('limit', '1');
    nominatimUrl.searchParams.append('countrycodes', 'br');
    nominatimUrl.searchParams.append('addressdetails', '1');

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'LovableRME/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim retornou erro: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('Endereço não encontrado');
    }

    const result = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      formatted_address: data[0].display_name,
      cached: false
    };

    // Salvar no banco se ticket_id fornecido
    if (ticket_id) {
      await supabase
        .from('tickets')
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          geocoded_at: new Date().toISOString()
        })
        .eq('id', ticket_id);
      
      console.log(`Geocodificado ticket ${ticket_id}: ${address} -> [${result.latitude}, ${result.longitude}]`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro na geocodificação:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
