import { z } from "zod";

export const equipamentoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  modelo: z.string().optional(),
  fabricante: z.string().optional(),
  numero_serie: z.string().optional(),
  tipo: z.enum(["inversor", "painel_solar", "bateria", "cabeamento", "controlador_carga", "estrutura", "monitoramento", "outros"]),
  capacidade: z.string().optional(),
  tensao: z.string().optional(),
  corrente: z.string().optional(),
  data_instalacao: z.string().optional(),
  garantia: z.string().optional(),
  cliente_id: z.string().min(1, "Cliente é obrigatório"),
  localizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

export type EquipamentoForm = z.infer<typeof equipamentoSchema>;

export interface Equipamento extends EquipamentoForm {
  id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  clientes?: {
    id: string;
    empresa?: string;
    profiles?: {
      nome: string;
    };
  };
}
