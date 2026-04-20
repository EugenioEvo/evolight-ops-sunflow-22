import { supabase } from '@/integrations/supabase/client';

export interface BuildOSPDFInput {
  os_id: string;
  numero_os: string;
  data_programada: string | null;
  hora_inicio?: string | null;
  servico_solicitado?: string | null;
  tipo_trabalho?: string[] | null;
  ticket_id: string;
  cliente?: { empresa?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; ufv_solarz?: string | null } | null;
  ticket?: { titulo?: string | null; descricao?: string | null; endereco_servico?: string | null; tecnico_responsavel_id?: string | null } | null;
}

/**
 * Monta o payload padronizado para o gerador de PDF da OS.
 * - Equipe = TODOS os técnicos atribuídos ao mesmo ticket (qualquer status de aceite, exceto recusado).
 * - Técnico Responsável = nome do prestador em tickets.tecnico_responsavel_id (fallback: 1º da equipe).
 */
export async function buildOSPDFData(input: BuildOSPDFInput) {
  // 1) Equipe: pegar todas as OS do mesmo ticket -> nomes dos técnicos (não recusados)
  const { data: osList } = await supabase
    .from('ordens_servico')
    .select('id, aceite_tecnico, tecnicos:tecnico_id(profiles(nome))')
    .eq('ticket_id', input.ticket_id);

  const equipe = (osList || [])
    .filter((o: any) => o.aceite_tecnico !== 'recusado')
    .map((o: any) => o?.tecnicos?.profiles?.nome)
    .filter((n: string | undefined): n is string => Boolean(n));

  // 2) Técnico Responsável: tickets.tecnico_responsavel_id (tabela prestadores) ou 1º da equipe
  let tecnicoResponsavel = equipe[0] || 'TODOS';
  if (input.ticket?.tecnico_responsavel_id) {
    const { data: prestador } = await supabase
      .from('prestadores')
      .select('nome')
      .eq('id', input.ticket.tecnico_responsavel_id)
      .maybeSingle();
    if (prestador?.nome) tecnicoResponsavel = prestador.nome;
  }

  const endereco = `${input.cliente?.endereco || input.ticket?.endereco_servico || ''}, ${input.cliente?.cidade || ''} - ${input.cliente?.estado || ''}`;

  return {
    numero_os: input.numero_os,
    data_programada: input.data_programada || new Date().toISOString(),
    equipe: equipe.length ? equipe : ['Não informado'],
    cliente: input.cliente?.empresa || 'Não informado',
    endereco,
    servico_solicitado: input.servico_solicitado || 'MANUTENÇÃO',
    hora_marcada: input.hora_inicio || '00:00',
    descricao: input.ticket?.descricao || input.ticket?.titulo || '',
    tecnico_responsavel: tecnicoResponsavel,
    tipo_trabalho: input.tipo_trabalho || [],
    ufv_solarz: input.cliente?.ufv_solarz || undefined,
  };
}
