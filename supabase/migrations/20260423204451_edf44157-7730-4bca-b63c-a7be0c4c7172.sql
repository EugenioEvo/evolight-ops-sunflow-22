CREATE OR REPLACE FUNCTION public.mark_stale_clientes_sync_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sync_runs
  SET status = 'error',
      finished_at = now(),
      error = COALESCE(
        NULLIF(error, ''),
        'Run abortada automaticamente — travada sem progresso após 5min.'
      )
  WHERE source = 'clientes-external'
    AND status = 'running'
    AND started_at < now() - interval '5 minutes';
END;
$$;

DO $outer$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
    INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-clientes-stale-reaper'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'sync-clientes-stale-reaper',
    '* * * * *',
    $job$SELECT public.mark_stale_clientes_sync_runs();$job$
  );
END;
$outer$;