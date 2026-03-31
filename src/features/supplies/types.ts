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
});

export const movimentacaoSchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  quantidade: z.number().min(1, "Quantidade deve ser maior que zero"),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  motivo: z.string().optional(),
  observacoes: z.string().optional(),
});

export const responsavelSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.enum(["funcionario", "prestador", "fornecedor"]),
  contato: z.string().optional(),
  observacoes: z.string().optional(),
});

export type InsumoForm = z.infer<typeof insumoSchema>;
export type MovimentacaoForm = z.infer<typeof movimentacaoSchema>;
export type ResponsavelForm = z.infer<typeof responsavelSchema>;

export interface Insumo extends InsumoForm {
  id: string;
  quantidade: number;
  created_at: string;
  updated_at: string;
}

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

export interface Responsavel extends ResponsavelForm {
  id: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const getEstoqueStatus = (quantidade: number, estoque_minimo: number, estoque_critico: number) => {
  if (quantidade <= estoque_critico) return "critico";
  if (quantidade <= estoque_minimo) return "baixo";
  return "normal";
};
