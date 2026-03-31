import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { EquipamentoForm } from "../types";

export const createEquipmentService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchAll() {
      const { data, error } = await db.from('equipamentos').select(`*, clientes (id, empresa, profiles (nome))`).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async fetchClientes() {
      const { data, error } = await db.from('clientes').select(`id, empresa, profiles (nome)`).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async create(data: EquipamentoForm) {
      const { error } = await db.from('equipamentos').insert([{ ...data, status: 'ativo', nome: data.nome || '', tipo: data.tipo, cliente_id: data.cliente_id || '' }]);
      if (error) throw error;
    },

    async update(id: string, data: EquipamentoForm) {
      const { error } = await db.from('equipamentos').update(data).eq('id', id);
      if (error) throw error;
    },

    async delete(id: string) {
      const { error } = await db.from('equipamentos').delete().eq('id', id);
      if (error) throw error;
    }
  };
};

export const equipmentService = createEquipmentService();
