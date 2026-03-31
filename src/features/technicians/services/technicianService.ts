import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';

export const createTechnicianService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchAll() {
      const { data, error } = await db
        .from("tecnicos")
        .select(`*, profiles:profile_id (id, nome, email, telefone, ativo)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async update(id: string, data: { especialidades?: string[]; regiao_atuacao?: string; registro_profissional?: string }) {
      const { error } = await db.from("tecnicos").update(data).eq("id", id);
      if (error) throw error;
    },

    async toggleActive(profileId: string, currentActive: boolean) {
      const { error } = await db.from("profiles").update({ ativo: !currentActive }).eq("id", profileId);
      if (error) throw error;
    },
  };
};

export const technicianService = createTechnicianService();
