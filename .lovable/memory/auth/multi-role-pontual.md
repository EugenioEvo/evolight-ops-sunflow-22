---
name: Multi-role pontual (acúmulo de roles por usuário)
description: O sistema suporta usuários com múltiplas roles em user_roles. useAuth carrega todas em profile.roles[] e expõe profile.role como "principal" via prioridade admin > engenharia > supervisao > tecnico_campo > cliente.
type: feature
---

**Regra:** Um mesmo `user_id` pode ter mais de uma row em `user_roles` (a UNIQUE é `(user_id, role)`). O sistema carrega **todas** as roles e expõe duas formas de uso:

- `profile.roles: AppRole[]` — lista completa, usar para checks operacionais (ex: "é técnico operacional?")
- `profile.role: AppRole` — role **principal** resolvida por prioridade `admin > engenharia > supervisao > tecnico_campo > cliente`. Usar para UI/redirect/sidebar (mantém compatibilidade com checks existentes).

**Caso real:** Hercules acumula `supervisao` + `tecnico_campo`. A role principal resolve para `supervisao` (UI de staff, pode aprovar RME inclusive os próprios). `roles.includes('tecnico_campo')` libera "Minhas OS" e o filtro de OS por técnico no `RouteMap`.

**Pontos sensíveis ajustados para multi-role:**
- `useAuth.fetchProfile`: troca `.maybeSingle()` por `select` sem limit — `.maybeSingle()` quebraria com 2+ rows.
- `useMyOrdersData`: `isTecnico` deriva de `roles.includes('tecnico_campo')`, não da role principal.
- `RouteMap`: filtro por `tecnico_id` usa o mesmo critério.
- `ProtectedRoute`: gate de "aprovação pendente" só dispara se o usuário for **exclusivamente** tecnico_campo (sem role de staff). Permissões de rota (`roles=[...]`) verificam interseção com `profile.roles[]`.

**O que NÃO foi tocado** (nem precisa, porque RLS já lida bem com múltiplas roles):
- `is_staff()`, `has_role()` no DB — checam `EXISTS` em `user_roles`, naturalmente multi-role.
- 75 referências a `profile.role === 'X'` em sidebar/permissões/dashboards continuam corretas via role principal.
- `create-user-profile` edge function — signup público continua criando 1 role (`cliente`).

**Decisão de governança:** supervisor que também é técnico **pode aprovar os próprios RMEs**. Conflito mitigado por `audit_logs` (rastro de quem aprovou).

**Como conceder multi-role a outro usuário:** `INSERT INTO user_roles (user_id, role) VALUES (...) ON CONFLICT DO NOTHING;` — sem refactor de código.
