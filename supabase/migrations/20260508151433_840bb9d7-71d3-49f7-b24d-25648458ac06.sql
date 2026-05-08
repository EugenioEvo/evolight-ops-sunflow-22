ALTER TABLE public.rdo_relatorios
  ADD COLUMN IF NOT EXISTS horas_paradas_programadas numeric,
  ADD COLUMN IF NOT EXISTS horas_paradas_nao_programadas numeric;