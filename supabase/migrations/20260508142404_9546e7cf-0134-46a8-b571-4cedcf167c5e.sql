ALTER TABLE public.rdo_atividades_catalogo ADD COLUMN IF NOT EXISTS tipo text;
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_catalogo_tipo ON public.rdo_atividades_catalogo(tipo);