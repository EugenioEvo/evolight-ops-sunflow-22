import { supabase } from '@/integrations/supabase/client';
import type { RDORelatorio } from '../types';

export interface RDOEquipe {
  id?: string;
  prestador_id: string;
  funcao?: string | null;
  horas_trabalhadas?: number | null;
  horas_extras?: number | null;
  observacoes?: string | null;
}

export interface RDOAtividade {
  id?: string;
  catalogo_id?: string | null;
  descricao_livre?: string | null;
  quantidade: number;
  unidade?: string | null;
  percentual_avanco?: number | null;
  observacoes?: string | null;
}

export interface RDOEquipamento {
  id?: string;
  nome: string;
  quantidade: number;
  observacoes?: string | null;
}

export interface RDOEvidencia {
  id: string;
  tipo: string;
  storage_path: string;
  descricao: string | null;
}

export interface RDOFull extends RDORelatorio {
  equipe: RDOEquipe[];
  atividades: RDOAtividade[];
  equipamentos: RDOEquipamento[];
  evidencias: RDOEvidencia[];
}

export interface CatalogoItem {
  id: string;
  item_key: string;
  label: string;
  unidade: string;
  categoria: string;
  sort_order: number | null;
}

export interface EletromecanicoOption {
  id: string;
  nome: string;
  categoria: string;
}

export const rdoService = {
  async fetchAll(): Promise<RDORelatorio[]> {
    const { data, error } = await supabase
      .from('rdo_relatorios')
      .select('*')
      .order('data_rdo', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rdos = (data || []) as RDORelatorio[];

    const obraIds = Array.from(new Set(rdos.map((r) => r.obra_id).filter(Boolean))) as string[];
    const respIds = Array.from(new Set(rdos.map((r) => r.responsavel_id).filter(Boolean))) as string[];

    const [obrasRes, prestadoresRes] = await Promise.all([
      obraIds.length
        ? supabase.from('obras').select('id, nome, cidade, estado').in('id', obraIds)
        : Promise.resolve({ data: [], error: null } as const),
      respIds.length
        ? supabase.from('prestadores').select('id, nome').in('id', respIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    const obraMap = new Map<string, any>(((obrasRes.data || []) as any[]).map((o) => [o.id, o]));
    const respMap = new Map<string, any>(((prestadoresRes.data || []) as any[]).map((p) => [p.id, p]));

    return rdos.map((r) => ({
      ...r,
      obra: obraMap.get(r.obra_id) ?? null,
      responsavel: respMap.get(r.responsavel_id) ?? null,
    }));
  },

  async getById(id: string): Promise<RDOFull | null> {
    const { data: rdo, error } = await supabase.from('rdo_relatorios').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!rdo) return null;

    const [equipeRes, atividadesRes, equipamentosRes, evidenciasRes, obraRes, respRes] = await Promise.all([
      supabase.from('rdo_equipe').select('*').eq('rdo_id', id),
      supabase.from('rdo_atividades').select('*').eq('rdo_id', id),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', id),
      supabase.from('rdo_evidencias').select('*').eq('rdo_id', id),
      supabase.from('obras').select('id, nome, cidade, estado').eq('id', rdo.obra_id).maybeSingle(),
      supabase.from('prestadores').select('id, nome').eq('id', rdo.responsavel_id).maybeSingle(),
    ]);

    return {
      ...(rdo as any),
      obra: obraRes.data ?? null,
      responsavel: respRes.data ?? null,
      equipe: (equipeRes.data || []) as RDOEquipe[],
      atividades: (atividadesRes.data || []) as RDOAtividade[],
      equipamentos: (equipamentosRes.data || []) as RDOEquipamento[],
      evidencias: (evidenciasRes.data || []) as RDOEvidencia[],
    } as RDOFull;
  },

  async listObrasAtivas(): Promise<{ id: string; nome: string; cidade: string | null; estado: string | null }[]> {
    const { data, error } = await supabase
      .from('obras')
      .select('id, nome, cidade, estado')
      .in('status', ['planejada', 'em_execucao', 'pausada'])
      .order('nome');
    if (error) throw error;
    return (data || []) as any;
  },

  async listCatalogo(): Promise<CatalogoItem[]> {
    const { data, error } = await supabase
      .from('rdo_atividades_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('categoria')
      .order('sort_order')
      .order('label');
    if (error) throw error;
    return (data || []) as CatalogoItem[];
  },

  async listEletromecanicos(): Promise<EletromecanicoOption[]> {
    const { data, error } = await supabase
      .from('prestadores')
      .select('id, nome, categoria')
      .in('categoria', ['eletromecanico', 'sup_eletromecanico'])
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return (data || []) as EletromecanicoOption[];
  },

  async getCurrentPrestadorId(profileId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('tecnicos')
      .select('prestador_id')
      .eq('profile_id', profileId)
      .not('prestador_id', 'is', null)
      .maybeSingle();
    if (error) throw error;
    return (data?.prestador_id as string | null) ?? null;
  },

  async createDraft(input: {
    obra_id: string;
    data_rdo: string;
    responsavel_id: string;
    turno?: string | null;
    clima?: string | null;
    temperatura_c?: number | null;
    horario_inicio?: string | null;
    horario_fim?: string | null;
    condicoes_canteiro?: string | null;
  }): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    const numeroRdoRes = await supabase.rpc('gerar_numero_rdo');
    if (numeroRdoRes.error) throw numeroRdoRes.error;
    const numero_rdo = numeroRdoRes.data as string;

    const { data, error } = await supabase
      .from('rdo_relatorios')
      .insert([{
        ...input,
        numero_rdo,
        status: 'rascunho',
        created_by: userData.user?.id ?? null,
      }])
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  async updateHeader(id: string, patch: Partial<{
    obra_id: string;
    data_rdo: string;
    turno: string | null;
    clima: string | null;
    temperatura_c: number | null;
    horario_inicio: string | null;
    horario_fim: string | null;
    condicoes_canteiro: string | null;
    observacoes_gerais: string | null;
    ocorrencias: string | null;
    atrasos: string | null;
    restricoes: string | null;
    assinatura_responsavel: string | null;
  }>) {
    const { error } = await supabase.from('rdo_relatorios').update(patch).eq('id', id);
    if (error) throw error;
  },

  async replaceEquipe(rdoId: string, items: RDOEquipe[]) {
    const del = await supabase.from('rdo_equipe').delete().eq('rdo_id', rdoId);
    if (del.error) throw del.error;
    if (items.length === 0) return;
    const { error } = await supabase.from('rdo_equipe').insert(
      items.map((i) => ({
        rdo_id: rdoId,
        prestador_id: i.prestador_id,
        funcao: i.funcao ?? null,
        horas_trabalhadas: i.horas_trabalhadas ?? 0,
        horas_extras: i.horas_extras ?? 0,
        observacoes: i.observacoes ?? null,
      })),
    );
    if (error) throw error;
  },

  async replaceAtividades(rdoId: string, items: RDOAtividade[]) {
    const del = await supabase.from('rdo_atividades').delete().eq('rdo_id', rdoId);
    if (del.error) throw del.error;
    if (items.length === 0) return;
    const { error } = await supabase.from('rdo_atividades').insert(
      items.map((i) => ({
        rdo_id: rdoId,
        catalogo_id: i.catalogo_id ?? null,
        descricao_livre: i.descricao_livre ?? null,
        quantidade: i.quantidade ?? 0,
        unidade: i.unidade ?? null,
        percentual_avanco: i.percentual_avanco ?? null,
        observacoes: i.observacoes ?? null,
      })),
    );
    if (error) throw error;
  },

  async replaceEquipamentos(rdoId: string, items: RDOEquipamento[]) {
    const del = await supabase.from('rdo_equipamentos').delete().eq('rdo_id', rdoId);
    if (del.error) throw del.error;
    if (items.length === 0) return;
    const { error } = await supabase.from('rdo_equipamentos').insert(
      items.map((i) => ({
        rdo_id: rdoId,
        nome: i.nome,
        quantidade: i.quantidade ?? 1,
        observacoes: i.observacoes ?? null,
      })),
    );
    if (error) throw error;
  },

  async uploadEvidencia(rdoId: string, file: File, tipo: string, descricao?: string) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${rdoId}/${tipo}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from('rdo-evidences').upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const { error } = await supabase.from('rdo_evidencias').insert([{
      rdo_id: rdoId, tipo, storage_path: path, descricao: descricao ?? null,
    }]);
    if (error) throw error;
  },

  async removeEvidencia(id: string, storage_path: string) {
    await supabase.storage.from('rdo-evidences').remove([storage_path]);
    const { error } = await supabase.from('rdo_evidencias').delete().eq('id', id);
    if (error) throw error;
  },

  async buildPDFData(id: string): Promise<import('@/utils/generateRDOPDF').RDOPDFData | null> {
    const full = await this.getById(id);
    if (!full) return null;

    // Resolve prestador names for equipe + responsavel
    const prestadorIds = Array.from(new Set([
      full.responsavel_id,
      ...full.equipe.map((e) => e.prestador_id),
    ].filter(Boolean))) as string[];

    const presMap = new Map<string, string>();
    if (prestadorIds.length) {
      const { data } = await supabase.from('prestadores').select('id, nome').in('id', prestadorIds);
      for (const p of (data || []) as any[]) presMap.set(p.id, p.nome);
    }

    // Resolve catalog labels for atividades
    const catIds = Array.from(new Set(full.atividades.map((a) => a.catalogo_id).filter(Boolean))) as string[];
    const catMap = new Map<string, { label: string; unidade: string }>();
    if (catIds.length) {
      const { data } = await supabase.from('rdo_atividades_catalogo').select('id, label, unidade').in('id', catIds);
      for (const c of (data || []) as any[]) catMap.set(c.id, { label: c.label, unidade: c.unidade });
    }

    // Resolve signed URLs for evidencias
    const evidencias = await Promise.all(
      full.evidencias.map(async (ev) => ({
        tipo: ev.tipo,
        descricao: ev.descricao,
        url: (await this.signedUrl(ev.storage_path)) ?? '',
      })),
    );

    return {
      numero_rdo: full.numero_rdo,
      data_rdo: full.data_rdo,
      status: full.status,
      obra: full.obra ? { nome: full.obra.nome, cidade: full.obra.cidade, estado: full.obra.estado } : null,
      responsavel: { nome: presMap.get(full.responsavel_id) ?? '—' },
      turno: full.turno,
      clima: full.clima,
      temperatura_c: full.temperatura_c,
      horario_inicio: full.horario_inicio,
      horario_fim: full.horario_fim,
      condicoes_canteiro: full.condicoes_canteiro,
      observacoes_gerais: full.observacoes_gerais,
      ocorrencias: full.ocorrencias,
      atrasos: full.atrasos,
      restricoes: full.restricoes,
      observacoes_aprovacao: full.observacoes_aprovacao,
      data_aprovacao: full.data_aprovacao,
      equipe: full.equipe.map((e) => ({
        nome: presMap.get(e.prestador_id) ?? '—',
        funcao: e.funcao,
        horas_trabalhadas: e.horas_trabalhadas,
        horas_extras: e.horas_extras,
      })),
      atividades: full.atividades.map((a) => {
        const cat = a.catalogo_id ? catMap.get(a.catalogo_id) : null;
        return {
          descricao: a.descricao_livre || cat?.label || '—',
          quantidade: a.quantidade,
          unidade: a.unidade || cat?.unidade || null,
          percentual_avanco: a.percentual_avanco,
        };
      }),
      equipamentos: full.equipamentos.map((eq) => ({
        nome: eq.nome, quantidade: eq.quantidade, observacoes: eq.observacoes,
      })),
      evidencias,
      assinatura_responsavel: (full as any).assinatura_responsavel ?? null,
      assinatura_aprovador: (full as any).assinatura_aprovador ?? null,
    };
  },

  async signedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from('rdo-evidences').createSignedUrl(path, 60 * 60 * 24 * 365);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async submitForApproval(id: string, assinatura: string) {
    const { error } = await supabase
      .from('rdo_relatorios')
      .update({ status: 'pendente', assinatura_responsavel: assinatura })
      .eq('id', id);
    if (error) throw error;

    // Fire-and-forget: notify staff (email + in-app)
    supabase.functions
      .invoke('send-rdo-submitted-email', { body: { rdo_id: id } })
      .catch((e) => console.warn('send-rdo-submitted-email failed:', e));
    notifyRDOStaffSubmitted(id).catch((e) => console.warn('notifyRDOStaffSubmitted failed:', e));
  },

  async remove(id: string) {
    const { error } = await supabase.from('rdo_relatorios').delete().eq('id', id);
    if (error) throw error;
  },

  async approve(id: string, observacoes?: string) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('rdo_relatorios')
      .update({
        status: 'aprovado',
        aprovado_por: userData.user?.id ?? null,
        data_aprovacao: new Date().toISOString(),
        observacoes_aprovacao: observacoes ?? null,
      })
      .eq('id', id);
    if (error) throw error;
    supabase.functions
      .invoke('send-rdo-decision-email', { body: { rdo_id: id, decision: 'aprovado', motivo: observacoes ?? '' } })
      .catch((e) => console.warn('send-rdo-decision-email approve failed:', e));
    notifyRDOTeamDecision(id, 'aprovado', observacoes).catch((e) =>
      console.warn('notifyRDOTeamDecision approve failed:', e),
    );
  },

  async reject(id: string, motivo: string) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('rdo_relatorios')
      .update({
        status: 'rejeitado',
        aprovado_por: userData.user?.id ?? null,
        data_aprovacao: new Date().toISOString(),
        observacoes_aprovacao: motivo,
      })
      .eq('id', id);
    if (error) throw error;
    supabase.functions
      .invoke('send-rdo-decision-email', { body: { rdo_id: id, decision: 'rejeitado', motivo } })
      .catch((e) => console.warn('send-rdo-decision-email reject failed:', e));
    notifyRDOTeamDecision(id, 'rejeitado', motivo).catch((e) =>
      console.warn('notifyRDOTeamDecision reject failed:', e),
    );
  },
};

// ---------- In-app notification helpers ----------

async function notifyRDOStaffSubmitted(rdoId: string) {
  const { data: rdo } = await supabase
    .from('rdo_relatorios')
    .select('numero_rdo, obra_id')
    .eq('id', rdoId)
    .maybeSingle();
  if (!rdo) return;

  const { data: obra } = await supabase
    .from('obras').select('nome').eq('id', (rdo as any).obra_id).maybeSingle();

  const { data: staffRoles } = await supabase
    .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao']);
  const userIds = Array.from(new Set((staffRoles || []).map((r: any) => r.user_id)));
  if (userIds.length === 0) return;

  const titulo = 'Novo RDO para aprovação';
  const mensagem = `RDO ${(rdo as any).numero_rdo} (${(obra as any)?.nome ?? 'Obra'}) aguarda sua aprovação.`;
  const rows = userIds.map((uid) => ({
    user_id: uid, tipo: 'rdo_submetido', titulo, mensagem, link: '/gerenciar-rdo',
  }));
  await supabase.from('notificacoes').insert(rows);
}

async function notifyRDOTeamDecision(rdoId: string, decision: 'aprovado' | 'rejeitado', motivo?: string) {
  const { data: rdo } = await supabase
    .from('rdo_relatorios')
    .select('numero_rdo, responsavel_id, obra_id')
    .eq('id', rdoId)
    .maybeSingle();
  if (!rdo) return;

  const { data: equipe } = await supabase
    .from('rdo_equipe').select('prestador_id').eq('rdo_id', rdoId);

  const prestadorIds = new Set<string>();
  if ((rdo as any).responsavel_id) prestadorIds.add((rdo as any).responsavel_id);
  for (const e of equipe || []) prestadorIds.add((e as any).prestador_id);
  if (prestadorIds.size === 0) return;

  // prestador → tecnico.profile_id → profile.user_id
  const { data: tecs } = await supabase
    .from('tecnicos')
    .select('prestador_id, profiles!inner(user_id)')
    .in('prestador_id', Array.from(prestadorIds));

  const userIds = Array.from(new Set((tecs || [])
    .map((t: any) => t.profiles?.user_id)
    .filter(Boolean) as string[]));
  if (userIds.length === 0) return;

  const isApproved = decision === 'aprovado';
  const titulo = isApproved ? 'RDO Aprovado' : 'RDO Rejeitado';
  const motivoText = (motivo || '').trim();
  const mensagem = isApproved
    ? `O RDO ${(rdo as any).numero_rdo} foi aprovado.${motivoText ? ` Observações: ${motivoText}` : ''}`
    : `O RDO ${(rdo as any).numero_rdo} foi rejeitado.${motivoText ? ` Motivo: ${motivoText}` : ''}`;

  const rows = userIds.map((uid) => ({
    user_id: uid,
    tipo: isApproved ? 'rdo_aprovado' : 'rdo_rejeitado',
    titulo, mensagem,
    link: `/rdo/${rdoId}`,
  }));
  await supabase.from('notificacoes').insert(rows);
}
