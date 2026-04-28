import { z } from 'zod';

export const ticketSchema = z
  .object({
    titulo: z.string().min(1, 'Título é obrigatório'),
    descricao: z.string().min(1, 'Descrição é obrigatória'),
    cliente_id: z.string().uuid('Selecione um cliente'),
    ufv_nome: z.string().optional().or(z.literal('')),
    equipamento_tipo: z.enum(['painel_solar', 'inversor', 'controlador_carga', 'bateria', 'cabeamento', 'estrutura', 'monitoramento', 'outros']),
    prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
    endereco_servico: z.string().min(1, 'Endereço do serviço é obrigatório'),
    data_servico: z.string().optional(),
    data_vencimento: z.string().optional(),
    horario_previsto_inicio: z.string().optional(),
    observacoes: z.string().optional(),
    anexos: z.array(z.string()).optional(),
  })
  // Trava: data_servico não pode ser anterior a hoje (em edição também — usa a própria data já definida)
  .superRefine((val, ctx) => {
    if (val.data_servico) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const ds = new Date(val.data_servico + 'T00:00:00');
      if (ds < hoje) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['data_servico'],
          message: 'A data de serviço não pode ser anterior a hoje',
        });
      }
    }
    // Trava: data_vencimento >= data_servico
    if (val.data_servico && val.data_vencimento) {
      const ds = new Date(val.data_servico + 'T00:00:00');
      const dv = new Date(val.data_vencimento + 'T00:00:00');
      if (dv < ds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['data_vencimento'],
          message: 'A data limite não pode ser anterior à data de serviço',
        });
      }
    }
  });

export type TicketFormData = z.infer<typeof ticketSchema>;

/** Ticket row with all related data as returned by ticketService.loadAll() */
export interface TicketWithRelations {
  id: string;
  numero_ticket: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  equipamento_tipo: string;
  endereco_servico: string;
  data_abertura: string;
  data_servico: string | null;
  data_vencimento: string | null;
  data_conclusao: string | null;
  data_inicio_execucao: string | null;
  horario_previsto_inicio: string | null;
  observacoes: string | null;
  anexos: string[] | null;
  cliente_id: string;
  ufv_nome: string | null;
  tecnico_responsavel_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  geocoding_status: string | null;
  geocoded_at: string | null;
  can_create_rme: boolean | null;
  clientes: {
    empresa: string | null;
    cnpj_cpf: string | null;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    ufv_solarz: string | null;
    prioridade: number | null;
    status_financeiro_ca: string | null;
    atrasos_recebimentos: number | null;
    profiles: { nome: string; email: string } | null;
  } | null;
  ordens_servico: Array<{
    numero_os: string;
    id: string;
    pdf_url: string | null;
    aceite_tecnico: string;
    motivo_recusa: string | null;
    tecnico_id?: string | null;
    data_programada?: string | null;
    tecnicos?: { profiles: { nome: string } | null } | null;
    rme_relatorios?: Array<{
      id: string;
      status: string | null;
    }> | null;
  }> | null;
  prestadores: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

/** UFV individual de um cliente, exposta para selects de ticket */
export interface TicketClienteUFV {
  id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

/** Cliente row as returned by ticketService.loadClientes() */
export interface TicketCliente {
  id: string;
  empresa: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  cnpj_cpf: string | null;
  /** Lista achatada (string concatenada) das UFVs — mantida por compatibilidade com filtros existentes. */
  ufv_solarz: string | null;
  /** UFVs cadastradas do cliente (lista estruturada para o select dependente). */
  ufvs: TicketClienteUFV[];
  prioridade: number | null;
  status_financeiro_ca: string | null;
  atrasos_recebimentos: number | null;
  profiles: { nome: string; email: string; telefone: string | null } | null;
}

/** Prestador (technician provider) row */
export interface TicketPrestador {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  categoria: string;
  ativo: boolean;
  especialidades: string[] | null;
  certificacoes: string[] | null;
  cidade: string | null;
  estado: string | null;
}

/** Linked OS summary */
export interface LinkedOS {
  id: string;
  numero_os: string;
  tecnico_id: string | null;
}

export const STATUS_COLORS: Record<string, string> = {
  'aberto': 'bg-blue-100 text-blue-800',
  'aguardando_aprovacao': 'bg-yellow-100 text-yellow-800',
  'aprovado': 'bg-green-100 text-green-800',
  'rejeitado': 'bg-red-100 text-red-800',
  'ordem_servico_gerada': 'bg-purple-100 text-purple-800',
  'em_execucao': 'bg-orange-100 text-orange-800',
  'aguardando_rme': 'bg-indigo-100 text-indigo-800',
  'concluido': 'bg-gray-100 text-gray-800',
  'cancelado': 'bg-red-100 text-red-800',
};

export const PRIORIDADE_COLORS: Record<string, string> = {
  'baixa': 'bg-green-100 text-green-800',
  'media': 'bg-yellow-100 text-yellow-800',
  'alta': 'bg-orange-100 text-orange-800',
  'critica': 'bg-red-100 text-red-800',
};

export const ITEMS_PER_PAGE = 20;
