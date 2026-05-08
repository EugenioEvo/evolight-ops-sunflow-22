import { supabase } from '@/integrations/supabase/client';

export interface ObraMeta {
  id: string;
  obra_id: string;
  catalogo_id: string;
  quantidade_meta: number;
  unidade: string | null;
  observacoes: string | null;
}

export interface ObraMetaInput {
  catalogo_id: string;
  quantidade_meta: number;
  unidade?: string | null;
  observacoes?: string | null;
}

export const obraMetasService = {
  async listByObra(obraId: string): Promise<ObraMeta[]> {
    const { data, error } = await supabase
      .from('obra_metas_catalogo')
      .select('*')
      .eq('obra_id', obraId);
    if (error) throw error;
    return (data || []) as ObraMeta[];
  },

  async upsertMany(obraId: string, metas: ObraMetaInput[]): Promise<void> {
    if (metas.length === 0) return;
    const rows = metas.map((m) => ({
      obra_id: obraId,
      catalogo_id: m.catalogo_id,
      quantidade_meta: m.quantidade_meta,
      unidade: m.unidade ?? null,
      observacoes: m.observacoes ?? null,
    }));
    const { error } = await supabase
      .from('obra_metas_catalogo')
      .upsert(rows, { onConflict: 'obra_id,catalogo_id' });
    if (error) throw error;
  },

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.from('obra_metas_catalogo').delete().in('id', ids);
    if (error) throw error;
  },

  async progressoObra(obraId: string): Promise<Array<{
    catalogo_id: string;
    label: string;
    categoria: string;
    unidade: string;
    meta: number;
    realizado: number;
    pct: number;
  }>> {
    const [metasRes, catalogoRes, rdosRes] = await Promise.all([
      supabase.from('obra_metas_catalogo').select('*').eq('obra_id', obraId),
      supabase.from('rdo_atividades_catalogo').select('id, label, categoria, unidade').eq('ativo', true),
      supabase
        .from('rdo_relatorios')
        .select('id, atividades:rdo_atividades(catalogo_id, quantidade)')
        .eq('obra_id', obraId)
        .eq('status', 'aprovado'),
    ]);
    if (metasRes.error) throw metasRes.error;
    if (catalogoRes.error) throw catalogoRes.error;
    if (rdosRes.error) throw rdosRes.error;

    const catMap = new Map<string, { label: string; categoria: string; unidade: string }>();
    for (const c of (catalogoRes.data || []) as any[]) catMap.set(c.id, c);

    const realizados = new Map<string, number>();
    for (const r of (rdosRes.data || []) as any[]) {
      for (const a of r.atividades ?? []) {
        if (!a.catalogo_id) continue;
        realizados.set(a.catalogo_id, (realizados.get(a.catalogo_id) ?? 0) + Number(a.quantidade ?? 0));
      }
    }

    return ((metasRes.data || []) as ObraMeta[]).map((m) => {
      const cat = catMap.get(m.catalogo_id);
      const meta = Number(m.quantidade_meta ?? 0);
      const realizado = realizados.get(m.catalogo_id) ?? 0;
      const pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;
      return {
        catalogo_id: m.catalogo_id,
        label: cat?.label ?? '—',
        categoria: cat?.categoria ?? '',
        unidade: m.unidade ?? cat?.unidade ?? '',
        meta,
        realizado,
        pct: Math.round(pct * 10) / 10,
      };
    }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.label.localeCompare(b.label));
  },
};
