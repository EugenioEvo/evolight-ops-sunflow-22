import * as z from 'zod';

export const OBRA_STATUS = ['planejada', 'em_execucao', 'pausada', 'concluida', 'cancelada'] as const;
export type ObraStatus = typeof OBRA_STATUS[number];

export const OBRA_STATUS_LABEL: Record<ObraStatus, string> = {
  planejada: 'Planejada',
  em_execucao: 'Em execução',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const obraSchema = z.object({
  nome: z.string().min(2, 'Informe um nome').max(200),
  cliente_id: z.string().uuid().nullable().optional(),
  responsavel_obra_id: z.string().uuid().nullable().optional(),
  endereco: z.string().max(300).optional().or(z.literal('')),
  cidade: z.string().max(120).optional().or(z.literal('')),
  estado: z.string().max(2).optional().or(z.literal('')),
  cep: z.string().max(20).optional().or(z.literal('')),
  data_inicio_prevista: z.string().optional().or(z.literal('')),
  data_fim_prevista: z.string().optional().or(z.literal('')),
  data_inicio_real: z.string().optional().or(z.literal('')),
  data_fim_real: z.string().optional().or(z.literal('')),
  potencia_kwp: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(OBRA_STATUS).default('planejada'),
  observacoes: z.string().max(2000).optional().or(z.literal('')),
});

export type ObraForm = z.infer<typeof obraSchema>;

export interface Obra {
  id: string;
  nome: string;
  cliente_id: string | null;
  responsavel_obra_id: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  potencia_kwp: number | null;
  status: ObraStatus;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; empresa: string } | null;
  responsavel?: { id: string; nome: string } | null;
}
