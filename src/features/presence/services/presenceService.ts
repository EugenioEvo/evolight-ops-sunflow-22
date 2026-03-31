import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { OrdemServicoPresenca, PresenceTecnico } from '../types';

export const createPresenceService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchTecnicos(): Promise<PresenceTecnico[]> {
      const { data, error } = await db
        .from('tecnicos')
        .select('id, profiles (nome)')
        .order('profiles(nome)', { ascending: true });
      if (error) throw error;
      return (data || []) as PresenceTecnico[];
    },

    async fetchOrdensServico(): Promise<OrdemServicoPresenca[]> {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const { data, error } = await db
        .from('ordens_servico')
        .select(`id, numero_os, data_programada, hora_inicio, hora_fim, presence_confirmed_at, presence_confirmed_by, ticket_id, tecnico_id,
          tecnicos (id, profiles (nome)),
          tickets (numero_ticket, titulo, endereco_servico, clientes (empresa))`)
        .gte('data_programada', hoje.toISOString())
        .lt('data_programada', amanha.toISOString())
        .order('hora_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as OrdemServicoPresenca[];
    },
  };
};

export const presenceService = createPresenceService();
