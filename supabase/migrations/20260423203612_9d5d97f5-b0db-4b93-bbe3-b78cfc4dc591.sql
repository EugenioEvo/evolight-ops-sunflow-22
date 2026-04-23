ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ufv_nome text;

COMMENT ON COLUMN public.tickets.ufv_nome IS 'Nome da UFV/usina vinculada a este ticket. Texto livre — pode ser uma UFV cadastrada do cliente ou um nome digitado manualmente. Cada ticket aceita apenas 1 usina.';