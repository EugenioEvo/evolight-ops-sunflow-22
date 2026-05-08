import { supabase } from '@/integrations/supabase/client';
import type { Obra, ObraForm } from '../types';

function normalize(payload: ObraForm) {
  const empty = (v: unknown) => (v === '' || v === undefined ? null : v);
  return {
    nome: payload.nome,
    cliente_id: empty(payload.cliente_id) as string | null,
    responsavel_obra_id: empty(payload.responsavel_obra_id) as string | null,
    endereco: empty(payload.endereco) as string | null,
    cidade: empty(payload.cidade) as string | null,
    estado: empty(payload.estado) as string | null,
    cep: empty(payload.cep) as string | null,
    data_inicio_prevista: empty(payload.data_inicio_prevista) as string | null,
    data_fim_prevista: empty(payload.data_fim_prevista) as string | null,
    data_inicio_real: empty(payload.data_inicio_real) as string | null,
    data_fim_real: empty(payload.data_fim_real) as string | null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    potencia_kwp: payload.potencia_kwp ?? null,
    status: payload.status,
    observacoes: empty(payload.observacoes) as string | null,
  };
}

export const obrasService = {
  async fetchAll(): Promise<Obra[]> {
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const obras = (data || []) as Obra[];

    const clienteIds = Array.from(new Set(obras.map((o) => o.cliente_id).filter(Boolean))) as string[];
    const prestadorIds = Array.from(new Set(obras.map((o) => o.responsavel_obra_id).filter(Boolean))) as string[];

    const [clientesRes, prestadoresRes] = await Promise.all([
      clienteIds.length
        ? supabase.from('clientes').select('id, empresa').in('id', clienteIds)
        : Promise.resolve({ data: [], error: null } as const),
      prestadorIds.length
        ? supabase.from('prestadores').select('id, nome').in('id', prestadorIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    const clienteMap = new Map<string, any>(((clientesRes.data || []) as any[]).map((c) => [c.id as string, c]));
    const prestadorMap = new Map<string, any>(((prestadoresRes.data || []) as any[]).map((p) => [p.id as string, p]));

    return obras.map((o) => ({
      ...o,
      cliente: o.cliente_id ? (clienteMap.get(o.cliente_id) as any) ?? null : null,
      responsavel: o.responsavel_obra_id ? (prestadorMap.get(o.responsavel_obra_id) as any) ?? null : null,
    }));
  },

  async create(payload: ObraForm): Promise<{ id: string }> {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('obras')
      .insert([{ ...normalize(payload), created_by: userData.user?.id ?? null }])
      .select('id')
      .single();
    if (error) throw error;
    return { id: (data as any).id };
  },

  async update(id: string, payload: ObraForm) {
    const { error } = await supabase.from('obras').update(normalize(payload)).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string) {
    const { error } = await supabase.from('obras').delete().eq('id', id);
    if (error) throw error;
  },
};
