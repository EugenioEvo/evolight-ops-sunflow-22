import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { PrestadorForm } from "../types";

export const createProviderService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchAll() {
      const { data, error } = await db.from('prestadores').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(data: PrestadorForm) {
      const { error } = await db.from('prestadores').insert([{ ...data, ativo: true, nome: data.nome || '', email: data.email || '', categoria: data.categoria || '' }]);
      if (error) throw error;
    },

    async update(id: string, data: PrestadorForm) {
      const { error } = await db.from('prestadores').update(data).eq('id', id);
      if (error) throw error;
    },

    async remove(id: string) {
      const { error } = await db.from('prestadores').delete().eq('id', id);
      if (error) throw error;
    },

    async approve(id: string) {
      const { error } = await db.from('prestadores').update({ ativo: true }).eq('id', id);
      if (error) throw error;
    },
  };
};

export const providerService = createProviderService();
