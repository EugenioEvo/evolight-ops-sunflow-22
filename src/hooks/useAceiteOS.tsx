import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Unified OS acceptance/rejection hook — mirrors os-acceptance-action edge function.
 * - acceptOS: updates OS, promotes responsible technician (if applicable), triggers calendar invite
 * - rejectOS: updates OS, reverts ticket if needed, triggers rejection notice email
 *
 * The 2-step ticket-then-OS acceptance was removed; now acceptance is direct on the OS.
 * RLS already permits technicians to update aceite_tecnico/aceite_at/motivo_recusa on their own OS.
 */
export const useAceiteOS = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Promote this technician to responsible if:
   * - ticket has no responsible yet, OR
   * - the current responsible has a refused OS for the same ticket.
   * Uses conditional UPDATE to prevent races.
   */
  const maybePromoteResponsible = async (osId: string, ticketId: string) => {
    try {
      // Get current OS tecnico → matching prestador via email
      const { data: osRow } = await supabase
        .from('ordens_servico')
        .select('tecnico_id, tecnicos(profiles(email))')
        .eq('id', osId)
        .single();
      const tecEmail = (osRow as any)?.tecnicos?.profiles?.email;
      if (!tecEmail) return;

      const { data: prestador } = await supabase
        .from('prestadores').select('id').ilike('email', tecEmail).maybeSingle();
      if (!prestador?.id) return;

      const { data: ticket } = await supabase
        .from('tickets').select('tecnico_responsavel_id').eq('id', ticketId).single();
      if (!ticket) return;

      const currentResp = ticket.tecnico_responsavel_id;
      let shouldPromote = !currentResp;

      if (!shouldPromote && currentResp) {
        // Check if current resp has a refused OS
        const { data: respPres } = await supabase
          .from('prestadores').select('email').eq('id', currentResp).single();
        if (respPres?.email) {
          const { data: respTec } = await supabase
            .from('tecnicos').select('id, profiles!inner(email)').ilike('profiles.email', respPres.email).maybeSingle();
          if (respTec) {
            const { data: refused } = await supabase
              .from('ordens_servico')
              .select('id')
              .eq('ticket_id', ticketId)
              .eq('tecnico_id', respTec.id)
              .eq('aceite_tecnico', 'recusado')
              .maybeSingle();
            if (refused) shouldPromote = true;
          }
        }
      }

      if (shouldPromote && currentResp !== prestador.id) {
        // Conditional update: only succeeds if no other accept won the race
        const orFilter = currentResp
          ? `tecnico_responsavel_id.is.null,tecnico_responsavel_id.eq.${currentResp}`
          : 'tecnico_responsavel_id.is.null';
        await supabase
          .from('tickets')
          .update({ tecnico_responsavel_id: prestador.id })
          .eq('id', ticketId)
          .or(orFilter);

        await supabase
          .from('ordens_servico')
          .update({ tecnico_responsavel_id: prestador.id } as any)
          .eq('ticket_id', ticketId);
      }
    } catch (e) {
      console.warn('maybePromoteResponsible failed (non-blocking):', e);
    }
  };

  const acceptOS = async (osId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update({
          aceite_tecnico: 'aceito',
          aceite_at: new Date().toISOString(),
        } as any)
        .eq('id', osId)
        .select('id, ticket_id, numero_os')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Não foi possível atualizar. Verifique suas permissões.');

      await maybePromoteResponsible(osId, data.ticket_id);

      // Trigger calendar invite (non-blocking on UI feedback)
      supabase.functions.invoke('send-calendar-invite', {
        body: { os_id: osId, action: 'create' },
      }).catch((e) => console.warn('send-calendar-invite failed:', e));

      // Notify staff
      const { data: staffUsers } = await supabase
        .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao']);
      if (staffUsers) {
        await supabase.from('notificacoes').insert(
          staffUsers.map((u) => ({
            user_id: u.user_id,
            tipo: 'os_aceita',
            titulo: 'OS Aceita pelo Técnico',
            mensagem: `O técnico aceitou a OS ${data.numero_os}.`,
            link: `/work-orders/${osId}`,
          }))
        );
      }

      toast({
        title: 'OS aceita!',
        description: 'Você aceitou a ordem de serviço. Um email com o agendamento foi enviado.',
      });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao aceitar OS', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rejectOS = async (osId: string, motivo: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update({
          aceite_tecnico: 'recusado',
          aceite_at: new Date().toISOString(),
          motivo_recusa: motivo,
        } as any)
        .eq('id', osId)
        .select('id, ticket_id, numero_os')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Não foi possível atualizar. Verifique suas permissões.');

      // Revert ticket if no other active OS exists
      const { data: otherActive } = await supabase
        .from('ordens_servico')
        .select('id')
        .eq('ticket_id', data.ticket_id)
        .neq('id', osId)
        .neq('aceite_tecnico', 'recusado');

      if (!otherActive || otherActive.length === 0) {
        await supabase.from('tickets').update({ status: 'aprovado' as any }).eq('id', data.ticket_id);
      }

      // Notify creator via edge function
      supabase.functions.invoke('send-rejection-notice', {
        body: { os_id: osId },
      }).catch((e) => console.warn('send-rejection-notice failed:', e));

      // Notify staff in-app
      const { data: staffUsers } = await supabase
        .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao']);
      if (staffUsers) {
        await supabase.from('notificacoes').insert(
          staffUsers.map((u) => ({
            user_id: u.user_id,
            tipo: 'os_recusada',
            titulo: 'OS Recusada pelo Técnico',
            mensagem: `O técnico recusou a OS ${data.numero_os}. Motivo: ${motivo}`,
            link: `/work-orders/${osId}`,
          }))
        );
      }

      toast({
        title: 'OS recusada',
        description: 'Sua recusa foi registrada. A equipe de gestão foi notificada.',
      });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao recusar OS', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Backwards-compatible aliases (keep old call sites working until refactored)
  const aceitarOS = acceptOS;
  const recusarOS = rejectOS;
  // aceitarTicket is deprecated — kept as no-op pass-through for legacy call sites
  const aceitarTicket = async (_ticketId: string): Promise<boolean> => {
    console.warn('aceitarTicket() is deprecated. Acceptance is now done directly on the OS.');
    return true;
  };

  return { acceptOS, rejectOS, aceitarOS, recusarOS, aceitarTicket, loading };
};
