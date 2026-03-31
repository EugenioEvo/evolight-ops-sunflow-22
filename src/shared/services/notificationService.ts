import { supabase } from '@/integrations/supabase/client';

/**
 * Unified notification service — eliminates duplication across ticketService and workOrderService.
 * Handles in-app notifications and calendar invite dispatching.
 */
export const notificationService = {
  /**
   * Sends an in-app notification to a user.
   * @throws if the insert fails
   */
  async sendInApp(
    userId: string,
    tipo: string,
    titulo: string,
    mensagem: string,
    link: string
  ): Promise<void> {
    if (!userId || !tipo || !titulo || !mensagem) {
      throw new Error('notificationService.sendInApp: parâmetros obrigatórios ausentes');
    }

    const { error } = await supabase.from('notificacoes').insert({
      user_id: userId,
      tipo,
      titulo,
      mensagem,
      link,
    });

    if (error) throw error;
  },

  /**
   * Dispatches a calendar invite email via edge function.
   * @param action - 'create' | 'cancel' | 'reassign_removed' | 'rejection_reschedule'
   * @throws if the edge function fails
   */
  async sendCalendarInvite(osId: string, action: string): Promise<void> {
    if (!osId || !action) {
      throw new Error('notificationService.sendCalendarInvite: osId e action são obrigatórios');
    }

    const { error } = await supabase.functions.invoke('send-calendar-invite', {
      body: { os_id: osId, action },
    });

    if (error) throw error;
  },

  /**
   * Resolves the auth user_id for a given tecnico UUID.
   * Returns null if not found.
   */
  async getTecnicoUserId(tecnicoId: string): Promise<string | null> {
    if (!tecnicoId) return null;

    const { data } = await supabase
      .from('tecnicos')
      .select('profiles!inner(user_id)')
      .eq('id', tecnicoId)
      .single();

    return (data as any)?.profiles?.user_id || null;
  },
};
