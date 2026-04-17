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
  // Look up creator + ticket meta in one round-trip
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

  // In-app + email in parallel; never let either block the caller
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
 * Strategy: notify old technician about reassignment removal
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
 * Strategy: notify new technician about assignment
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
 * Strategy: notify technician that ticket was altered and re-acceptance is needed
 */
export async function notifyTicketAltered(os: LinkedOS): Promise<void> {
  if (!os.tecnico_id) return;
  const tecUserId = await notificationService.getTecnicoUserId(os.tecnico_id);
  if (tecUserId) {
    await notificationService.sendInApp(
      tecUserId, 'os_alterada', 'Ticket Alterado — Aceite Necessário',
      `O ticket vinculado à OS ${os.numero_os} foi alterado (data, horário ou tipo de serviço). Você precisa aceitar novamente.`,
      '/minhas-os'
    );
  }
}

/**
 * Strategy: notify technician that a linked ticket was deleted
 */
export async function notifyTicketDeleted(os: LinkedOS): Promise<void> {
  if (!os.tecnico_id) return;
  const tecUserId = await notificationService.getTecnicoUserId(os.tecnico_id);
  if (tecUserId) {
    await notificationService.sendInApp(
      tecUserId, 'ticket_excluido', 'Ticket Excluído',
      `O ticket vinculado à OS ${os.numero_os} foi excluído pelo gestor. A OS será removida.`,
      '/minhas-os'
    );
  }
}
