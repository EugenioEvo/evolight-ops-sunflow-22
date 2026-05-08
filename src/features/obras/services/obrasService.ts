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
    potencia_kwp: payload.potencia_kwp ?? null,
    status: payload.status,
    observacoes: empty(payload.observacoes) as string | null,
  };
}

export const obrasService = {
  async fetchAll(): Promise<Obra[]> {
    const { data, error } = await supabase
      .from('obras')
      .select('*, cliente:clientes(id, empresa), responsavel:prestadores!obras_responsavel_obra_id_fkey(id, nome)')
      .order('created_at', { ascending: false });
    if (error) {
      // fallback without FK alias if relation name differs
      const fb = await supabase.from('obras').select('*').order('created_at', { ascending: false });
      if (fb.error) throw fb.error;
      return (fb.data || []) as Obra[];
    }
    return (data || []) as unknown as Obra[];
  },

  async create(payload: ObraForm) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('obras')
      .insert([{ ...normalize(payload), created_by: userData.user?.id ?? null }]);
    if (error) throw error;
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
