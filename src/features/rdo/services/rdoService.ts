import { supabase } from '@/integrations/supabase/client';
import type { RDORelatorio } from '../types';

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

  async remove(id: string) {
    const { error } = await supabase.from('rdo_relatorios').delete().eq('id', id);
    if (error) throw error;
  },
};
