import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para obter IP do cliente
function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) {
    return xri;
  }
  return 'unknown';
}

function renderHTML(title: string, message: string, type: 'success' | 'error'): string {
  const icon = type === 'success' ? '✅' : '❌';
  const color = type === 'success' ? '#16a34a' : '#dc2626';
  const bgGradient = type === 'success' 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : '#f3f4f6';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - SunFlow</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            background: ${bgGradient};
          }
          .container { 
            background: white; 
            padding: 3rem; 
            border-radius: 12px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
            text-align: center; 
            max-width: 500px; 
          }
          .icon { 
            color: ${color}; 
            font-size: 4rem; 
            margin: 0; 
            animation: scaleIn 0.5s ease-out; 
          }
          @keyframes scaleIn { 
            from { transform: scale(0); } 
            to { transform: scale(1); } 
          }
          h1 { color: ${color}; margin: 1rem 0; }
          .message { color: #6b7280; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">${icon}</div>
          <h1>${title}</h1>
          <p class="message">${message}</p>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const osId = url.searchParams.get("os_id");
    const token = url.searchParams.get("token");
    const clientIP = getClientIP(req);

    if (!osId || !token) {
      return new Response(
        renderHTML('Erro', 'Parâmetros inválidos. Link de confirmação está incompleto.', 'error'),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    console.log(`[confirm-presence] Tentativa de confirmação para OS: ${osId} do IP: ${clientIP}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar rate limiting
    const { data: rateLimitOk } = await supabase.rpc('check_presence_rate_limit', {
      p_ip: clientIP,
      p_os_id: osId
    });

    if (!rateLimitOk) {
      console.log(`[confirm-presence] Rate limit excedido para IP ${clientIP}`);
      return new Response(
        renderHTML('Erro', 'Muitas tentativas. Por favor, aguarde 15 minutos antes de tentar novamente.', 'error'),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    // Registrar tentativa
    await supabase.rpc('log_presence_attempt', {
      p_ip: clientIP,
      p_os_id: osId
    });

    // Buscar OS
    const { data: os, error: fetchError } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        tecnico:tecnicos(
          id,
          profile:profiles(
            user_id,
            nome
          )
        ),
        ticket:tickets(numero_ticket, titulo)
      `)
      .eq("id", osId)
      .single();

    if (fetchError || !os) {
      console.error("[confirm-presence] OS não encontrada:", fetchError);
      return new Response(
        renderHTML('Erro', 'Ordem de serviço não encontrada ou já foi cancelada.', 'error'),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    // Validar token usando função do banco
    const { data: tokenValid } = await supabase.rpc('validate_presence_token', {
      p_token: token,
      p_os_id: osId
    });

    if (!tokenValid) {
      console.error("[confirm-presence] Token inválido ou expirado");
      return new Response(
        renderHTML('Erro', 'Token inválido ou expirado. Este link pode ter expirado (válido por 24 horas).', 'error'),
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    // Verificar se já foi confirmado
    if (os.presence_confirmed_at) {
      const tecnicoNome = os.tecnico?.profile?.nome || "Técnico";
      const confirmedDate = new Date(os.presence_confirmed_at).toLocaleString("pt-BR");
      
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Presença já confirmada - SunFlow</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
              .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
              .success { color: #16a34a; font-size: 3rem; margin: 0; }
              h1 { color: #16a34a; margin: 1rem 0; }
              .info { background: #f0fdf4; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✅</div>
              <h1>Presença já confirmada!</h1>
              <div class="info">
                <p><strong>OS:</strong> ${os.numero_os}</p>
                <p><strong>Confirmado por:</strong> ${tecnicoNome}</p>
                <p><strong>Em:</strong> ${confirmedDate}</p>
              </div>
              <p>Esta ordem de serviço já teve a presença confirmada anteriormente.</p>
            </div>
          </body>
        </html>
        `,
        { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
      );
    }

    // Confirmar presença
    const { error: updateError } = await supabase
      .from("ordens_servico")
      .update({
        presence_confirmed_at: new Date().toISOString(),
        presence_confirmed_by: os.tecnico?.profile?.user_id || null,
      })
      .eq("id", osId);

    if (updateError) {
      console.error("[confirm-presence] Erro ao confirmar:", updateError);
      throw updateError;
    }

    // Marcar token como usado
    await supabase.rpc('mark_token_used', { p_token: token });

    console.log(`[confirm-presence] Presença confirmada com sucesso para OS ${os.numero_os}`);

    const tecnicoNome = os.tecnico?.profile?.nome || "Técnico";
    const dataOS = new Date(os.data_programada).toLocaleDateString("pt-BR");

    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Confirmação de Presença - SunFlow</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 3rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
            .success { color: #16a34a; font-size: 4rem; margin: 0; animation: scaleIn 0.5s ease-out; }
            @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
            h1 { color: #16a34a; margin: 1rem 0; }
            .info { background: #f0fdf4; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; border-left: 4px solid #16a34a; }
            .info p { margin: 0.5rem 0; text-align: left; }
            .message { color: #6b7280; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Presença Confirmada!</h1>
            <div class="info">
              <p><strong>OS:</strong> ${os.numero_os}</p>
              <p><strong>Serviço:</strong> ${os.ticket.titulo}</p>
              <p><strong>Data:</strong> ${dataOS} às ${os.hora_inicio}</p>
              <p><strong>Técnico:</strong> ${tecnicoNome}</p>
            </div>
            <p class="message">Obrigado por confirmar sua presença! A equipe foi notificada.</p>
          </div>
        </body>
      </html>
      `,
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
    );
  } catch (error: any) {
    console.error("[confirm-presence] Erro:", error);
    return new Response(
      renderHTML('Erro', 'Ocorreu um erro ao processar sua confirmação. Por favor, tente novamente ou entre em contato com o suporte.', 'error'),
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=UTF-8" } }
    );
  }
};

serve(handler);
