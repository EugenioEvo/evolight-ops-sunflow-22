-- 1. Atualizar categorias inválidas existentes para 'manutencao' (fallback)
UPDATE public.insumos
SET categoria = 'manutencao'
WHERE categoria NOT IN ('paineis_solares', 'inversores', 'estruturas_montagem', 'cabos_conectores', 'equipamentos_medicao', 'ferramentas', 'componentes_eletricos', 'manutencao');

-- 2. Dropar constraint antigo de categoria
ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_categoria_check;

-- 3. Criar novo constraint com categorias corretas do domínio de energia solar
ALTER TABLE public.insumos 
ADD CONSTRAINT insumos_categoria_check 
CHECK (categoria IN ('paineis_solares', 'inversores', 'estruturas_montagem', 'cabos_conectores', 'equipamentos_medicao', 'ferramentas', 'componentes_eletricos', 'manutencao'));

-- 4. Criar trigger para atualização automática de estoque
-- A função atualizar_estoque() já existe, só precisa criar o trigger
DROP TRIGGER IF EXISTS trigger_atualizar_estoque ON public.movimentacoes;

CREATE TRIGGER trigger_atualizar_estoque
AFTER INSERT ON public.movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque();