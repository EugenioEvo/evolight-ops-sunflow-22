ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS aceite_tecnico text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aceite_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_recusa text;