import * as z from 'zod';

export const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export const clienteSchema = z.object({
  empresa: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  cnpj_cpf: z.string()
    .min(11, "CNPJ/CPF deve ter pelo menos 11 dígitos")
    .refine(val => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 11 || digits.length === 14;
    }, "CNPJ deve ter 14 dígitos ou CPF 11 dígitos"),
  endereco: z.string().min(5, "Endereço é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  estado: z.enum(ESTADOS_BR, { errorMap: () => ({ message: "Selecione um estado válido" }) }),
  cep: z.string()
    .min(8, "CEP é obrigatório")
    .refine(val => /^\d{5}-?\d{3}$/.test(val.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')), "CEP inválido (formato: 00000-000)"),
  telefone: z.string()
    .optional()
    .refine(val => !val || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(val), "Telefone inválido (formato: (00) 00000-0000)"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  ufv_solarz: z.string().optional(),
  prioridade: z.number().int().min(0, "Prioridade deve ser maior ou igual a 0").optional(),
  observacoes: z.string().optional(),
});

export type ClienteForm = z.infer<typeof clienteSchema>;

export interface Cliente extends ClienteForm {
  id: string;
  status: 'ativo' | 'inativo';
  ufv_solarz?: string;
  prioridade?: number;
  profile?: {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
  };
}
