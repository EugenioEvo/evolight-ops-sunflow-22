---
name: OS Acceptance Email Buttons
description: "Nova OS Atribuída" emails include Accept/Reject buttons that call os-acceptance-action with HS256 JWT (7-day expiry).
type: feature
---
**Token:** HS256 JWT signed with `SUPABASE_JWT_SECRET`, payload `{os_id, tecnico_id, exp: 7d}`.

**Endpoint:** `os-acceptance-action` (`verify_jwt = false`, validates JWT in code).
- `?action=aceitar&token=...` → executes `acceptOS` logic (including responsible promotion) and renders confirmation HTML.
- `?action=recusar&token=...` → renders HTML page with required textarea; POST executes `rejectOS`.

**Auth parity:** in-app uses Supabase RLS; email uses short-lived JWT. Both call the same business logic so behavior is identical (calendar invite on accept, rejection notice + ticket reversion on reject, responsible promotion).

**Email subject templates** (all include technician name at end):
- `Nova OS Atribuída: {numero_os} - {nome_tecnico}`
- `Agendamento: {numero_os} - {cliente} - {nome_tecnico}` (sent on accept)
- `OS Recusada: {numero_os} - {cliente} - {nome_tecnico}` (sent to ticket creator on reject)

**Reassignment:** `WorkOrderDetail.tsx` exposes a "Reatribuir técnico" dropdown when `aceite_tecnico='recusado'`. Selecting a new technician resets `aceite_tecnico='pendente'`, clears `motivo_recusa`, and invokes `resend-os-acceptance-email`.
