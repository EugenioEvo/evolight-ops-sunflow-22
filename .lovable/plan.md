## Dry-run — smoke test do SunFlow

Objetivo: validar em ~20 minutos os principais fluxos da app, edge functions e DB functions, escrevendo apenas em registros marcados como `[DRY-RUN]` e limpando ao final. Resultado entregue como tabela markdown (OK / Warn / Fail) com ponteiros de arquivo/log.

### 1. Pré-flight (sem efeitos colaterais)
- `cloud_status` + `db_health` + `linter` (Supabase)
- `read_query`: contagens de tickets/OS/RME/RDO/prestadores/tecnicos para baseline e detecção de órfãos (`tickets sem cliente`, `OS sem ticket`, `rme sem OS`).
- Conferir lista de edge functions deployadas vs. pasta `supabase/functions/`.

### 2. DB functions (read-only via `read_query`)
Chamar com IDs reais lidos no passo 1:
- `get_dashboard_stats()`
- `get_technician_workload(tec, hoje-30, hoje+30)` + `get_technician_workload_os_detail(...)`
- `get_tecnico_os_ativas(tec)`
- `get_ticket_rme_group_context(ticket)` — valida o JOIN prestadores→tecnicos (bug histórico)
- `get_minhas_devolucoes()` / `get_backoffice_devolucoes()` / `get_backoffice_entradas_pendentes()`
- `check_schedule_conflict(tec, hoje, '09:00', '10:00')`
- `check_geocoding_rate_limit('0.0.0.0')` / `check_presence_rate_limit(...)`
- `is_admin/is_staff/is_backoffice/can_approve_rdo` para o usuário logado
- `gerar_numero_ticket()` / `gerar_numero_os()` / `gerar_numero_rdo()` (puros, retornam string)

Triggers são exercitadas implicitamente pelo passo 4 (criação de ticket → `trigger_gerar_numero_ticket`, `trigger_status_historico`, `validate_ticket_tecnico`, `sync_*`).

### 3. Edge functions (via `curl_edge_functions` + `edge_function_logs`)
Cada uma chamada com payload válido e payload inválido (espera 400/401/403):
- Auth/admin: `create-user-profile`, `create-staff-user`, `delete-user`, `approve-prestador`, `provision-staff-as-tecnico`
- OS lifecycle: `gerar-ordem-servico`, `os-acceptance-action` (JWT HS256), `resend-os-acceptance-email`, `send-calendar-invite`, `send-os-altered-email`, `send-os-cancelled-email`, `send-os-reminders`
- Tickets/RME/RDO: `send-ticket-decision-email`, `send-ticket-deleted-email`, `send-rejection-notice`, `send-rme-email`, `send-rme-submitted-email`, `send-rme-decision-email`, `send-rdo-submitted-email`, `send-rdo-decision-email`
- Geo/rotas: `geocode-address`, `mapbox-geocode`, `mapbox-directions`, `reverse-geocode`, `optimize-route-osrm`, `process-pending-geocoding`
- Infra/integração: `process-email-retries`, `confirm-presence`, `api-export` (x-api-key), `sync-clientes-external`

Para cada uma: status code, body resumido, últimas 20 linhas de log. Falha = response 5xx ou exception no log.

### 4. UI ponta-a-ponta (browser, viewport desktop)
Fluxo único com um ticket descartável, logado como o usuário atual do preview:
1. `/auth` (se necessário) → dashboard renderiza, sem erros no console
2. `/clientes` → abre form, fecha sem salvar
3. `/tickets` → criar `[DRY-RUN] smoke <ts>`, atribuir técnico, gerar OS (dispara `gerar-ordem-servico` + calendar invite)
4. `/ordens-servico` → abrir OS criada, validar PDF link, abrir modal `+ Técnico` (regressão recente de duração)
5. `/agenda` → OS aparece no slot correto
6. `/rotas` → otimização roda (fallback Mapbox→OSRM)
7. `/rme` → abrir wizard a partir da OS, salvar rascunho, voltar
8. `/rdo/dashboard` + `/obra-catalogo` → render
9. `/minhas-os`, `/minhas-devolucoes`, `/backoffice/insumos` → render + dados coerentes
10. `/portal/...` (cliente) e `/usuarios` (admin) → render
11. Cleanup: cancelar ticket `[DRY-RUN]` (cascateia OS), confirmar status `cancelado`

A cada tela: screenshot + leitura de console/network para erros 4xx/5xx.

### 5. Relatório final (chat)
Tabela única:

```text
Área                | Item                          | Status | Nota / referência
--------------------|-------------------------------|--------|-------------------------
Pré-flight          | cloud_status                  | OK     | ACTIVE_HEALTHY
DB function         | get_ticket_rme_group_context  | OK     | responsavel_email != null
Edge function       | gerar-ordem-servico           | WARN   | log: "no slot" em TKxxxx
UI                  | /tickets criar+gerar OS       | FAIL   | console: 403 em /functions/...
...
```

Mais: lista priorizada de issues encontrados (curta), e itens não testados/explicitamente fora do escopo (ex.: confirm-presence requer QR físico, push notifications nativas).

### Notas técnicas
- Dados criados serão prefixados `[DRY-RUN]` e limpos via cancelamento (regra: tickets não são excluídos).
- Emails reais serão suprimidos sempre que possível usando flag de teste ou destinatário do próprio usuário; quando não houver, marco no relatório.
- Sem migrações, sem deploys, sem alteração de secrets.
- Tempo estimado: 15–25 min de execução.
