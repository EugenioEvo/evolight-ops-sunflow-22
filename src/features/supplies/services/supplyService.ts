import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { InsumoForm, ResponsavelForm } from "../types";

export const createSupplyService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadAll() {
      const [insumosRes, responsaveisRes, movimentacoesRes] = await Promise.all([
        db.from('insumos').select('*').order('nome'),
        db.from('responsaveis').select('*').eq('ativo', true).order('nome'),
        db.from('movimentacoes').select('*, responsaveis (nome, tipo)').order('data_movimentacao', { ascending: false }),
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
      const { error } = await db.from('insumos').insert([data as any]);
      if (error) throw error;
    },

    async updateInsumo(id: string, data: InsumoForm) {
      const { error } = await db.from('insumos').update(data as any).eq('id', id);
      if (error) throw error;
    },

    async deleteInsumo(id: string) {
      const { error } = await db.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },

    async createMovimentacao(data: { tipo: string; quantidade: number; responsavel_id: string; motivo?: string; observacoes?: string; insumo_id: string }) {
      const { error } = await db.from('movimentacoes').insert([data as any]);
      if (error) throw error;
    },

    async createResponsavel(data: ResponsavelForm) {
      const { error } = await db.from('responsaveis').insert([data as any]);
      if (error) throw error;
    },
  };
};

export const supplyService = createSupplyService();
