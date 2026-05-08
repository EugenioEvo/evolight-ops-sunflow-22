import * as z from 'zod';

export const RDO_STATUS = ['rascunho', 'pendente', 'aprovado', 'rejeitado'] as const;
export type RDOStatus = typeof RDO_STATUS[number];

export const RDO_STATUS_LABEL: Record<RDOStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export const RDO_STATUS_VARIANT: Record<RDOStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  rascunho: 'secondary',
  pendente: 'outline',
  aprovado: 'default',
  rejeitado: 'destructive',
};

export const CLIMA_OPTIONS = ['ensolarado', 'nublado', 'chuvoso', 'chuva_forte', 'misto'] as const;
export type Clima = typeof CLIMA_OPTIONS[number];
export const CLIMA_LABEL: Record<Clima, string> = {
  ensolarado: 'Ensolarado',
  nublado: 'Nublado',
  chuvoso: 'Chuvoso',
  chuva_forte: 'Chuva forte',
  misto: 'Misto',
};

export const TURNO_OPTIONS = ['manha', 'tarde', 'integral', 'noite'] as const;
export type Turno = typeof TURNO_OPTIONS[number];
export const TURNO_LABEL: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  integral: 'Integral',
  noite: 'Noite',
};

export interface RDORelatorio {
  id: string;
  numero_rdo: string;
  obra_id: string;
  data_rdo: string;
  turno: string | null;
  clima: string | null;
  temperatura_c: number | null;
  condicoes_canteiro: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  observacoes_gerais: string | null;
  ocorrencias: string | null;
  atrasos: string | null;
  restricoes: string | null;
  responsavel_id: string;
  status: RDOStatus;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  observacoes_aprovacao: string | null;
  fotos_geral: string[] | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  obra?: { id: string; nome: string; cidade: string | null; estado: string | null } | null;
  responsavel?: { id: string; nome: string } | null;
}

export const rdoIdentificationSchema = z.object({
  obra_id: z.string().uuid('Selecione uma obra'),
  data_rdo: z.string().min(1, 'Data obrigatória'),
  turno: z.enum(TURNO_OPTIONS).optional().nullable(),
  clima: z.enum(CLIMA_OPTIONS).optional().nullable(),
  temperatura_c: z.coerce.number().optional().nullable(),
  condicoes_canteiro: z.string().max(500).optional().or(z.literal('')),
  horario_inicio: z.string().optional().or(z.literal('')),
  horario_fim: z.string().optional().or(z.literal('')),
});

export type RDOIdentificationForm = z.infer<typeof rdoIdentificationSchema>;
