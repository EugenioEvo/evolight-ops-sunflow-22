# Padronizar Hércules como supervisor escalável

Trazer o cadastro do Hércules para o mesmo padrão do Dayn, sem mudanças de código. Atentar que Dayn é Supervisor de obras/eletromecânico (RDO) e Hercules Supervisor Técnico/Elétrico (RME). Ambos podem exercer em paralelo atividades de técnicos e/ou eletromecãnicos desde que acumulem esses flags.

## Migração de dados (idempotente)

Sobre o `prestador` `c67f5c32-1aaf-4eb2-9de0-47e8c6a6c1de` e o `profile` `39bd3d1d-5275-41e9-8328-ab6454d768f8`:

1. **Vincular prestador ao auth user**
  `UPDATE prestadores SET user_id = '39bd3d1d…' WHERE id = 'c67f5c32…' AND user_id IS NULL`
2. **Refletir o cargo real**
  `UPDATE prestadores SET categoria = 'supervisao' WHERE id = 'c67f5c32…'`
3. **Garantir roles `supervisao` + `tecnico_campo**` em `user_roles` (ON CONFLICT DO NOTHING para o par user_id+role).
4. **Confirmar `tecnicos**` existente já apontando para esse prestador (verificar; criar se faltar — mas pelo diagnóstico anterior o `tecnicos` já existe).
5. **Sincronizar `tecnicos.profile_id**` com o profile do Hércules, caso esteja nulo ou divergente.

## Resultado esperado

- Continua aparecendo no modal "Gerar OS" (já estava).
- `/usuarios` passa a mostrar badge "Escalável como técnico" e os botões de remover/escalar.
- Login do Hércules passa a ver as próprias OSs (RLS chain `prestadores.user_id → tecnicos → profile` fica completa).
- E-mails e push de aceite funcionam normalmente porque agora há role `tecnico_campo`.
- RDO continua listando-o (a query já une `categoria` + `user_roles`).

## Verificação pós-migração

Reexecutar a query de diagnóstico para confirmar que Hércules aparece com:

- `prestador_user_id` = profile.id
- `categoria` = `supervisao`
- `roles` inclui `supervisao` e `tecnico_campo`
- `tecnico_id` não nulo

## Fora de escopo

- Nenhuma mudança de código.
- Não tocar em outros prestadores com `categoria='tecnico'` (Weberson, Adrian, Diego ficam como estão — eles são técnicos puros).