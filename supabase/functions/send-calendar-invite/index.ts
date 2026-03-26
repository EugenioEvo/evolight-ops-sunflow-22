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
  teamEmail: "oem@grupoevolight.onmicrosoft.com",
  senderEmail: "agendamento@grupoevolight.com.br",
  companyName: "SunFlow",
  organizerEmail: "agendamento@grupoevolight.com.br",
};

interface CalendarInviteRequest {
  os_id: string;
  action: "create" | "update" | "cancel" | "rejection_reschedule" | "reassign_removed";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { os_id, action }: CalendarInviteRequest = await req.json();
    
    console.log(`[send-calendar-invite] Action: ${action}, OS ID: ${os_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados completos da OS
    const { data: os, error: osError } = await supabase
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
      .eq("id", os_id)
      .single();

    if (osError || !os) {
      console.error("[send-calendar-invite] Erro ao buscar OS:", osError);
      throw new Error("OS não encontrada");
    }

    // Para cancelamento, permitir OS sem data/hora programada
    if (action !== "cancel" && (!os.data_programada || !os.hora_inicio || !os.hora_fim)) {
      console.error("[send-calendar-invite] OS sem data/hora programada");
      throw new Error("OS sem data/hora programada");
    }

    if (!os.tecnico?.profile?.email) {
      console.error("[send-calendar-invite] Técnico sem email");
      throw new Error("Técnico sem email cadastrado");
    }

    // Preparar dados do evento
    const tecnicoEmail = os.tecnico.profile.email;
    const tecnicoNome = os.tecnico.profile.nome;
    const clienteNome = os.ticket.cliente?.empresa || os.ticket.cliente?.profile?.nome || "Cliente";
    const endereco = os.ticket.endereco_servico;
    
    const hasSchedule = os.data_programada && os.hora_inicio && os.hora_fim;
    
    let dtStart: Date | null = null;
    let dtEnd: Date | null = null;
    let icsContent: string | null = null;

    if (hasSchedule) {
      const dataOS = new Date(os.data_programada);
      const [horaInicio, minInicio] = os.hora_inicio.split(":").map(Number);
      const [horaFim, minFim] = os.hora_fim.split(":").map(Number);
      
      dtStart = new Date(dataOS);
      dtStart.setHours(horaInicio, minInicio, 0, 0);
      
      dtEnd = new Date(dataOS);
      dtEnd.setHours(horaFim, minFim, 0, 0);

      // Formatar datas para iCalendar
      const formatICalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
      };

      const formatICalDateUTC = (date: Date): string => {
        return formatICalDate(date) + "Z";
      };

      const now = new Date();
      const uid = `os-${os.numero_os}@sunflow.grupoevolight.com.br`;
      
      let sequence = 0;
      if (action === "update" && os.calendar_invite_sent_at) {
        sequence = 1;
      }
      
      const method = action === "cancel" ? "CANCEL" : "REQUEST";
      const status = action === "cancel" ? "CANCELLED" : "CONFIRMED";

      icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SunFlow//Agendamento OS//PT",
        `METHOD:${method}`,
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${formatICalDateUTC(now)}`,
        `DTSTART:${formatICalDate(dtStart)}`,
        `DTEND:${formatICalDate(dtEnd)}`,
        `SUMMARY:${os.numero_os} - ${clienteNome}`,
        `DESCRIPTION:Ordem de Serviço\\n\\nCliente: ${clienteNome}\\nTécnico: ${tecnicoNome}\\nEndereço: ${endereco}\\n\\nDescrição: ${os.ticket.titulo}`,
        `LOCATION:${endereco}`,
        `STATUS:${action === "cancel" ? "CANCELLED" : "CONFIRMED"}`,
        `SEQUENCE:${sequence}`,
        `ORGANIZER;CN=${CONFIG.companyName}:mailto:${CONFIG.organizerEmail}`,
        `ATTENDEE;CN=${tecnicoNome};RSVP=TRUE:mailto:${tecnicoEmail}`,
        `ATTENDEE;CN=Equipe O&M;RSVP=TRUE:mailto:${CONFIG.teamEmail}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Lembrete: OS em 30 minutos",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
    }

    const isRejectionReschedule = action === "rejection_reschedule";

    // Gerar token de confirmação de presença para incluir no email
    let confirmUrl = "";
    if (action !== "cancel") {
      const { data: presenceToken, error: tokenError } = await supabase.rpc(
        'generate_presence_token',
        { p_os_id: os_id }
      );

      if (tokenError) {
        console.warn("[send-calendar-invite] Erro ao gerar token de presença:", tokenError);
      } else {
        confirmUrl = `${supabaseUrl}/functions/v1/confirm-presence?os_id=${os_id}&token=${presenceToken}`;
      }
    }

    // Preparar email
    const recipients = [tecnicoEmail, CONFIG.teamEmail];
    const actionText = action === "create" ? "agendada" : action === "update" ? "reagendada" : action === "rejection_reschedule" ? "reagendada após recusa" : "cancelada";
    const dataFormatada = dtStart ? dtStart.toLocaleDateString("pt-BR") : "Não definida";
    const horaFormatada = dtStart ? dtStart.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

    const emailSubject = action === "cancel"
      ? `Cancelamento: ${os.numero_os} - ${clienteNome}`
      : isRejectionReschedule
      ? `Reagendamento: ${os.numero_os} - ${clienteNome} — Nova atribuição após recusa`
      : `Agendamento: ${os.numero_os} - ${clienteNome} - ${dataFormatada} ${horaFormatada}`;

    const confirmButtonHtml = confirmUrl ? `
<div style="text-align: center; margin: 30px 0;">
  <a href="${confirmUrl}" 
     style="display: inline-block; background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
    ✅ Confirmar Presença
  </a>
  <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">
    Clique no botão acima para confirmar que você estará presente nesta OS
  </p>
</div>
` : "";

    const cancelFooter = hasSchedule
      ? `<p style="color: #666; font-size: 12px;">Este evento foi cancelado. O convite em anexo removerá automaticamente o evento do seu calendário.</p>`
      : `<p style="color: #666; font-size: 12px;">Esta ordem de serviço foi cancelada pelo administrador.</p>`;

    const emailBody = action === "cancel"
      ? `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Ordem de Serviço Cancelada</h2>
  <p><strong>OS:</strong> ${os.numero_os}</p>
  <p><strong>Cliente:</strong> ${clienteNome}</p>
  <p><strong>Técnico:</strong> ${tecnicoNome}</p>
  ${hasSchedule ? `<p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>` : ""}
  <p><strong>Endereço:</strong> ${endereco}</p>
  <hr>
  ${cancelFooter}
</div>
`
      : isRejectionReschedule
      ? `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #d97706;">Ordem de Serviço Reagendada após Recusa</h2>
  <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
    <p style="margin: 0; color: #92400e;">Esta OS foi revista e reagendada pela gestão. É necessário um novo aceite da sua parte.</p>
  </div>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>OS:</strong> ${os.numero_os}</p>
    <p><strong>Cliente:</strong> ${clienteNome}</p>
    <p><strong>Técnico:</strong> ${tecnicoNome}</p>
    <p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>
    <p><strong>Duração:</strong> ${os.duracao_estimada_min || 120} minutos</p>
    <p><strong>Endereço:</strong> ${endereco}</p>
  </div>
  ${confirmButtonHtml}
  <hr>
  <p style="color: #666; font-size: 12px;">
    <strong>Importante:</strong> Abra o arquivo em anexo e clique em "Aceitar" para adicionar este agendamento ao seu calendário Outlook/Google Calendar.
  </p>
</div>
`
      : `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Nova Ordem de Serviço ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}</h2>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>OS:</strong> ${os.numero_os}</p>
    <p><strong>Cliente:</strong> ${clienteNome}</p>
    <p><strong>Técnico:</strong> ${tecnicoNome}</p>
    <p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>
    <p><strong>Duração:</strong> ${os.duracao_estimada_min || 120} minutos</p>
    <p><strong>Endereço:</strong> ${endereco}</p>
  </div>
  ${confirmButtonHtml}
  <hr>
  <p style="color: #666; font-size: 12px;">
    <strong>Importante:</strong> Abra o arquivo em anexo e clique em "Aceitar" para adicionar este agendamento ao seu calendário Outlook/Google Calendar.
  </p>
</div>
`;

    // Enviar email via Resend
    console.log(`[send-calendar-invite] Enviando para: ${recipients.join(", ")}`);

    const emailPayload: any = {
      from: `${CONFIG.companyName} <${CONFIG.senderEmail}>`,
      to: recipients,
      subject: emailSubject,
      html: emailBody,
    };

    // Anexar .ics apenas se tiver dados de agendamento
    if (icsContent) {
      emailPayload.attachments = [
        {
          filename: "convite.ics",
          content: icsContent,
        },
      ];
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("[send-calendar-invite] Email enviado:", emailResponse);

    // Se o email falhou, adicionar à fila de retry
    if (emailResponse.error) {
      console.log("[send-calendar-invite] Email falhou, adicionando à fila de retry");
      
      const { error: queueError } = await supabase
        .from("email_retry_queue")
        .insert({
          email_type: "calendar_invite",
          recipients,
          payload: {
            subject: emailSubject,
            html: emailBody,
            attachments: [
              {
                filename: "convite.ics",
                content: icsContent,
              },
            ],
          },
          next_retry_at: new Date(Date.now() + 60000).toISOString(),
        });

      if (queueError) {
        console.error("[send-calendar-invite] Erro ao adicionar à fila:", queueError);
      }
    }

    // Atualizar registro da OS
    const { error: updateError } = await supabase
      .from("ordens_servico")
      .update({
        calendar_invite_sent_at: new Date().toISOString(),
        calendar_invite_recipients: recipients,
      })
      .eq("id", os_id);

    if (updateError) {
      console.error("[send-calendar-invite] Erro ao atualizar OS:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso",
        recipients 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-calendar-invite] Erro:", error);
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
