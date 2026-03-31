import { z } from "zod";

export const especialidadesOptions = [
  "Sistemas Fotovoltaicos", "Inversores", "Instalação Elétrica",
  "Manutenção Preventiva", "Manutenção Corretiva", "Gestão de Projetos",
  "Supervisão de Obra", "Comissionamento",
];

export const certificacoesOptions = [
  "CREA", "NR-10", "NR-35", "CAT", "Fotovoltaica", "Gestão de Projetos",
];

export const experienciaOptions = [
  "0-1 ano", "1-3 anos", "3-5 anos", "5-10 anos", "Mais de 10 anos",
];

export const prestadorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  especialidades: z.array(z.string()).optional(),
  certificacoes: z.array(z.string()).optional(),
  experiencia: z.string().optional(),
  data_admissao: z.string().optional(),
});

export type PrestadorForm = z.infer<typeof prestadorSchema>;

export interface Prestador extends Omit<PrestadorForm, 'categoria'> {
  id: string;
  categoria: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}
