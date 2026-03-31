import { z } from 'zod';

export const ticketSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  cliente_id: z.string().uuid('Selecione um cliente'),
  equipamento_tipo: z.enum(['painel_solar', 'inversor', 'controlador_carga', 'bateria', 'cabeamento', 'estrutura', 'monitoramento', 'outros']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
  endereco_servico: z.string().min(1, 'Endereço do serviço é obrigatório'),
  data_servico: z.string().optional(),
  data_vencimento: z.string().optional(),
  horario_previsto_inicio: z.string().optional(),
  tempo_estimado: z.number().min(1, 'Tempo estimado deve ser maior que 0').optional(),
  observacoes: z.string().optional(),
  anexos: z.array(z.string()).optional(),
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
  tempo_estimado: number | null;
  observacoes: string | null;
  anexos: string[] | null;
  cliente_id: string;
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
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    ufv_solarz: string | null;
    prioridade: number | null;
    profiles: { nome: string; email: string } | null;
  } | null;
  ordens_servico: Array<{
    numero_os: string;
    id: string;
    pdf_url: string | null;
    aceite_tecnico: string;
    motivo_recusa: string | null;
    tecnico_id?: string | null;
  }> | null;
  prestadores: {
    id: string;
    nome: string;
    email: string;
  } | null;
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
  ufv_solarz: string | null;
  prioridade: number | null;
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
