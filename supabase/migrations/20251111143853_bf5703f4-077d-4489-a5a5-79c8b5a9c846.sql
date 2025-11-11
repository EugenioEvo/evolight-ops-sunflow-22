-- Criar tabela para armazenar rotas otimizadas
CREATE TABLE IF NOT EXISTS public.route_optimizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnico_id UUID NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  data_rota DATE NOT NULL,
  geometry JSONB NOT NULL, -- Array de coordenadas [lon, lat]
  optimization_method TEXT NOT NULL CHECK (optimization_method IN ('mapbox', 'osrm', 'local')),
  distance_km NUMERIC(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  waypoints_order JSONB NOT NULL, -- [{id: uuid, order: number}]
  ticket_ids UUID[] NOT NULL, -- Array de IDs dos tickets na rota
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_route_optimizations_tecnico_data ON public.route_optimizations(tecnico_id, data_rota);
CREATE INDEX idx_route_optimizations_created ON public.route_optimizations(created_at DESC);

-- RLS Policies
ALTER TABLE public.route_optimizations ENABLE ROW LEVEL SECURITY;

-- Admins e área técnica podem ver todas as rotas
CREATE POLICY "Admins can view all route optimizations"
  ON public.route_optimizations
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'area_tecnica'::app_role)
  );

-- Técnicos podem ver suas próprias rotas
CREATE POLICY "Technicians can view their own route optimizations"
  ON public.route_optimizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tecnicos t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = tecnico_id AND p.user_id = auth.uid()
    )
  );

-- Admins e área técnica podem gerenciar rotas
CREATE POLICY "Admins can manage route optimizations"
  ON public.route_optimizations
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'area_tecnica'::app_role)
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_route_optimizations_updated_at
  BEFORE UPDATE ON public.route_optimizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();