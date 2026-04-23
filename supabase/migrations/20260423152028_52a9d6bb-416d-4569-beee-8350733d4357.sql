DELETE FROM public.clientes
WHERE id NOT IN (SELECT DISTINCT cliente_id FROM public.tickets WHERE cliente_id IS NOT NULL);