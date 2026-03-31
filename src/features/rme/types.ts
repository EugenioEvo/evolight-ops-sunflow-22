import { z } from 'zod';

export const rmeSchema = z.object({
  condicoes_encontradas: z.string().min(1, 'Campo obrigatório'),
  servicos_executados: z.string().min(1, 'Campo obrigatório'),
  testes_realizados: z.string().optional(),
  observacoes_tecnicas: z.string().optional(),
  data_execucao: z.string().min(1, 'Data de execução obrigatória'),
  nome_cliente_assinatura: z.string().min(1, 'Nome do cliente obrigatório'),
  tensao_entrada: z.string().optional(),
  tensao_saida: z.string().optional(),
  corrente: z.string().optional(),
  potencia: z.string().optional(),
  frequencia: z.string().optional(),
});

export type RMEForm = z.infer<typeof rmeSchema>;

export interface Material {
  insumo_id: string;
  nome: string;
  quantidade: number;
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES = 10;
export const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
