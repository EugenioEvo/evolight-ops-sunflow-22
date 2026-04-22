import { z } from "zod";

export const insumoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  unidade: z.string().min(1, "Unidade é obrigatória"),
  preco: z.number().min(0, "Preço deve ser positivo").optional(),
  estoque_minimo: z.number().min(0, "Estoque mínimo deve ser positivo"),
  estoque_critico: z.number().min(0, "Estoque crítico deve ser positivo"),
  localizacao: z.string().optional(),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  retornavel: z.boolean().default(false),
});

export const saidaSchema = z.object({
  tipo: z.enum(["insumo", "kit"]),
  insumo_id: z.string().optional(),
  kit_id: z.string().optional(),
  quantidade: z.number().min(1, "Quantidade deve ser maior que zero"),
  tecnico_id: z.string().min(1, "Selecione um técnico"),
  ordem_servico_id: z.string().min(1, "Selecione uma OS"),
  observacoes: z.string().optional(),
});

export type InsumoForm = z.infer<typeof insumoSchema>;
export type SaidaForm = z.infer<typeof saidaSchema>;

export interface Insumo extends InsumoForm {
  id: string;
  quantidade: number;
  retornavel: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsumoSaida {
  id: string;
  insumo_id: string | null;
  kit_id: string | null;
  quantidade: number;
  quantidade_devolvida: number;
  retornavel: boolean;
  ordem_servico_id: string;
  tecnico_id: string;
  registrado_por: string;
  status: 'pendente_aprovacao' | 'aprovada' | 'rejeitada' | 'devolvida_total' | 'devolvida_parcial';
  aprovado_por: string | null;
  aprovado_at: string | null;
  rejeitado_motivo: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  insumo?: { nome: string; unidade: string } | null;
  kit?: { nome: string } | null;
  tecnico?: { id: string; profile?: { nome: string } | null } | null;
  os?: { numero_os: string } | null;
}

export interface InsumoDevolucao {
  id: string;
  saida_id: string;
  quantidade: number;
  status: 'pendente_aprovacao' | 'aprovada' | 'rejeitada';
  registrada_por: string;
  aprovado_por: string | null;
  aprovado_at: string | null;
  observacoes: string | null;
  rejeitado_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Kit {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  kit_itens?: Array<{ id: string; insumo_id: string; quantidade: number; insumo?: { nome: string; unidade: string } }>;
}

export const getEstoqueStatus = (quantidade: number, estoque_minimo: number, estoque_critico: number) => {
  if (quantidade <= estoque_critico) return "critico";
  if (quantidade <= estoque_minimo) return "baixo";
  return "normal";
};

// Mantido para compatibilidade
export interface Movimentacao {
  id: string;
  insumo_id: string;
  responsavel_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  motivo?: string;
  observacoes?: string;
  data_movimentacao: string;
  created_at: string;
  responsaveis?: { nome: string; tipo: string };
}
