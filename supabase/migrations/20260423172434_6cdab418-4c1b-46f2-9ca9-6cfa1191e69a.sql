DROP INDEX IF EXISTS public.clientes_solarz_customer_id_key;

ALTER TABLE public.clientes
ADD CONSTRAINT clientes_solarz_customer_id_key UNIQUE (solarz_customer_id);