import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { InsumoForm, CompraForm, DevolucaoEvidencia, MinhaDevolucao, InsumoMidia } from "../types";

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

    /** Upload de fotos/vídeos do cadastro do insumo. Retorna mídias com URL assinada (1 ano). */
    async uploadInsumoMidias(insumoId: string, files: File[]): Promise<InsumoMidia[]> {
      const out: InsumoMidia[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${insumoId}/${name}`;
        const { error: upErr } = await (db as any).storage
          .from('insumo-midias')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await (db as any).storage
          .from('insumo-midias')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        out.push({
          path,
          url: signed?.signedUrl || '',
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name,
        });
      }
      return out;
    },

    async removeInsumoMidia(path: string) {
      await (db as any).storage.from('insumo-midias').remove([path]);
    },


    async createSaida(data: {
      insumo_id?: string;
      kit_id?: string;
      quantidade: number;
      retornavel: boolean;
      ordem_servico_id?: string;
      obra_id?: string | null;
      tecnico_id: string;
      registrado_por: string;
      observacoes?: string;
      lote_id?: string;
      uso_interno?: boolean;
      evidencias?: DevolucaoEvidencia[];
    }) {
      const { error } = await (db as any).from('insumo_saidas').insert([data]);
      if (error) throw error;
    },

    /** Upload de fotos/vídeos para evidência da SAÍDA do item. Retorna mídias com URL assinada (1 ano). */
    async uploadSaidaEvidencias(loteId: string, files: File[]): Promise<DevolucaoEvidencia[]> {
      const out: DevolucaoEvidencia[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${loteId}/${name}`;
        const { error: upErr } = await (db as any).storage
          .from('saida-evidencias')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await (db as any).storage
          .from('saida-evidencias')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        out.push({
          path,
          url: signed?.signedUrl || '',
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name,
        });
      }
      return out;
    },

    async createDevolucao(data: {
      saida_id: string;
      quantidade: number;
      registrada_por: string;
      observacoes?: string;
      evidencias?: DevolucaoEvidencia[];
    }) {
      // RPC propaga a devolução para todas as saídas-irmãs do mesmo lote (multi-OS)
      const { error } = await (db as any).rpc('register_devolucao_lote', {
        p_saida_id: data.saida_id,
        p_quantidade: data.quantidade,
        p_observacoes: data.observacoes ?? null,
        p_evidencias: data.evidencias ?? [],
      });
      if (error) throw error;
    },

    /** Registra entrada pendente (sobra de item NÃO retornável) */
    async createEntradaPendente(data: {
      saida_id: string;
      quantidade: number;
      registrada_por: string;
      observacoes?: string;
      evidencias?: DevolucaoEvidencia[];
    }) {
      const { error } = await (db as any).from('insumo_entradas_pendentes').insert([{
        saida_id: data.saida_id,
        quantidade: data.quantidade,
        registrada_por: data.registrada_por,
        observacoes: data.observacoes ?? null,
        evidencias: data.evidencias ?? [],
      }]);
      if (error) throw error;
    },

    async aprovarEntradaPendente(id: string, aprovadoPor: string) {
      const { error } = await (db as any).from('insumo_entradas_pendentes')
        .update({ status: 'aprovada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    async rejeitarEntradaPendente(id: string, aprovadoPor: string, motivo: string) {
      const { error } = await (db as any).from('insumo_entradas_pendentes')
        .update({ status: 'rejeitada', aprovado_por: aprovadoPor, aprovado_at: new Date().toISOString(), rejeitado_motivo: motivo })
        .eq('id', id);
      if (error) throw error;
    },

    async getBackofficeDevolucoes() {
      const { data, error } = await (db as any).rpc('get_backoffice_devolucoes');
      if (error) throw error;
      return data || [];
    },

    async getBackofficeEntradasPendentes() {
      const { data, error } = await (db as any).rpc('get_backoffice_entradas_pendentes');
      if (error) throw error;
      return data || [];
    },

    /** Upload de fotos/vídeos para evidência da devolução. Retorna array com URLs assinadas (1 ano). */
    async uploadDevolucaoEvidencias(saidaId: string, files: File[]): Promise<DevolucaoEvidencia[]> {
      const out: DevolucaoEvidencia[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${saidaId}/${name}`;
        const { error: upErr } = await (db as any).storage
          .from('devolucao-evidencias')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await (db as any).storage
          .from('devolucao-evidencias')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (sErr) throw sErr;
        out.push({
          path,
          url: signed?.signedUrl || '',
          type: file.type.startsWith('video/') ? 'video' : 'image',
          name: file.name,
        });
      }
      return out;
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

    async createCompra(data: CompraForm & { registrado_por: string }) {
      const { error } = await (db as any).from('insumo_compras').insert([{
        insumo_id: data.insumo_id,
        quantidade: data.quantidade,
        valor_unitario: data.valor_unitario,
        fornecedor: data.fornecedor || null,
        observacoes: data.observacoes || null,
        registrado_por: data.registrado_por,
      }]);
      if (error) throw error;
    },

    async getMinhasDevolucoes(): Promise<MinhaDevolucao[]> {
      const { data, error } = await (db as any).rpc('get_minhas_devolucoes');
      if (error) throw error;
      return (data as MinhaDevolucao[]) || [];
    },
  };
};

export const supplyService = createSupplyService();
