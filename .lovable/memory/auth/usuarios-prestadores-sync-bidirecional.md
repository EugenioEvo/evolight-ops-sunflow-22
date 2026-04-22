---
name: usuarios-prestadores-sync-bidirecional
description: Triggers DB mantêm profiles ↔ prestadores e prestadores → tecnicos sincronizados. Edição em qualquer lado replica no outro; sem prestador vinculado é no-op silencioso.
type: feature
---
**Regra:** Edições em `profiles` (nome/email/telefone/ativo) replicam para `prestadores` via trigger `trg_sync_profile_to_prestador`, e vice-versa via `trg_sync_prestador_to_profile`. Mudanças em `prestadores.especialidades / cidade / estado` propagam para `tecnicos` via `trg_sync_prestador_to_tecnico`.

**Localização do par:**
1. Preferência: `tecnicos.prestador_id` (FK).
2. Fallback: matching por `lower(email)`.
3. Se não achar par (caso admin/engenharia): trigger termina em no-op, sem erro.

**Anti-loop:** triggers só fazem UPDATE quando há diferença real (`IS DISTINCT FROM`), evitando ping-pong.

**Onde aplicar no app:**
- Tela `/usuarios`: modal de edição completo (básico + roles + dados de prestador quando vinculado). Salva em `profiles` + `prestadores` + diff de `user_roles`. Triggers cuidam do espelhamento.
- Tela `/prestadores`: edição existente continua funcionando — alterações refletem em `profiles` automaticamente.
- Botão "+ Novo usuário staff" em `/usuarios` aceita só admin/engenharia (edge function `create-staff-user` com magic link). Técnico/supervisor continua só via aprovação em `/prestadores`.

**Constraint:** Engenheiros e admins não têm prestador, então o modal mostra apenas seções "básico" e "papéis".
