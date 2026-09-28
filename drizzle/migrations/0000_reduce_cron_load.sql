SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='sync-clientes-stale-reaper'), schedule := '*/15 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='process-pending-geocoding'), schedule := '*/15 * * * *');
SELECT cron.schedule('purge-cron-history', '30 4 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$);