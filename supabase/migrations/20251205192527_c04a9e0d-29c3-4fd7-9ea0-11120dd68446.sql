-- Add unique constraint for upsert on route_optimizations
ALTER TABLE public.route_optimizations 
ADD CONSTRAINT route_optimizations_tecnico_data_unique 
UNIQUE (tecnico_id, data_rota);