ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_categoria_check;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'paineis_solares','inversores','estruturas_montagem','cabos_conectores',
    'equipamentos_medicao','ferramentas','componentes_eletricos','manutencao','seguranca'
  ]));