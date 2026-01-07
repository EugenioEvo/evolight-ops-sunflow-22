-- Add UFV/SolarZ field to clientes table
ALTER TABLE public.clientes 
ADD COLUMN ufv_solarz text DEFAULT NULL;