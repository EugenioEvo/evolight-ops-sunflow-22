import { supabase } from "@/integrations/supabase/client";
import type { EquipamentoForm } from "../types";

export const equipmentService = {
  async fetchAll() {
    const { data, error } = await supabase
      .from('equipamentos')
      .select(`*, clientes (id, empresa, profiles (nome))`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async fetchClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select(`id, empresa, profiles (nome)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(data: EquipamentoForm) {
    const { error } = await supabase
      .from('equipamentos')
      .insert([{ ...data, status: 'ativo', nome: data.nome || '', tipo: data.tipo, cliente_id: data.cliente_id || '' }]);
    if (error) throw error;
  },

  async update(id: string, data: EquipamentoForm) {
    const { error } = await supabase.from('equipamentos').update(data).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase.from('equipamentos').delete().eq('id', id);
    if (error) throw error;
  }
};
