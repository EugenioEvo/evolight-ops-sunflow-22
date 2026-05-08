import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RDOPeriod = 'mes' | '30d' | '90d';

export interface RDOMetrics {
  totalPeriodo: number;
  pendentes: number;
  aprovados: number;
  rejeitados: number;
  rascunhos: number;
  horasPorObra: { obra: string; horas: number }[];
  horasPorPrestador: { prestador: string; horas: number }[];
}

function periodToStartIso(period: RDOPeriod): string {
  const now = new Date();
  if (period === 'mes') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  const days = period === '30d' ? 30 : 90;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function useRDOMetrics(period: RDOPeriod = 'mes') {
  return useQuery({
    queryKey: ['rdo-metrics', period],
    queryFn: async (): Promise<RDOMetrics> => {
      const startIso = periodToStartIso(period);

      // Outer-join obra (for name) and pull team hours.
      const { data: rdos, error } = await supabase
        .from('rdo_relatorios')
        .select(`
          id, status, data_rdo,
          obra:obras(id, nome),
          equipe:rdo_equipe(prestador_id, horas_trabalhadas, horas_extras)
        `)
        .gte('data_rdo', startIso.slice(0, 10));
      if (error) throw error;

      const list = (rdos ?? []) as any[];

      // Resolve prestador names with a single batch query.
      const prestadorIds = Array.from(
        new Set(list.flatMap((r) => (r.equipe ?? []).map((e: any) => e.prestador_id)).filter(Boolean))
      );
      const nameById = new Map<string, string>();
      if (prestadorIds.length > 0) {
        const { data: pr } = await supabase
          .from('prestadores')
          .select('id, nome')
          .in('id', prestadorIds);
        (pr ?? []).forEach((p: any) => nameById.set(p.id, p.nome));
      }

      const counts = { pendentes: 0, aprovados: 0, rejeitados: 0, rascunhos: 0 };
      const obraMap = new Map<string, number>();
      const prestadorMap = new Map<string, number>();

      for (const r of list) {
        if (r.status === 'pendente') counts.pendentes++;
        else if (r.status === 'aprovado') counts.aprovados++;
        else if (r.status === 'rejeitado') counts.rejeitados++;
        else counts.rascunhos++;

        const obraNome = r.obra?.nome ?? 'Sem obra';
        let totalHorasRDO = 0;
        for (const e of r.equipe ?? []) {
          const h = Number(e.horas_trabalhadas ?? 0) + Number(e.horas_extras ?? 0);
          totalHorasRDO += h;
          const presNome = nameById.get(e.prestador_id) ?? 'Desconhecido';
          prestadorMap.set(presNome, (prestadorMap.get(presNome) ?? 0) + h);
        }
        obraMap.set(obraNome, (obraMap.get(obraNome) ?? 0) + totalHorasRDO);
      }

      const horasPorObra = Array.from(obraMap.entries())
        .map(([obra, horas]) => ({ obra, horas: Math.round(horas * 10) / 10 }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10);

      const horasPorPrestador = Array.from(prestadorMap.entries())
        .map(([prestador, horas]) => ({ prestador, horas: Math.round(horas * 10) / 10 }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10);

      return {
        totalPeriodo: list.length,
        ...counts,
        horasPorObra,
        horasPorPrestador,
      };
    },
    staleTime: 10 * 60_000,
  });
}
