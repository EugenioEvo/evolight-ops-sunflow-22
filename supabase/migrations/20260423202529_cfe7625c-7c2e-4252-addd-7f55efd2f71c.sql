ALTER TABLE public.sync_runs
ADD COLUMN IF NOT EXISTS triggered_by text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.sync_runs.triggered_by IS 'manual | cron — origem do disparo';