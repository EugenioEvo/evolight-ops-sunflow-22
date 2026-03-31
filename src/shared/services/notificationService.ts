import { supabase } from '@/integrations/supabase/client';
import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';

export const createNotificationService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async sendInApp(userId: string, tipo: string, titulo: string, mensagem: string, link: string): Promise<void> {
      if (!userId || !tipo || !titulo || !mensagem) {
        throw new Error('notificationService.sendInApp: parâmetros obrigatórios ausentes');
      }
      const { error } = await db.from('notificacoes').insert({ user_id: userId, tipo, titulo, mensagem, link });
      if (error) throw error;
    },

    async sendCalendarInvite(osId: string, action: string): Promise<void> {
      if (!osId || !action) {
        throw new Error('notificationService.sendCalendarInvite: osId e action são obrigatórios');
      }
      const { error } = await db.functions.invoke('send-calendar-invite', {
        body: { os_id: osId, action },
      });
      if (error) throw error;
    },

    async getTecnicoUserId(tecnicoId: string): Promise<string | null> {
      if (!tecnicoId) return null;
      const { data } = await db
        .from('tecnicos')
        .select('profiles!inner(user_id)')
        .eq('id', tecnicoId)
        .single();
      return (data as any)?.profiles?.user_id || null;
    },
  };
};

/** Default singleton instance */
export const notificationService = createNotificationService();
