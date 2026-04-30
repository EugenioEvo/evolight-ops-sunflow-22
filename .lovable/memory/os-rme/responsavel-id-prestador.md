---
name: tecnico_responsavel_id armazena prestadores.id
description: Decisão arquitetural — colunas tickets.tecnico_responsavel_id e ordens_servico.tecnico_responsavel_id apontam para prestadores.id (NÃO tecnicos.id). Qualquer JOIN para resolver o responsável precisa passar por prestadores → tecnicos.prestador_id → profiles.
type: feature
---

As colunas `tickets.tecnico_responsavel_id` e `ordens_servico.tecnico_responsavel_id` armazenam identificadores da tabela `prestadores`, não de `tecnicos`. Isso é proposital e é usado em:

- `useTechnicianScore.tsx` — mapeia carga de OS por prestador
- `buildOSPDFData.ts` — busca o nome do responsável em `prestadores`
- Joins implícitos `prestadores:tecnico_responsavel_id(...)` espalhados em vários services

**Regra de ouro ao resolver o responsável → técnico (auth):**

```sql
-- ERRADO — JOIN nunca casa
LEFT JOIN tecnicos t ON t.id = tickets.tecnico_responsavel_id

-- CERTO — passa por prestadores
LEFT JOIN prestadores pr ON pr.id = tickets.tecnico_responsavel_id
LEFT JOIN tecnicos t ON t.prestador_id = pr.id
LEFT JOIN profiles p ON p.id = t.profile_id
```

**Bug histórico que isso causou (corrigido):** a função `get_ticket_rme_group_context` fazia o JOIN errado, retornando `responsavel_email = NULL`. Como `RMEWizard.handleFinalize` valida com `responsavelEmail === profile.email`, o técnico responsável real ficava bloqueado de concluir o RME — efeito colateral aparecia em qualquer ticket.

Ao adicionar novas funções/queries que dependam de "quem é o responsável", sempre validar o caminho prestadores → tecnicos antes de comparar com `auth.uid()` ou `profile.id`.
