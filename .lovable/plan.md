## Diagnóstico

Hoje, "ser escalável" no agendamento (`ScheduleModal`, `MultiTechnicianOSDialog`, `RouteMap`, score, etc.) depende **apenas de existir uma linha em `public.tecnicos**` ligada ao `profile_id` do usuário. Não há filtro por role.

O Hércules funciona porque, além da role `supervisao`, ele tem:

- linha em `prestadores` (categoria técnica) e
- linha em `tecnicos` (com `prestador_id` apontando para ela) e
- role extra `tecnico_campo` em `user_roles` — isso libera a UI de técnico (Minhas OS, dashboard de técnico, aceite via e-mail/app).

Dayn e Adailton (líderes) não têm essas linhas, por isso não aparecem na escala. A função `approve-prestador` já cria `prestadores` + `tecnicos` para roles de campo (`tecnico_campo`, `eletromecanico`, `sup_eletromecanico`, `lider_eletromecanico`), mas **exclui `supervisao` e `lider**` do array `FIELD_ROLES`. Por isso supervisores/líderes nunca ganham o registro em `tecnicos`.

## Recomendação

Adotar o **mesmo padrão multi-role do Hércules** de forma automática para qualquer supervisor/líder: garantir que tenham (a) `prestadores`, (b) `tecnicos` linkado, (c) role extra `tecnico_campo`. Isso é o caminho de menor risco — não mexe em RLS, em scoring, em agenda, nem em queries existentes — apenas usa a infra que já funciona.

Vou expor a operação em **dois lugares complementares**, sem mudar fluxos atuais:

1. **Botão "Tornar escalável como técnico"** no card de cada usuário em `/usuarios` (Usuários do sistema), visível para admin quando o usuário é supervisor/líder/sup_eletromecanico/lider_eletromecanico e ainda não tem registro em `tecnicos`. Botão complementar "Remover da escala" para reverter (apaga `tecnicos` e tira a role `tecnico_campo`; mantém `prestadores` inativo para histórico).
2. **Provisionamento automático no `approve-prestador**`: incluir `supervisao` e `lider` em `FIELD_ROLES`. Assim, supervisores/líderes criados via fluxo de candidatura/aprovação já saem escaláveis sem etapa extra.

Para os 2-3 usuários atuais (Dayn, Adailton, etc.), aplico o provisionamento em **migration de dados** (idempotente, usando email do profile) para que apareçam na escala imediatamente, sem depender de clicar no botão.

## Detalhes técnicos

### Edge function nova: `provision-staff-as-tecnico`

- Body: `{ profile_id }`. Auth: admin.
- Lê `profiles`. Garante `prestadores` (cria com `categoria='Equipe Evolight'`, `ativo=true`, `status_candidatura='aprovado'`, vinculado por email/`user_id`) — se já existir, reaproveita.
- Garante `tecnicos` com `profile_id` e `prestador_id` setados (UNIQUE em `profile_id` evita duplicata).
- `INSERT … ON CONFLICT DO NOTHING` em `user_roles (user_id, 'tecnico_campo')`.
- Retorna ids criados/encontrados.

Edge function reversa `unprovision-staff-as-tecnico`: deleta `tecnicos` (FK em OS é `tecnico_id` que pode permanecer histórico — confirmar antes; se houver OS vinculadas ativas, bloquear), remove role `tecnico_campo`, marca `prestadores.ativo=false`.

### UI — `src/pages/Usuarios.tsx`

- No card, quando `roles` inclui `supervisao | lider | sup_eletromecanico | lider_eletromecanico` e `!row.tecnico`:
  - Mostrar botão "Tornar escalável como técnico" (invoca a edge e dá `reload`).
- Quando o usuário já tem `tecnicos`:
  - Badge "Escalável" + botão "Remover da escala".
- Carregar mais um lookup: `Set<profile_id>` com quem tem `tecnicos` (já temos `tecnicos` em `load()`).

### Migration de dados (one-off)

- Para cada profile staff com role em `('supervisao','lider','sup_eletromecanico','lider_eletromecanico')` que ainda não tem `tecnicos`:
  - upsert em `prestadores` (match por email),
  - insert em `tecnicos` (profile_id, prestador_id),
  - insert em `user_roles (user_id, 'tecnico_campo') ON CONFLICT DO NOTHING`.

### `approve-prestador`

- Acrescentar `'supervisao'` e `'lider'` em `FIELD_ROLES` para automatizar novos cadastros.

## Impactos esperados

- Supervisores/líderes provisionados passam a aparecer em: `ScheduleModal`, `MultiTechnicianOSDialog`, `useTechnicianScore`, `RouteMap` (filtro por técnico), `Insumos` (técnico responsável), notificações de aceite/recusa, e-mails com botões de aceite, "Minhas OS" e dashboard de técnico.
- Não há mudança de RLS: as policies de `tecnicos`/`ordens_servico` já comportam multi-role (confirmado pelo Hércules).
- Risco: supervisor recebe convites .ics quando escalado — comportamento esperado e desejado.

## Alternativas descartadas

- **Reescrever queries para listar staff com role supervisao/lider sem `tecnicos**`: tocaria 10+ pontos (agenda, score, conflito, e-mail de aceite, RLS de aceite). Alto blast radius e duplica a fonte da verdade.
- **Trigger DB automatizando provisionamento**: opaco, esconde efeito colateral; preferimos edge function explícita + botão.

## Pergunta única antes de implementar

Quer que o provisionamento seja **automático para todo supervisor/líder existente** (rodo a migration de dados agora cobrindo Dayn, Adailton e demais), ou prefere **caso a caso pelo botão** em `/usuarios`? Pode implementar automático. Também garanta que da mesma forma eles possam ser escaláveis nos RDOs de obas quando possuírem o flag de eletromecânico eom conjunto com os demais