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
