# Project Notes

## Cron / Compute
- All cron jobs are restricted to 10:00–23:59 UTC (07h–21h Brasília) so the backend hibernates overnight and billing stops during idle hours. New scheduled jobs must stay within this window; never schedule a job between 00:00–09:59 UTC.
- Use `cron.alter_job(job_id, schedule => ...)` to change schedules — direct UPDATE on `cron.job` is permission-denied, and `cron.schedule` would need the (redacted/inaccessible) command strings for http_post jobs.
