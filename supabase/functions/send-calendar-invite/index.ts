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
  senderEmail: "oem@grupoevolight.com.br",
  companyName: "SunFlow",
  organizerEmail: "oem@grupoevolight.com.br",
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
    // SECURITY: Validate auth and role
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
    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { os_id, action }: CalendarInviteRequest = await req.json();

    // Authorization: staff OR the assigned technician of this OS may trigger the invite.
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    const isStaff = roleData && ['admin', 'engenharia', 'supervisao'].includes(roleData.role);

    let isAssignedTechnician = false;
    if (!isStaff && os_id) {
      const { data: osTech } = await supabase
        .from('ordens_servico')
        .select('tecnico_id, tecnicos!inner(profiles!inner(user_id))')
        .eq('id', os_id)
        .maybeSingle();
      const techUserId = (osTech as any)?.tecnicos?.profiles?.user_id;
      isAssignedTechnician = techUserId === userId;
    }

    if (!isStaff && !isAssignedTechnician) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }
    
    console.log(`[send-calendar-invite] Action: ${action}, OS ID: ${os_id}`);

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
      
      const method = (action === "cancel" || action === "reassign_removed") ? "CANCEL" : "REQUEST";
      const status = (action === "cancel" || action === "reassign_removed") ? "CANCELLED" : "CONFIRMED";

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
        "BEGIN:VALARM",
        "TRIGGER:-PT60M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Lembrete: OS em 60 minutos",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
    }

    const isRejectionReschedule = action === "rejection_reschedule";
    const isReassignRemoved = action === "reassign_removed";

    // Preparar email - apenas para o técnico (sem cópia para o time)
    const recipients = [tecnicoEmail];
    const actionText = action === "create" ? "agendada" : action === "update" ? "reagendada" : action === "rejection_reschedule" ? "reagendada após recusa" : action === "reassign_removed" ? "reatribuída" : "cancelada";
    const dataFormatada = dtStart ? dtStart.toLocaleDateString("pt-BR") : "Não definida";
    const horaFormatada = dtStart ? dtStart.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

    // [VERIFICADO] Subjects now include technician name per consolidated plan v3
    const emailSubject = action === "cancel"
      ? `Cancelamento: ${os.numero_os} - ${clienteNome} - ${tecnicoNome}`
      : isReassignRemoved
      ? `Reatribuição: ${os.numero_os} - ${clienteNome} - ${tecnicoNome} — Você foi desatribuído`
      : isRejectionReschedule
      ? `Reagendamento: ${os.numero_os} - ${clienteNome} - ${tecnicoNome} — Nova atribuição após recusa`
      : `Agendamento: ${os.numero_os} - ${clienteNome} - ${tecnicoNome}`;

    // Presence-confirmation button removed: acceptance is now handled by os-acceptance-action email
    const confirmButtonHtml = "";

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
      : isReassignRemoved
      ? `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc2626;">Você foi desatribuído desta OS</h2>
  <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
    <p style="margin: 0; color: #991b1b;">Esta OS foi reatribuída a outro técnico pela gestão. Nenhuma ação é necessária da sua parte.</p>
  </div>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>OS:</strong> ${os.numero_os}</p>
    <p><strong>Cliente:</strong> ${clienteNome}</p>
    ${hasSchedule ? `<p><strong>Data:</strong> ${dataFormatada} às ${horaFormatada}</p>` : ""}
    <p><strong>Endereço:</strong> ${endereco}</p>
  </div>
  <hr>
  <p style="color: #666; font-size: 12px;">
    Se você tinha este evento no calendário, o arquivo em anexo o removerá automaticamente.
  </p>
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
          content_type: 'text/calendar; charset="UTF-8"; method=REQUEST',
        },
      ];
      emailPayload.headers = {
        "Content-Class": "urn:content-classes:calendarmessage",
      };
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
