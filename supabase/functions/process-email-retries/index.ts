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
  senderEmail: "agendamento@grupoevolight.com.br",
  companyName: "SunFlow",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[process-email-retries] Iniciando processamento de retries");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar emails pendentes de retry que já passaram do horário
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_retry_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(10); // Processar até 10 emails por execução

    if (fetchError) {
      console.error("[process-email-retries] Erro ao buscar emails:", fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("[process-email-retries] Nenhum email para processar");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum email para processar",
          count: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[process-email-retries] ${pendingEmails.length} emails para processar`);

    let successCount = 0;
    let errorCount = 0;

    // Processar cada email
    for (const emailJob of pendingEmails) {
      try {
        // Marcar como processando
        await supabase
          .from("email_retry_queue")
          .update({ status: "processing" })
          .eq("id", emailJob.id);

        console.log(`[process-email-retries] Processando email tipo: ${emailJob.email_type}`);

        const payload = emailJob.payload;
        let emailResponse;

        // Enviar email baseado no tipo
        if (emailJob.email_type === "calendar_invite") {
          emailResponse = await resend.emails.send({
            from: `${CONFIG.companyName} <${CONFIG.senderEmail}>`,
            to: emailJob.recipients,
            subject: payload.subject,
            html: payload.html,
            attachments: payload.attachments || [],
          });
        } else if (emailJob.email_type === "reminder") {
          emailResponse = await resend.emails.send({
            from: `${CONFIG.companyName} <${CONFIG.senderEmail}>`,
            to: emailJob.recipients,
            subject: payload.subject,
            html: payload.html,
          });
        } else {
          throw new Error(`Tipo de email desconhecido: ${emailJob.email_type}`);
        }

        console.log(`[process-email-retries] Email enviado com sucesso:`, emailResponse);

        // Marcar como sucesso
        await supabase
          .from("email_retry_queue")
          .update({ 
            status: "success",
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", emailJob.id);

        successCount++;

      } catch (error: any) {
        console.error(`[process-email-retries] Erro ao processar email ${emailJob.id}:`, error);

        const newAttemptCount = emailJob.attempt_count + 1;
        const maxAttempts = emailJob.max_attempts || 5;

        if (newAttemptCount >= maxAttempts) {
          // Excedeu tentativas máximas
          await supabase
            .from("email_retry_queue")
            .update({ 
              status: "failed",
              attempt_count: newAttemptCount,
              last_error: error.message || "Erro desconhecido",
              last_attempt_at: new Date().toISOString(),
            })
            .eq("id", emailJob.id);

          console.log(`[process-email-retries] Email ${emailJob.id} marcado como failed após ${newAttemptCount} tentativas`);
        } else {
          // Agendar próximo retry
          const { data: nextRetryData } = await supabase.rpc(
            "calculate_next_retry",
            { attempt: newAttemptCount }
          );

          await supabase
            .from("email_retry_queue")
            .update({ 
              status: "pending",
              attempt_count: newAttemptCount,
              last_error: error.message || "Erro desconhecido",
              last_attempt_at: new Date().toISOString(),
              next_retry_at: nextRetryData,
            })
            .eq("id", emailJob.id);

          console.log(`[process-email-retries] Email ${emailJob.id} reagendado para ${nextRetryData}`);
        }

        errorCount++;
      }
    }

    console.log(`[process-email-retries] Finalizado: ${successCount} sucessos, ${errorCount} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Retries processados",
        total: pendingEmails.length,
        successful: successCount,
        errors: errorCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[process-email-retries] Erro geral:", error);
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
