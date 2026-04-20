import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONFIG = {
  teamEmail: "oem@grupoevolight.com.br",
  senderEmail: "oem@grupoevolight.com.br",
  companyName: "SunFlow",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate cron/service secret for background functions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    // Only staff can trigger reminders
    const userId = claimsData.claims.sub;
    const { data: roleData } = await createClient(supabaseUrl, supabaseServiceKey)
      .from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    if (!roleData || !['admin', 'engenharia', 'supervisao'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    console.log("[send-os-reminders] Iniciando verificação de lembretes");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular data de amanhã (00:00 até 23:59)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    console.log(`[send-os-reminders] Buscando OS para ${tomorrow.toLocaleDateString('pt-BR')}`);

    // Buscar OS agendadas para amanhã que ainda não receberam lembrete
    const { data: ordensServico, error: fetchError } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        ticket:tickets(
          id,
          numero_ticket,
          titulo,
          descricao,
          endereco_servico,
          cliente:clientes(
            id,
            empresa,
            profile:profiles(nome)
          )
        ),
        tecnico:tecnicos(
          id,
          profile:profiles(
            nome,
            email
          )
        )
      `)
      .gte("data_programada", tomorrow.toISOString())
      .lte("data_programada", endOfTomorrow.toISOString())
      .is("reminder_sent_at", null)
      .not("hora_inicio", "is", null)
      .not("tecnico_id", "is", null);

    if (fetchError) {
      console.error("[send-os-reminders] Erro ao buscar OS:", fetchError);
      throw fetchError;
    }

    if (!ordensServico || ordensServico.length === 0) {
      console.log("[send-os-reminders] Nenhuma OS encontrada para enviar lembretes");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma OS para enviar lembretes",
          count: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[send-os-reminders] ${ordensServico.length} OS encontradas`);

    let successCount = 0;
    let errorCount = 0;

    // Processar cada OS
    for (const os of ordensServico) {
      try {
        if (!os.tecnico?.profile?.email) {
          console.warn(`[send-os-reminders] OS ${os.numero_os} sem email do técnico`);
          errorCount++;
          continue;
        }

        const tecnicoEmail = os.tecnico.profile.email;
        const tecnicoNome = os.tecnico.profile.nome;
        const clienteNome = os.ticket.cliente?.empresa || os.ticket.cliente?.profile?.nome || "Cliente";
        const endereco = os.ticket.endereco_servico;
        const dataOS = new Date(os.data_programada);
        const dataFormatada = dataOS.toLocaleDateString("pt-BR");
        const horaFormatada = os.hora_inicio;

    const recipients = [tecnicoEmail];
    
    // NOTA: Removido teamEmail (oem@grupoevolight.com.br) como destinatário conforme solicitação.
    // Apenas o técnico alocado recebe o lembrete.

        // Gerar token de confirmação seguro usando UUID
        const { data: tokenData, error: tokenError } = await supabase.rpc(
          'generate_presence_token',
          { p_os_id: os.id }
        );

        if (tokenError) {
          console.error(`[send-os-reminders] Erro ao gerar token para OS ${os.numero_os}:`, tokenError);
          
          // Registrar erro no log da OS
          await supabase
            .from("ordens_servico")
            .update({
              email_error_log: supabase.rpc('jsonb_array_append', {
                array: os.email_error_log || [],
                element: {
                  timestamp: new Date().toISOString(),
                  type: 'reminder',
                  error: 'Falha ao gerar token de confirmação',
                  details: tokenError.message
                }
              })
            })
            .eq("id", os.id);
          
          errorCount++;
          continue;
        }

        const confirmToken = tokenData;
        const confirmUrl = `${supabaseUrl}/functions/v1/confirm-presence?os_id=${os.id}&token=${confirmToken}`;

        const emailSubject = `Lembrete: OS ${os.numero_os} agendada para amanhã`;

        const emailBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">🔔 Lembrete de Ordem de Serviço</h2>
  
  <p>Esta é uma <strong>mensagem de lembrete</strong> sobre a OS agendada para <strong>amanhã</strong>:</p>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0;"><strong>OS:</strong></td>
        <td style="padding: 8px 0;">${os.numero_os}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Cliente:</strong></td>
        <td style="padding: 8px 0;">${clienteNome}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Técnico:</strong></td>
        <td style="padding: 8px 0;">${tecnicoNome}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Data:</strong></td>
        <td style="padding: 8px 0;">${dataFormatada}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Horário:</strong></td>
        <td style="padding: 8px 0;">${horaFormatada} - ${os.hora_fim}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Endereço:</strong></td>
        <td style="padding: 8px 0;">${endereco}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Descrição:</strong></td>
        <td style="padding: 8px 0;">${os.ticket.titulo}</td>
      </tr>
    </table>
  </div>

  <div style="background: #dbeafe; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
    <p style="margin: 0; color: #1e40af;">
      <strong>⏰ Lembrete:</strong> Esta OS está agendada para amanhã. Certifique-se de verificar todos os materiais e equipamentos necessários.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${confirmUrl}" 
       style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      ✅ Confirmar Presença
    </a>
    <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">
      Clique no botão acima para confirmar que você estará presente nesta OS
    </p>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  
  <p style="color: #6b7280; font-size: 12px;">
    Esta é uma mensagem automática do sistema SunFlow. Você recebeu este email porque está envolvido nesta ordem de serviço.
  </p>
</div>
`;

        console.log(`[send-os-reminders] Enviando lembrete para OS ${os.numero_os}`);

        const emailResponse = await resend.emails.send({
          from: `${CONFIG.companyName} <${CONFIG.senderEmail}>`,
          to: recipients,
          subject: emailSubject,
          html: emailBody,
        });

        console.log(`[send-os-reminders] Lembrete enviado para OS ${os.numero_os}:`, emailResponse);

        // Se o email falhou, adicionar à fila de retry
        if (emailResponse.error) {
          console.log(`[send-os-reminders] Email falhou para OS ${os.numero_os}, adicionando à fila de retry`);
          
          await supabase
            .from("email_retry_queue")
            .insert({
              email_type: "reminder",
              recipients,
              payload: {
                subject: emailSubject,
                html: emailBody,
                os_id: os.id,
                os_numero: os.numero_os,
              },
              next_retry_at: new Date(Date.now() + 60000).toISOString(), // Retry em 1 minuto
            });
        }

        // Atualizar registro da OS
        const { error: updateError } = await supabase
          .from("ordens_servico")
          .update({
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", os.id);

        if (updateError) {
          console.error(`[send-os-reminders] Erro ao atualizar OS ${os.numero_os}:`, updateError);
        }

        successCount++;
      } catch (error: any) {
        console.error(`[send-os-reminders] Erro ao processar OS ${os.numero_os}:`, error);
        
        // Registrar erro no log da OS
        try {
          const errorLog = os.email_error_log || [];
          errorLog.push({
            timestamp: new Date().toISOString(),
            type: 'reminder',
            error: error.message || 'Erro desconhecido ao enviar lembrete',
            details: error.toString()
          });

          await supabase
            .from("ordens_servico")
            .update({ email_error_log: errorLog })
            .eq("id", os.id);
        } catch (logError) {
          console.error(`[send-os-reminders] Erro ao registrar log de erro:`, logError);
        }
        
        errorCount++;
      }
    }

    console.log(`[send-os-reminders] Finalizado: ${successCount} enviados, ${errorCount} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lembretes processados",
        total: ordensServico.length,
        sent: successCount,
        errors: errorCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-os-reminders] Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
