import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

export interface SimilarTicket {
  id: string;
  numero_ticket: string;
  titulo: string;
  status: string;
  created_at: string;
}

interface Args {
  clienteId?: string;
  equipamentoTipo?: string;
  excludeId?: string;
  enabled: boolean;
}

const ACTIVE_STATUSES = [
  'aberto',
  'aguardando_aprovacao',
  'aprovado',
  'ordem_servico_gerada',
  'em_execucao',
  'aguardando_rme',
];

/**
 * Detecta tickets similares (mesmo cliente + tipo de equipamento) abertos
 * nas últimas 24h. Aviso suave — não bloqueia criação.
 */
export const useSimilarTickets = ({ clienteId, equipamentoTipo, excludeId, enabled }: Args) => {
  const [similar, setSimilar] = useState<SimilarTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedClienteId = useDebounce(clienteId, 300);
  const debouncedTipo = useDebounce(equipamentoTipo, 300);

  useEffect(() => {
    if (!enabled || !debouncedClienteId || !debouncedTipo) {
      setSimilar([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('tickets')
        .select('id, numero_ticket, titulo, status, created_at')
        .eq('cliente_id', debouncedClienteId)
        .eq('equipamento_tipo', debouncedTipo as any)
        .in('status', ACTIVE_STATUSES as any)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (excludeId) query = query.neq('id', excludeId);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('useSimilarTickets:', error);
        setSimilar([]);
      } else {
        setSimilar((data || []) as SimilarTicket[]);
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedClienteId, debouncedTipo, excludeId, enabled]);

  return { similar, loading };
};
