import { z } from "zod";

export const UNIDADES_OPTIONS = [
  { value: "un", label: "un (unidade)" },
  { value: "pc", label: "pc (peça)" },
  { value: "cx", label: "cx (caixa)" },
  { value: "kit", label: "kit" },
  { value: "par", label: "par" },
  { value: "m", label: "m (metro)" },
  { value: "m2", label: "m² (metro²)" },
  { value: "m3", label: "m³ (metro³)" },
  { value: "cm", label: "cm" },
  { value: "mm", label: "mm" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "L (litro)" },
  { value: "ml", label: "mL" },
  { value: "rl", label: "rl (rolo)" },
  { value: "sc", label: "sc (saco)" },
  { value: "gl", label: "gl (galão)" },
] as const;

export const LOCALIZACAO_OPTIONS = ["Estoque"] as const;

export const insumoMidiaSchema = z.object({
  url: z.string(),
  path: z.string(),
  type: z.enum(["image", "video"]),
  name: z.string().optional(),
});

export const insumoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  unidade: z.string().min(1, "Unidade é obrigatória"),
  preco: z.number().min(0, "Preço deve ser positivo").optional(),
  quantidade: z.number().min(0, "Estoque atual deve ser positivo").optional(),
  estoque_minimo: z.number().min(0, "Estoque mínimo deve ser positivo"),
  estoque_critico: z.number().min(0, "Estoque crítico deve ser positivo"),
  localizacao: z.string().optional().nullable(),
  fornecedor: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  retornavel: z.boolean().default(false),
  midias: z.array(insumoMidiaSchema).optional().default([]),
});


export const saidaEvidenciaSchema = z.object({
  url: z.string(),
  path: z.string(),
  type: z.enum(["image", "video"]),
  name: z.string().optional(),
});

export const saidaSchema = z.object({
  tipo: z.enum(["insumo", "kit"]),
  insumo_id: z.string().optional(),
  kit_id: z.string().optional(),
  quantidade: z.number().min(1, "Quantidade deve ser maior que zero"),
  tecnico_id: z.string().min(1, "Selecione um técnico"),
  uso_interno: z.boolean().default(false),
  ordens_servico_ids: z.array(z.string()).default([]),
  obra_id: z.string().optional().nullable(),
  evidencias: z.array(saidaEvidenciaSchema).min(1, "Anexe ao menos 1 foto ou vídeo da saída"),
  observacoes: z.string().optional(),
}).refine((d) => {
  const destinos =
    (d.uso_interno ? 1 : 0) +
    (d.ordens_servico_ids.length > 0 ? 1 : 0) +
    (d.obra_id ? 1 : 0);
  return destinos === 1;
}, {
  message: "Selecione uma OS, uma Obra ou marque Uso Interno (apenas um destino).",
  path: ["ordens_servico_ids"],
});

export type SaidaEvidencia = z.infer<typeof saidaEvidenciaSchema>;

export const compraSchema = z.object({
  insumo_id: z.string().min(1),
  quantidade: z.number().int().min(1, "Quantidade deve ser maior que zero"),
  valor_unitario: z.number().min(0, "Valor inválido"),
  fornecedor: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type InsumoForm = z.infer<typeof insumoSchema>;
export type SaidaForm = z.infer<typeof saidaSchema>;
export type CompraForm = z.infer<typeof compraSchema>;
export type InsumoMidia = z.infer<typeof insumoMidiaSchema>;

export interface Insumo extends InsumoForm {
  id: string;
  quantidade: number;
  retornavel: boolean;
  midias: InsumoMidia[];
  created_at: string;
  updated_at: string;
}

export interface DevolucaoEvidencia {
  url: string;
  path: string;
  type: 'image' | 'video';
  name: string;
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
  evidencias?: DevolucaoEvidencia[];
  created_at: string;
  updated_at: string;
}

export interface InsumoEntradaPendente {
  id: string;
  saida_id: string;
  quantidade: number;
  status: 'pendente_aprovacao' | 'aprovada' | 'rejeitada';
  observacoes: string | null;
  evidencias?: DevolucaoEvidencia[];
  rejeitado_motivo: string | null;
  created_at: string;
}

export interface MinhaDevolucao {
  saida_id: string;
  lote_id: string;
  ordem_servico_id: string;
  numero_os: string;
  insumo_nome: string | null;
  kit_nome: string | null;
  quantidade: number;
  quantidade_devolvida: number;
  retornavel: boolean;
  saida_status: string;
  saida_created_at: string;
  devolucoes: InsumoDevolucao[];
  entradas: InsumoEntradaPendente[];
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
