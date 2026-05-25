---
name: Provisionamento staff como técnico escalável
description: Supervisores/líderes (e eletromecânicos) viram escaláveis via prestadores+tecnicos+role tecnico_campo. UI em /usuarios + edge function provision-staff-as-tecnico; approve-prestador inclui supervisao/lider em FIELD_ROLES.
type: feature
---

**Regra:** "Ser escalável como técnico" depende apenas de ter linha em `public.tecnicos` (linkada a profile + prestador). Não há filtro por role nas queries de escala (`ScheduleModal`, `MultiTechnicianOSDialog`, `RouteMap`, score, agenda, insumos).

**Quem é elegível:** usuários com qualquer role em `('supervisao','lider','sup_eletromecanico','lider_eletromecanico','eletromecanico')`.

**Provisionamento garante 3 coisas:**
1. `prestadores` row (match por email), com `categoria` derivada por prioridade: sup_eletromecanico > lider_eletromecanico > eletromecanico > supervisor > lider. `ativo=true`, `status_candidatura='aprovado'`, `user_id` preenchido.
2. `tecnicos` row com `profile_id` + `prestador_id`.
3. Role adicional `tecnico_campo` em `user_roles` (libera UI: Minhas OS, dashboard de técnico, notificações, aceite via e-mail).

**Pontos de provisionamento:**
- **Automático**: `approve-prestador` inclui `supervisao` e `lider` em `FIELD_ROLES` — novos cadastros já saem prontos.
- **Sob demanda**: botão "Tornar escalável" / "Remover da escala" no card de `/usuarios` (admin), chamando `provision-staff-as-tecnico` edge function.
- **One-off**: migration de dados rodada uma vez cobrindo todos os staff existentes (Dayn, Adailton, supervisores eletromecânicos).

**Edge function `provision-staff-as-tecnico`:**
- Body `{ profile_id, action: 'provision'|'unprovision' }`. Caller deve ser admin.
- Provision idempotente: upsert prestador, insert tecnicos `ON CONFLICT DO NOTHING`, upsert user_roles.
- Unprovision: bloqueia se houver OS ativas (`aceite_tecnico IN ('pendente','aceito','aprovado')`); senão deleta `tecnicos` e tira role `tecnico_campo` (mantém `prestadores` para histórico).

**RDO escalability:** `rdoService.listEletromecanicos` agora lista por **categoria OU por role** — staff com role eletromecânico (mesmo que `prestadores.categoria` seja `supervisor`) aparece na equipe de RDO. Implementação: union de `prestadores WHERE categoria IN (eletromec*)` + `tecnicos JOIN profiles WHERE user_roles.role IN (eletromec*)`.

**Caso real:** Hercules (supervisao + tecnico_campo) sempre funcionou porque alguém criou as 3 coisas manualmente. Agora qualquer supervisor/líder/eletromecânico recebe o mesmo tratamento via UI ou aprovação de candidatura.
