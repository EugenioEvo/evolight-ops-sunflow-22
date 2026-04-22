import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { InsumoForm } from "../types";

export const createSupplyService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadAll() {
      const [insumosRes, saidasRes, devolucoesRes] = await Promise.all([
        db.from('insumos').select('*').order('nome'),
        (db as any).from('insumo_saidas')
          .select('*, insumo:insumos(nome,unidade), kit:kits(nome), tecnico:tecnicos(id,profile:profiles(nome)), os:ordens_servico(numero_os)')
          .order('created_at', { ascending: false }),
        (db as any).from('insumo_devolucoes').select('*').order('created_at', { ascending: false }),
      ]);
      if (insumosRes.error) throw insumosRes.error;
      return {
        insumos: insumosRes.data || [],
        saidas: (saidasRes as any).data || [],
        devolucoes: (devolucoesRes as any).data || [],
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

    async createSaida(data: {
      insumo_id?: string;
      kit_id?: string;
      quantidade: number;
      retornavel: boolean;
      ordem_servico_id: string;
      tecnico_id: string;
      registrado_por: string;
      observacoes?: string;
    }) {
      const { error } = await (db as any).from('insumo_saidas').insert([data]);
      if (error) throw error;
    },

    async createDevolucao(data: { saida_id: string; quantidade: number; registrada_por: string; observacoes?: string }) {
      const { error } = await (db as any).from('insumo_devolucoes').insert([data]);
      if (error) throw error;
    },

    async aprovarSaida(saidaId: string, aprovadoPor: string) {
      const { error } = await (db as any).from('insumo_saidas')
        .update({ status: 'aprovada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString() })
        .eq('id', saidaId);
      if (error) throw error;
    },

    async rejeitarSaida(saidaId: string, aprovadoPor: string, motivo: string) {
      const { error } = await (db as any).from('insumo_saidas')
        .update({ status: 'rejeitada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString(), rejeitado_motivo: motivo })
        .eq('id', saidaId);
      if (error) throw error;
    },

    async aprovarDevolucao(devId: string, aprovadoPor: string) {
      const { error } = await (db as any).from('insumo_devolucoes')
        .update({ status: 'aprovada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString() })
        .eq('id', devId);
      if (error) throw error;
    },

    async rejeitarDevolucao(devId: string, aprovadoPor: string, motivo: string) {
      const { error } = await (db as any).from('insumo_devolucoes')
        .update({ status: 'rejeitada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString(), rejeitado_motivo: motivo })
        .eq('id', devId);
      if (error) throw error;
    },

    async loadKits() {
      const { data, error } = await (db as any).from('kits')
        .select('*, kit_itens(*, insumo:insumos(nome,unidade))')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },

    async createKit(data: { nome: string; descricao?: string; itens: Array<{ insumo_id: string; quantidade: number }> }) {
      const { data: kit, error } = await (db as any).from('kits').insert({ nome: data.nome, descricao: data.descricao }).select('id').single();
      if (error) throw error;
      if (data.itens.length > 0) {
        const { error: e2 } = await (db as any).from('kit_itens').insert(
          data.itens.map(i => ({ kit_id: kit.id, insumo_id: i.insumo_id, quantidade: i.quantidade }))
        );
        if (e2) throw e2;
      }
    },

    async deleteKit(id: string) {
      const { error } = await (db as any).from('kits').delete().eq('id', id);
      if (error) throw error;
    },

    async getTecnicoOSAtivas(tecnicoId: string) {
      const { data, error } = await (db as any).rpc('get_tecnico_os_ativas', { p_tecnico_id: tecnicoId });
      if (error) throw error;
      return data || [];
    },
  };
};

export const supplyService = createSupplyService();
