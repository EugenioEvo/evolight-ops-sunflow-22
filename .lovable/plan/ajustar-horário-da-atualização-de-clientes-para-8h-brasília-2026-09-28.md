# Ajustar horário da atualização de clientes para 8h (Brasília)

## Situação atual
O job agendado `sync-clientes-daily` (sincronização de clientes via `sync-clientes-external`) roda às 06:00 UTC = 03:00 no horário de Brasília.

## Mudança
Atualizar o agendamento do job para 11:00 UTC = 08:00 no horário de Brasília:

```sql
SELECT cron.schedule(
  'sync-clientes-daily',
  '0 11 * * *',
  $$ <comando atual do job, mantido integralmente> $$
);
```

O `cron.schedule` com o mesmo `jobname` substitui o agendamento existente, sem duplicar o job. O comando executado permanece o mesmo (chamada à edge function `sync-clientes-external`); só o horário muda.

## Impacto
- A sincronização de clientes passa a rodar diariamente às 8h (Brasília) em vez de 3h.
- Nenhum outro job é afetado (lembretes, e-mails, geocoding etc. mantêm seus horários).

## Verificação
Consultar `cron.job` após a mudança para confirmar o novo horário `0 11 * * *` no job `sync-clientes-daily`.
