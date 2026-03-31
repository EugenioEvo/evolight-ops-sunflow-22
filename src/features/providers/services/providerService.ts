import { supabase } from "@/integrations/supabase/client";
import type { PrestadorForm } from "../types";

export const providerService = {
  async fetchAll() {
    const { data, error } = await supabase
      .from('prestadores')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(data: PrestadorForm) {
    const { error } = await supabase
      .from('prestadores')
      .insert([{ ...data, ativo: true, nome: data.nome || '', email: data.email || '', categoria: data.categoria || '' }]);
    if (error) throw error;
  },

  async update(id: string, data: PrestadorForm) {
    const { error } = await supabase.from('prestadores').update(data).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string) {
    const { error } = await supabase.from('prestadores').delete().eq('id', id);
    if (error) throw error;
  },

  async approve(id: string) {
    const { error } = await supabase.from('prestadores').update({ ativo: true }).eq('id', id);
    if (error) throw error;
  },
};
