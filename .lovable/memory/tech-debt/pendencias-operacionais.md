---
name: pendencias-operacionais
description: Lista de melhorias operacionais adiadas (cron jobs, limpeza de dados, smoke tests UI).
type: feature
---

Pendências acumuladas em dry-runs (a executar quando houver janela):

1. **Agendar cron** para `cleanup_geocoding_rate_limits()` — diário; remove rows com `window_start < now() - 1 hour`.
2. **Agendar cron** para `process-pending-geocoding` — horário; processa até 10 tickets com `geocoding_status = 'pending'` (atualmente roda só sob demanda).
3. **Investigar 10 OS `aceite_tecnico = 'recusado'`** — provavelmente lixo histórico; decidir se arquivamos ou limpamos.
4. **UI smoke test ponta-a-ponta** — criar ticket → gerar OS → calendar invite → rotas → cancelar; ficou de fora do último dry-run.
5. **Refatorar `cleanup_old_audit_logs()`** para também rodar em cron (já existe a função, falta agendar).
