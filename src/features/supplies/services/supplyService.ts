import { supabase } from "@/integrations/supabase/client";
import type { InsumoForm, ResponsavelForm } from "../types";

export const supplyService = {
  async loadAll() {
    const [insumosRes, responsaveisRes, movimentacoesRes] = await Promise.all([
      supabase.from('insumos').select('*').order('nome'),
      supabase.from('responsaveis').select('*').eq('ativo', true).order('nome'),
      supabase.from('movimentacoes').select('*, responsaveis (nome, tipo)').order('data_movimentacao', { ascending: false }),
    ]);

    if (insumosRes.error) throw insumosRes.error;
    if (responsaveisRes.error) throw responsaveisRes.error;
    if (movimentacoesRes.error) throw movimentacoesRes.error;

    return {
      insumos: insumosRes.data || [],
      responsaveis: responsaveisRes.data || [],
      movimentacoes: movimentacoesRes.data || [],
    };
  },

  async createInsumo(data: InsumoForm) {
    const { error } = await supabase.from('insumos').insert([data as any]);
    if (error) throw error;
  },

  async updateInsumo(id: string, data: InsumoForm) {
    const { error } = await supabase.from('insumos').update(data as any).eq('id', id);
    if (error) throw error;
  },

  async deleteInsumo(id: string) {
    const { error } = await supabase.from('insumos').delete().eq('id', id);
    if (error) throw error;
  },

  async createMovimentacao(data: { tipo: string; quantidade: number; responsavel_id: string; motivo?: string; observacoes?: string; insumo_id: string }) {
    const { error } = await supabase.from('movimentacoes').insert([data as any]);
    if (error) throw error;
  },

  async createResponsavel(data: ResponsavelForm) {
    const { error } = await supabase.from('responsaveis').insert([data as any]);
    if (error) throw error;
  },
};
