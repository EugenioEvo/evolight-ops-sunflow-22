import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import { addMonths, format, startOfMonth } from "date-fns";

export const createScheduleService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadOrdensServico(selectedDate: Date, selectedTecnico: string) {
      const start = startOfMonth(selectedDate);
      const nextMonthStart = addMonths(start, 1);

      let query = db
        .from('ordens_servico')
        .select(`*, tecnicos(id, profile_id, profiles(nome, email)), tickets(numero_ticket, titulo, endereco_servico, status, prioridade, clientes(empresa))`)
        .not('tecnico_id', 'is', null)
        .gte('data_programada', `${format(start, 'yyyy-MM-dd')}T00:00:00+00:00`)
        .lt('data_programada', `${format(nextMonthStart, 'yyyy-MM-dd')}T00:00:00+00:00`)
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (selectedTecnico !== 'todos') {
        query = query.eq('tecnico_id', selectedTecnico);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async loadTecnicos() {
      const { data } = await db.from('tecnicos').select('id, profiles!inner(nome)').order('profiles(nome)');
      return (data || []).map((t) => ({
        id: t.id,
        nome: (t.profiles as unknown as { nome: string })?.nome || 'Sem nome',
      }));
    },

    async resendCalendarInvite(osId: string) {
      const { error } = await db.functions.invoke('send-calendar-invite', {
        body: { os_id: osId, action: 'create' }
      });
      if (error) throw error;
    },

    async generatePresenceQR(osId: string) {
      const { data, error } = await db.rpc('generate_presence_token', { p_os_id: osId });
      if (error) throw error;
      return data;
    }
  };
};

export const scheduleService = createScheduleService();
