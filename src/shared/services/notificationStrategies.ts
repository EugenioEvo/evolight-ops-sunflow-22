import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';
import type { LinkedOS } from '@/features/tickets/types';

/**
 * Strategy: notify ticket creator about approval/rejection decision.
 * Sends in-app notification + transactional email (with rejection reason).
 */
export async function notifyTicketDecision(
  ticketId: string,
  decision: 'aprovado' | 'rejeitado',
  observacoes?: string
): Promise<void> {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('numero_ticket, titulo, created_by')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket?.created_by) return;

  const isApproved = decision === 'aprovado';
  const motivo = (observacoes || '').trim();
  const titulo = isApproved ? 'Ticket Aprovado' : 'Ticket Rejeitado';
  const mensagem = isApproved
    ? `Seu ticket ${ticket.numero_ticket} (${ticket.titulo}) foi aprovado pela equipe.`
    : `Seu ticket ${ticket.numero_ticket} (${ticket.titulo}) foi rejeitado.${motivo ? ` Motivo: ${motivo}` : ''}`;

  await Promise.all([
    notificationService
      .sendInApp(ticket.created_by, isApproved ? 'ticket_aprovado' : 'ticket_rejeitado', titulo, mensagem, '/tickets')
      .catch((e) => console.warn('notifyTicketDecision in-app failed:', e)),
    supabase.functions
      .invoke('send-ticket-decision-email', {
        body: { ticket_id: ticketId, decision, observacoes: motivo || undefined },
      })
      .catch((e) => console.warn('notifyTicketDecision email failed:', e)),
  ]);
}

/**
 * Strategy: notify old technician about reassignment removal (in-app + ICS CANCEL via send-calendar-invite)
 */
export async function notifyReassignRemoved(os: LinkedOS, oldTecnicoId: string): Promise<void> {
  const [, oldTecUserId] = await Promise.all([
    notificationService.sendCalendarInvite(os.id, 'reassign_removed').catch(() => {}),
    notificationService.getTecnicoUserId(oldTecnicoId),
  ]);

  if (oldTecUserId) {
    await notificationService.sendInApp(
      oldTecUserId, 'os_reatribuida', 'OS Reatribuída',
      `A OS ${os.numero_os} foi reatribuída a outro técnico.`, '/minhas-os'
    );
  }
}

/**
 * Strategy: notify new technician about assignment (calendar invite + in-app)
 */
export async function notifyNewAssignment(os: LinkedOS, newTecUserId: string | undefined): Promise<void> {
  const calendarPromise = notificationService.sendCalendarInvite(os.id, 'create').catch(() => {});

  if (newTecUserId) {
    await Promise.all([
      calendarPromise,
      notificationService.sendInApp(
        newTecUserId, 'os_atribuida', 'Nova OS Atribuída',
        `A OS ${os.numero_os} foi atribuída a você.`, '/minhas-os'
      ),
    ]);
  } else {
    await calendarPromise;
  }
}

/**
 * Strategy: notify technician + OS creator + ticket creator that ticket was altered.
 * (#9) Email + in-app to OS creator and technicians involved.
 */
export async function notifyTicketAltered(os: LinkedOS): Promise<void> {
  const recipients = new Set<string>();

  // 1) Technician (in-app)
  if (os.tecnico_id) {
    const tecUserId = await notificationService.getTecnicoUserId(os.tecnico_id);
    if (tecUserId) recipients.add(tecUserId);
  }

  // 2) OS creator + ticket creator (in-app)
  const { data: osRow } = await supabase
    .from('ordens_servico')
    .select('numero_os, ticket_id, tickets(created_by, numero_ticket, titulo)')
    .eq('id', os.id)
    .maybeSingle();

  const ticketCreator = (osRow as any)?.tickets?.created_by;
  if (ticketCreator) recipients.add(ticketCreator);

  // In-app to all unique recipients
  await Promise.all(
    Array.from(recipients).map((uid) =>
      notificationService
        .sendInApp(
          uid, 'os_alterada', 'OS Alterada — Aceite Necessário',
          `O ticket vinculado à OS ${os.numero_os} foi alterado (data, horário ou tipo de serviço). Novo aceite do técnico será necessário.`,
          '/minhas-os'
        )
        .catch((e) => console.warn('notifyTicketAltered in-app failed:', e))
    )
  );

  // Email to OS creator (technician already gets the calendar invite separately)
  if (ticketCreator) {
    supabase.functions
      .invoke('send-os-altered-email', { body: { os_id: os.id } })
      .catch((e) => console.warn('send-os-altered-email failed:', e));
  }
}

/**
 * Strategy: notify ticket creator + OS creator + technician about ticket deletion.
 * (#11) Email + in-app to ticket creator and OS creator (dedupe if same person).
 */
export async function notifyTicketDeleted(os: LinkedOS): Promise<void> {
  // Technician in-app
  if (os.tecnico_id) {
    const tecUserId = await notificationService.getTecnicoUserId(os.tecnico_id);
    if (tecUserId) {
      await notificationService.sendInApp(
        tecUserId, 'ticket_excluido', 'Ticket Excluído',
        `O ticket vinculado à OS ${os.numero_os} foi excluído pelo gestor. A OS será removida.`,
        '/minhas-os'
      ).catch((e) => console.warn('notifyTicketDeleted tech in-app failed:', e));
    }
  }

  // Ticket creator in-app + email (OS creator = ticket creator in this domain, dedupe is a no-op)
  const { data: osRow } = await supabase
    .from('ordens_servico')
    .select('numero_os, ticket_id, tickets(created_by, numero_ticket, titulo)')
    .eq('id', os.id)
    .maybeSingle();

  const creator = (osRow as any)?.tickets?.created_by;
  if (creator) {
    await notificationService.sendInApp(
      creator, 'ticket_excluido_criador', 'Ticket Excluído',
      `O ticket ${(osRow as any)?.tickets?.numero_ticket || ''} vinculado à OS ${os.numero_os} foi excluído pelo gestor.`,
      '/tickets'
    ).catch((e) => console.warn('notifyTicketDeleted creator in-app failed:', e));

    supabase.functions
      .invoke('send-ticket-deleted-email', { body: { os_id: os.id } })
      .catch((e) => console.warn('send-ticket-deleted-email failed:', e));
  }
}

/**
 * Strategy: notify OS creator + technician when an OS is cancelled.
 * (#6-7) Email + in-app to OS creator (technician already handled by useCancelOS via send-calendar-invite).
 */
export async function notifyOSCancelled(osId: string, motivo?: string): Promise<void> {
  const { data: osRow } = await supabase
    .from('ordens_servico')
    .select('numero_os, ticket_id, tickets(created_by, titulo)')
    .eq('id', osId)
    .maybeSingle();

  const creator = (osRow as any)?.tickets?.created_by;
  if (!creator) return;

  const motivoText = (motivo || '').trim();
  const titulo = (osRow as any)?.tickets?.titulo || '';

  await Promise.all([
    notificationService
      .sendInApp(
        creator, 'os_cancelada_criador', 'OS Cancelada',
        `A OS ${(osRow as any)?.numero_os}${titulo ? ` (${titulo})` : ''} foi cancelada pelo gestor.${motivoText ? ` Motivo: ${motivoText}` : ''}`,
        `/work-orders`
      )
      .catch((e) => console.warn('notifyOSCancelled in-app failed:', e)),
    supabase.functions
      .invoke('send-os-cancelled-email', { body: { os_id: osId, motivo: motivoText || undefined } })
      .catch((e) => console.warn('send-os-cancelled-email failed:', e)),
  ]);
}

/**
 * Strategy: notify staff when a technician submits an RME for approval (#14)
 */
export async function notifyRMESubmitted(rmeId: string): Promise<void> {
  // Staff in-app
  const { data: staff } = await supabase
    .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao']);

  const { data: rme } = await supabase
    .from('rme_relatorios')
    .select('id, ordem_servico_id, tecnicos(profiles(nome))')
    .eq('id', rmeId)
    .maybeSingle();

  const tecnicoNome = (rme as any)?.tecnicos?.profiles?.nome || 'Técnico';

  if (staff && staff.length > 0) {
    await supabase.from('notificacoes').insert(
      staff.map((u) => ({
        user_id: u.user_id,
        tipo: 'rme_enviado',
        titulo: 'Novo RME Aguardando Aprovação',
        mensagem: `${tecnicoNome} enviou um RME para aprovação.`,
        link: '/gerenciar-rme',
      }))
    ).then(() => {}, (e) => console.warn('notifyRMESubmitted in-app failed:', e));
  }

  // Staff email via edge function (single batched email)
  supabase.functions
    .invoke('send-rme-submitted-email', { body: { rme_id: rmeId } })
    .catch((e) => console.warn('send-rme-submitted-email failed:', e));
}

/**
 * Strategy: notify everyone involved when an RME is approved or rejected (#12-13).
 * Recipients (deduped): RME author + technicians of all related OSs (same ticket, accepted/concluded)
 */
export async function notifyRMEDecision(
  rmeId: string,
  decision: 'aprovado' | 'rejeitado',
  motivo?: string
): Promise<void> {
  const { data: rme } = await supabase
    .from('rme_relatorios')
    .select('id, ticket_id, ordem_servico_id, tecnico_id, tecnicos(profiles(user_id, nome))')
    .eq('id', rmeId)
    .maybeSingle();

  if (!rme) return;

  const recipients = new Set<string>();

  // Author
  const authorUid = (rme as any)?.tecnicos?.profiles?.user_id;
  if (authorUid) recipients.add(authorUid);

  // All technicians on linked OSs of the same ticket (accepted, not refused)
  const { data: linkedOS } = await supabase
    .from('ordens_servico')
    .select('id, tecnico_id, aceite_tecnico')
    .eq('ticket_id', rme.ticket_id)
    .neq('aceite_tecnico', 'recusado');

  for (const os of linkedOS || []) {
    if (os.tecnico_id) {
      const uid = await notificationService.getTecnicoUserId(os.tecnico_id);
      if (uid) recipients.add(uid);
    }
  }

  const isApproved = decision === 'aprovado';
  const titulo = isApproved ? 'RME Aprovado' : 'RME Rejeitado';
  const mensagem = isApproved
    ? `Um RME vinculado a uma OS sua foi aprovado.`
    : `Um RME vinculado a uma OS sua foi rejeitado.${motivo ? ` Motivo: ${motivo}` : ''}`;

  await Promise.all(
    Array.from(recipients).map((uid) =>
      notificationService
        .sendInApp(uid, isApproved ? 'rme_aprovado' : 'rme_rejeitado', titulo, mensagem,
          isApproved ? '/gerenciar-rme' : `/rme?os=${rme.ordem_servico_id}`)
        .catch((e) => console.warn('notifyRMEDecision in-app failed:', e))
    )
  );

  // Batched email via edge function
  supabase.functions
    .invoke('send-rme-decision-email', { body: { rme_id: rmeId, decision, motivo: motivo || undefined } })
    .catch((e) => console.warn('send-rme-decision-email failed:', e));
}
