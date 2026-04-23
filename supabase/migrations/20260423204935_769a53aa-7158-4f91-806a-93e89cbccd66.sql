ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON public.clientes(ativo);

COMMENT ON COLUMN public.clientes.ativo IS 'Soft-delete: false quando o cliente sumiu das origens (Solarz/Conta Azul) na última sincronização. Reativa automaticamente se voltar.';