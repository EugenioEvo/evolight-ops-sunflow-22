---
name: tecnicos-prestadores-fk-link
description: tecnicos.prestador_id (FK) substitui matching por email entre tecnicos e prestadores. approve-prestador preenche o link; ProtectedRoute consulta via FK.
type: feature
---
**Regra:** A relação entre `tecnicos` e `prestadores` é feita pela coluna `tecnicos.prestador_id` (FK opcional, ON DELETE SET NULL). Não usar mais matching por email.

**Onde aplicar:**
- Edge function `approve-prestador`: ao criar `tecnicos` para um prestador aprovado, sempre setar `prestador_id = prestador.id`. Se já existir técnico sem o link, fazer backfill.
- `ProtectedRoute.tsx`: gate de aprovação consulta `tecnicos.prestadores(ativo)` via FK. Mantém fallback por email apenas para técnicos legacy ainda não migrados.
- RLS de `prestadores` (policy "Technicians view own provider record via FK"): usa join `tecnicos.prestador_id = prestadores.id` em vez de comparar emails.

**Por quê:** Email pode mudar, ter case diferente, ou ser editado em uma das tabelas e não na outra — quebrava a visibilidade silenciosamente. FK é estável.

**Tech-debt remanescente:** `prestadores` ainda duplica nome/email/telefone que existem em `profiles`. A unificação completa em uma tabela só (`pessoas_operacionais`) está adiada — ver [mem://tech-debt/unificacao-prestadores-tecnicos].
