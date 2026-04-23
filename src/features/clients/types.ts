import * as z from 'zod';

export const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

// Editable fields only (managed in Lovable, not synced from external sources)
export const clienteEditableSchema = z.object({
  prioridade: z
    .number({ invalid_type_error: 'Informe um número' })
    .int('Use um número inteiro')
    .min(1, 'Prioridade mínima é 1')
    .max(5, 'Prioridade máxima é 5'),
  observacoes: z.string().max(2000).optional().or(z.literal('')),
});

export type ClienteEditableForm = z.infer<typeof clienteEditableSchema>;

export type ClienteOrigem = 'solarz' | 'conta_azul' | 'manual' | string;

export type StatusFinanceiroCA = 'OK' | 'INADIMPLENTE' | string;
export type UfvStatusResumo = 'OK' | 'ALERTA' | 'SEM_UFV' | string;

export interface ClienteUFV {
  id: string;
  solarz_ufv_id: string;
  nome: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  potencia_kwp: number | null;
  status: string | null;
}

export interface ClienteContaAzulId {
  id: string;
  conta_azul_customer_id: string;
  nome_fiscal: string | null;
  cnpj_cpf: string | null;
  email: string | null;
}

export interface Cliente {
  id: string;
  empresa: string;
  cnpj_cpf: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  origem: ClienteOrigem | null;
  solarz_customer_id: string | null;
  sem_solarz: boolean | null;
  prioridade: number | null;
  observacoes: string | null;
  telefones_unificados: string | null;
  enderecos_unificados: string | null;
  atrasos_recebimentos: number | null;
  status_financeiro_ca: StatusFinanceiroCA | null;
  ufv_status_resumo: UfvStatusResumo | null;
  sync_source_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: 'ativo' | 'inativo';
  ativo: boolean;
  profile?: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
  } | null;
  ufvs: ClienteUFV[];
  conta_azul_ids: ClienteContaAzulId[];
}

export interface PagedClientes {
  rows: Cliente[];
  total: number;
}

export const PAGE_SIZE = 20;
