---
name: RME ticket_id — sincronia automática com a OS
description: Triggers garantem que rme_relatorios.ticket_id sempre reflita o ticket da OS vinculada. Cliente não precisa (e não deve) tentar manter essa denormalização manualmente.
type: feature
---

`rme_relatorios.ticket_id` é um campo denormalizado: poderia ser derivado via `ordem_servico_id → ordens_servico.ticket_id`, mas é mantido na tabela por performance e para suportar consultas como `get_ticket_rme_group_context` e `get_rme_pendencias_insumos`.

Para garantir que essa denormalização nunca fique inconsistente, dois triggers cobrem todos os cenários de mudança:

### 1. `trg_sync_rme_ticket_id` (BEFORE INSERT/UPDATE em `rme_relatorios`)
Função: `public.sync_rme_ticket_id()`
- Em todo INSERT ou UPDATE de `ordem_servico_id`/`ticket_id`, busca `ordens_servico.ticket_id` da OS vinculada e **sobrescreve** `NEW.ticket_id` com o valor correto.
- Se a OS não existir, lança exceção (proteção contra `ordem_servico_id` órfão).
- **Consequência:** o frontend pode omitir `ticket_id` no insert (o trigger preenche). Se enviar errado, o trigger corrige silenciosamente.

### 2. `trg_propagate_os_ticket_change_to_rme` (AFTER UPDATE em `ordens_servico`)
Função: `public.propagate_os_ticket_change_to_rme()`
- Cenário raro: remapeamento da OS para outro ticket. Detecta a mudança em `OLD.ticket_id IS DISTINCT FROM NEW.ticket_id` e propaga para o RME vinculado em cascata.

### Saneamento retroativo
A migração que criou os triggers também rodou um `UPDATE` corrigindo todos os RMEs cujo `ticket_id` estava divergente do ticket da OS, eliminando inconsistências históricas.

### Implicações para o código
- `rmeService.createRME()` ainda envia `ticket_id` no payload — está correto, o trigger valida/normaliza.
- Não criar lógica frontend para "atualizar ticket_id do RME quando OS muda" — o trigger resolve.
- Queries que faziam join `os → tickets` para validar consistência podem ser simplificadas: `rme.ticket_id` é fonte de verdade confiável.
