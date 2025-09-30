-- Tornar profile_id opcional na tabela clientes
-- pois clientes cadastrados pela área técnica não precisam de user autenticado
ALTER TABLE public.clientes ALTER COLUMN profile_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.clientes.profile_id IS 'Referência ao profile (opcional) - null para clientes cadastrados manualmente sem autenticação';
