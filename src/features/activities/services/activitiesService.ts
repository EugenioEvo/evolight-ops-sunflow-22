import { supabase } from '@/integrations/supabase/client';
import type { ActivityRow } from '../types';

const sel = (s: string): string => s;

function parseHm(v?: string | null): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

function hoursBetween(start?: string | null, end?: string | null): number | null {
  const s = parseHm(start);
  const e = parseHm(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24; // virada de dia
  return Math.round(diff * 100) / 100;
}

function toDay(v?: string | null): string {
  if (!v) return '';
  return String(v).slice(0, 10);
}

export const activitiesService = {
  async fetchAll(): Promise<ActivityRow[]> {
    const [equipeRes, rdosRes, rmesRes, allOsRes] = await Promise.all([
      supabase.from('rdo_equipe').select(sel('id, rdo_id, prestador_id, horas_trabalhadas, horas_extras')),
      supabase.from('rdo_relatorios').select(sel('id, numero_rdo, data_rdo, obra_id, status')),
      supabase
        .from('rme_relatorios')
        .select(
          sel(
            'id, tecnico_id, ordem_servico_id, ticket_id, data_execucao, data_fim_execucao, start_time, end_time, status',
          ),
        ),
      supabase
        .from('ordens_servico')
        .select(
          sel(
            'id, numero_os, ticket_id, tecnico_id, data_programada, hora_inicio, hora_fim, duracao_estimada_min, aceite_tecnico',
          ),
        ),
    ]);
    if (equipeRes.error) throw equipeRes.error;
    if (rdosRes.error) throw rdosRes.error;
    if (rmesRes.error) throw rmesRes.error;
    if (allOsRes.error) throw allOsRes.error;

    const equipe = (equipeRes.data ?? []) as any[];
    const rdos = (rdosRes.data ?? []) as any[];
    const rmes = (rmesRes.data ?? []) as any[];
    const allOs = (allOsRes.data ?? []) as any[];

    // OS sem RME (o RME é compartilhado por ticket entre OSs-irmãs)
    const ticketsComRme = new Set(rmes.map((r) => r.ticket_id).filter(Boolean));
    const osComRme = new Set(rmes.map((r) => r.ordem_servico_id).filter(Boolean));
    const osPendentes = allOs.filter(
      (o) => !osComRme.has(o.id) && !ticketsComRme.has(o.ticket_id),
    );

    const obraIds = [...new Set(rdos.map((r) => r.obra_id).filter(Boolean))];
    const osIds = [
      ...new Set([
        ...rmes.map((r) => r.ordem_servico_id).filter(Boolean),
        ...osPendentes.map((o) => o.id),
      ]),
    ];
    const ticketIds = [
      ...new Set([
        ...rmes.map((r) => r.ticket_id).filter(Boolean),
        ...osPendentes.map((o) => o.ticket_id).filter(Boolean),
      ]),
    ];
    const tecnicoIds = [
      ...new Set([
        ...rmes.map((r) => r.tecnico_id).filter(Boolean),
        ...osPendentes.map((o) => o.tecnico_id).filter(Boolean),
      ]),
    ];

    const empty = { data: [] as any[], error: null };
    const [obrasRes, osRes, hpRes, ticketsRes, tecnicosRes] = await Promise.all([
      obraIds.length ? supabase.from('obras').select(sel('id, nome')).in('id', obraIds) : empty,
      osIds.length
        ? supabase
            .from('ordens_servico')
            .select(sel('id, numero_os, hora_inicio, hora_fim, duracao_estimada_min'))
            .in('id', osIds)
        : empty,
      osIds.length
        ? supabase
            .from('horas_previstas_os')
            .select(sel('ordem_servico_id, tecnico_id, minutos_previstos'))
            .in('ordem_servico_id', osIds)
        : empty,
      ticketIds.length
        ? supabase
            .from('tickets')
            .select(sel('id, numero_ticket, cliente_id, status, data_servico'))
            .in('id', ticketIds)
        : empty,
      tecnicoIds.length
        ? supabase.from('tecnicos').select(sel('id, prestador_id, profile_id')).in('id', tecnicoIds)
        : empty,
    ]);


    const tickets = (ticketsRes.data ?? []) as any[];
    const tecnicos = (tecnicosRes.data ?? []) as any[];
    const clienteIds = [...new Set(tickets.map((t) => t.cliente_id).filter(Boolean))];
    const prestadorIds = [
      ...new Set([
        ...equipe.map((e) => e.prestador_id).filter(Boolean),
        ...tecnicos.map((t) => t.prestador_id).filter(Boolean),
      ]),
    ];
    const profileIds = [...new Set(tecnicos.map((t) => t.profile_id).filter(Boolean))];

    const [clientesRes, prestadoresRes, profilesRes] = await Promise.all([
      clienteIds.length ? supabase.from('clientes').select(sel('id, empresa')).in('id', clienteIds) : empty,
      prestadorIds.length ? supabase.from('prestadores').select(sel('id, nome')).in('id', prestadorIds) : empty,
      profileIds.length ? supabase.from('profiles').select(sel('id, nome')).in('id', profileIds) : empty,
    ]);

    const obraMap = new Map((obrasRes.data ?? []).map((o: any) => [o.id, o.nome]));
    const osMap = new Map((osRes.data ?? []).map((o: any) => [o.id, o]));
    const hpMap = new Map(
      (hpRes.data ?? []).map((h: any) => [`${h.ordem_servico_id}:${h.tecnico_id}`, h.minutos_previstos]),
    );
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));
    const clienteMap = new Map((clientesRes.data ?? []).map((c: any) => [c.id, c.empresa]));
    const prestadorMap = new Map((prestadoresRes.data ?? []).map((p: any) => [p.id, p.nome]));
    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.nome]));
    const rdoMap = new Map(rdos.map((r) => [r.id, r]));
    const tecnicoMap = new Map(tecnicos.map((t) => [t.id, t]));

    const rows: ActivityRow[] = [];

    for (const e of equipe) {
      const rdo = rdoMap.get(e.rdo_id);
      if (!rdo) continue;
      const reais =
        e.horas_trabalhadas === null || e.horas_trabalhadas === undefined
          ? null
          : Number(e.horas_trabalhadas) + Number(e.horas_extras ?? 0);
      rows.push({
        id: `rdo-${e.id}`,
        tipo: 'RDO',
        data: toDay(rdo.data_rdo),
        pessoaId: e.prestador_id ?? null,
        pessoaNome: prestadorMap.get(e.prestador_id) ?? 'Não identificado',
        destino: obraMap.get(rdo.obra_id) ?? '—',
        numero: rdo.numero_rdo ?? '—',
        status: rdo.status ?? null,
        horasMeta: 8,
        horasReais: reais,
        link: `/rdo/${rdo.id}`,
      });
    }

    for (const r of rmes) {
      const tec = tecnicoMap.get(r.tecnico_id);
      const nome =
        (tec?.prestador_id ? prestadorMap.get(tec.prestador_id) : null) ??
        (tec?.profile_id ? profileMap.get(tec.profile_id) : null) ??
        'Não identificado';
      const os = r.ordem_servico_id ? osMap.get(r.ordem_servico_id) : null;
      const ticket = r.ticket_id ? ticketMap.get(r.ticket_id) : null;

      const minutosPrev = hpMap.get(`${r.ordem_servico_id}:${r.tecnico_id}`);
      let meta: number | null = null;
      if (minutosPrev) meta = Math.round((Number(minutosPrev) / 60) * 100) / 100;
      else if (os?.duracao_estimada_min) meta = Math.round((Number(os.duracao_estimada_min) / 60) * 100) / 100;
      else meta = hoursBetween(os?.hora_inicio, os?.hora_fim);

      let reais = hoursBetween(r.start_time, r.end_time);
      if (reais === null && r.data_execucao && r.data_fim_execucao) {
        const ms = new Date(r.data_fim_execucao).getTime() - new Date(r.data_execucao).getTime();
        if (ms > 0) reais = Math.round((ms / 3_600_000) * 100) / 100;
      }

      rows.push({
        id: `rme-${r.id}`,
        tipo: 'RME',
        data: toDay(r.data_execucao),
        pessoaId: r.tecnico_id ?? null,
        pessoaNome: nome,
        destino: (ticket?.cliente_id ? clienteMap.get(ticket.cliente_id) : null) ?? '—',
        numero: os?.numero_os ?? ticket?.numero_ticket ?? '—',
        status: r.status ?? null,
        horasMeta: meta,
        horasReais: reais,
        link: `/rme-wizard/${r.id}`,
      });
    }

    // OS pendentes (sem RME): carga meta prevista, carga real ainda vazia
    for (const o of osPendentes) {
      const ticket = o.ticket_id ? ticketMap.get(o.ticket_id) : null;
      if (ticket?.status === 'cancelado') continue;
      const tec = tecnicoMap.get(o.tecnico_id);
      const nome =
        (tec?.prestador_id ? prestadorMap.get(tec.prestador_id) : null) ??
        (tec?.profile_id ? profileMap.get(tec.profile_id) : null) ??
        'Não identificado';

      const minutosPrev = hpMap.get(`${o.id}:${o.tecnico_id}`);
      let meta: number | null = null;
      if (minutosPrev) meta = Math.round((Number(minutosPrev) / 60) * 100) / 100;
      else if (o.duracao_estimada_min) meta = Math.round((Number(o.duracao_estimada_min) / 60) * 100) / 100;
      else meta = hoursBetween(o.hora_inicio, o.hora_fim);

      rows.push({
        id: `os-${o.id}`,
        tipo: 'OS',
        data: toDay(o.data_programada) || toDay(ticket?.data_servico),
        pessoaId: o.tecnico_id ?? null,
        pessoaNome: nome,
        destino: (ticket?.cliente_id ? clienteMap.get(ticket.cliente_id) : null) ?? '—',
        numero: o.numero_os ?? ticket?.numero_ticket ?? '—',
        status: o.aceite_tecnico === 'aceito' ? 'sem_rme' : `aceite_${o.aceite_tecnico ?? 'pendente'}`,
        horasMeta: meta,
        horasReais: null,
        link: `/work-orders/${o.id}`,
      });
    }


    return rows.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  },
};
