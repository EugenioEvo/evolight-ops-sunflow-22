-- Remover coluna salario da tabela prestadores
ALTER TABLE public.prestadores DROP COLUMN IF EXISTS salario;

-- Modificar colunas especialidades e certificacoes para usar arrays de texto predefinidos
-- (já estão como arrays, então não precisamos alterar o tipo)

-- Modificar coluna experiencia para text ao invés de integer
ALTER TABLE public.prestadores ALTER COLUMN experiencia TYPE text;