-- Campos unificados (texto multi-linha com origem) preenchidos pela sync externa
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS telefones_unificados text,
  ADD COLUMN IF NOT EXISTS enderecos_unificados text;

COMMENT ON COLUMN public.clientes.telefones_unificados IS 'Telefones agregados das fontes externas (Solarz/Conta Azul), uma linha por telefone com prefixo de origem.';
COMMENT ON COLUMN public.clientes.enderecos_unificados IS 'Endereços agregados das fontes externas (Solarz/Conta Azul), uma linha por endereço com prefixo de origem.';