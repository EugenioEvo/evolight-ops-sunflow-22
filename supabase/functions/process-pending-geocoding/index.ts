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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Iniciando worker de geocodificação automática...');

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

    // 2. Processar cada ticket em sequência (respeitando rate limit de 1 req/seg)
    const results = [];
    
    for (let i = 0; i < pendingTickets.length; i++) {
      const ticket = pendingTickets[i];
      
      try {
        console.log(`[${i + 1}/${pendingTickets.length}] Geocodificando ticket ${ticket.numero_ticket}...`);
        
        // Chamar edge function de geocodificação
        const { data: geocodeResult, error: geocodeError } = await supabase.functions.invoke(
          'geocode-address',
          {
            body: {
              address: ticket.endereco_servico,
              ticket_id: ticket.id,
              force_refresh: false
            }
          }
        );

        if (geocodeError) {
          console.error(`❌ Erro ao geocodificar ${ticket.numero_ticket}:`, geocodeError);
          results.push({
            ticket_id: ticket.id,
            numero_ticket: ticket.numero_ticket,
            success: false,
            error: geocodeError.message
          });
          continue;
        }

        if (geocodeResult?.success) {
          console.log(`✅ ${ticket.numero_ticket} geocodificado com sucesso`);
          results.push({
            ticket_id: ticket.id,
            numero_ticket: ticket.numero_ticket,
            success: true,
            cached: geocodeResult.data?.cached || false
          });
        } else {
          console.error(`❌ Falha ao geocodificar ${ticket.numero_ticket}:`, geocodeResult?.error);
          results.push({
            ticket_id: ticket.id,
            numero_ticket: ticket.numero_ticket,
            success: false,
            error: geocodeResult?.error || 'Erro desconhecido'
          });
        }

        // Aguardar 1.5 segundos entre requisições (rate limit Nominatim)
        if (i < pendingTickets.length - 1) {
          console.log('⏳ Aguardando 1.5s (rate limit)...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

      } catch (error: any) {
        console.error(`❌ Exceção ao processar ${ticket.numero_ticket}:`, error);
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
    const cachedCount = results.filter(r => r.success && r.cached).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`
📊 Resumo da geocodificação:
   ✅ Sucesso: ${successCount}
   💾 Cache: ${cachedCount}
   ❌ Falhas: ${failedCount}
   📝 Total: ${results.length}
    `);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        successful: successCount,
        cached: cachedCount,
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
