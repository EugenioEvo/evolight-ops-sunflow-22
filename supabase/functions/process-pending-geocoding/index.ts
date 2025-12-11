import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PendingTicket {
  id: string;
  endereco_servico: string;
  numero_ticket: string;
}

// Limpar endereço para melhorar taxa de sucesso do Mapbox
function cleanAddress(address: string): string {
  // Extrair o nome da rua (primeira parte antes da vírgula ou quadra)
  const streetMatch = address.match(/^((?:AVENIDA|AV\.?|RUA|R\.?|ALAMEDA|AL\.?|TRAVESSA|TV\.?)\s+[^,Q]+)/i);
  
  // Extrair cidade e estado
  const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*[-–]\s*\d{5}/i);
  
  if (streetMatch && cityMatch) {
    // Construir endereço simplificado: Rua + Cidade + Estado
    const street = streetMatch[1].trim();
    const city = cityMatch[1].trim();
    const state = cityMatch[2].trim();
    return `${street}, ${city}, ${state}, Brasil`;
  }
  
  // Fallback: limpar endereço normalmente
  return address
    .replace(/Q\.\s*\d+/gi, '')
    .replace(/Quadra\s*\d+/gi, '')
    .replace(/L\.\s*[\d-]+/gi, '')
    .replace(/Lote\s*[\d-]+/gi, '')
    .replace(/S\/N/gi, '')
    .replace(/ETAPA\s+(I|II|III|IV|V)+/gi, '')
    .replace(/Parque\s+Industrial[^,]*/gi, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Iniciando worker de geocodificação automática...');

    if (!mapboxToken) {
      throw new Error('MAPBOX_ACCESS_TOKEN não configurado');
    }

    // 1. Buscar tickets com status 'pending' (limitado a 10 por vez)
    const { data: pendingTickets, error: fetchError } = await supabase
      .from('tickets')
      .select('id, endereco_servico, numero_ticket')
      .eq('geocoding_status', 'pending')
      .not('endereco_servico', 'is', null)
      .neq('endereco_servico', '')
      .limit(10)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Erro ao buscar tickets pendentes:', fetchError);
      throw fetchError;
    }

    if (!pendingTickets || pendingTickets.length === 0) {
      console.log('✅ Nenhum ticket pendente para geocodificar');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum ticket pendente',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📍 ${pendingTickets.length} tickets pendentes encontrados`);

    // 2. Processar cada ticket
    const results = [];
    
    for (let i = 0; i < pendingTickets.length; i++) {
      const ticket = pendingTickets[i];
      
      try {
        console.log(`[${i + 1}/${pendingTickets.length}] Geocodificando ticket ${ticket.numero_ticket}...`);
        
        // Marcar como processing
        await supabase
          .from('tickets')
          .update({ geocoding_status: 'processing' })
          .eq('id', ticket.id);

        // Limpar endereço
        const cleanedAddress = cleanAddress(ticket.endereco_servico);
        console.log(`📍 Endereço limpo: ${cleanedAddress}`);

        // Chamar Mapbox Geocoding API diretamente
        const mapboxUrl = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(cleanedAddress) + '.json');
        mapboxUrl.searchParams.append('access_token', mapboxToken);
        mapboxUrl.searchParams.append('country', 'BR');
        mapboxUrl.searchParams.append('limit', '1');
        mapboxUrl.searchParams.append('language', 'pt-BR');
        mapboxUrl.searchParams.append('types', 'address,place,locality');

        const mapboxResponse = await fetch(mapboxUrl.toString());

        if (!mapboxResponse.ok) {
          const errorBody = await mapboxResponse.text();
          console.error(`❌ Erro Mapbox (${mapboxResponse.status}): ${errorBody}`);
          
          await supabase
            .from('tickets')
            .update({ geocoding_status: 'failed' })
            .eq('id', ticket.id);
            
          results.push({
            ticket_id: ticket.id,
            numero_ticket: ticket.numero_ticket,
            success: false,
            error: `Mapbox error: ${mapboxResponse.status}`
          });
          continue;
        }

        const data = await mapboxResponse.json();

        if (!data.features || data.features.length === 0) {
          console.error(`❌ Endereço não encontrado: ${ticket.endereco_servico}`);
          
          await supabase
            .from('tickets')
            .update({ geocoding_status: 'failed' })
            .eq('id', ticket.id);
            
          results.push({
            ticket_id: ticket.id,
            numero_ticket: ticket.numero_ticket,
            success: false,
            error: 'Endereço não encontrado'
          });
          continue;
        }

        const feature = data.features[0];
        const latitude = feature.center[1];
        const longitude = feature.center[0];
        const formattedAddress = feature.place_name;

        console.log(`✅ ${ticket.numero_ticket} geocodificado: [${latitude}, ${longitude}]`);

        // Atualizar ticket
        await supabase
          .from('tickets')
          .update({
            latitude,
            longitude,
            geocoded_at: new Date().toISOString(),
            geocoding_status: 'geocoded'
          })
          .eq('id', ticket.id);

        // Salvar no cache
        await supabase
          .from('geocoding_cache')
          .upsert({
            address_normalized: ticket.endereco_servico.toLowerCase().trim(),
            original_address: ticket.endereco_servico,
            latitude,
            longitude,
            formatted_address: formattedAddress,
            cached_at: new Date().toISOString()
          }, {
            onConflict: 'address_normalized'
          });

        results.push({
          ticket_id: ticket.id,
          numero_ticket: ticket.numero_ticket,
          success: true,
          latitude,
          longitude
        });

        // Aguardar 500ms entre requisições
        if (i < pendingTickets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error: any) {
        console.error(`❌ Exceção ao processar ${ticket.numero_ticket}:`, error);
        
        await supabase
          .from('tickets')
          .update({ geocoding_status: 'failed' })
          .eq('id', ticket.id);
          
        results.push({
          ticket_id: ticket.id,
          numero_ticket: ticket.numero_ticket,
          success: false,
          error: error.message
        });
      }
    }

    // 3. Resumo dos resultados
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`
📊 Resumo da geocodificação:
   ✅ Sucesso: ${successCount}
   ❌ Falhas: ${failedCount}
   📝 Total: ${results.length}
    `);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failedCount
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro fatal no worker:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});