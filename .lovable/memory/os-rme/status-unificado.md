---
name: RME status unificado
description: Coluna única `rme_relatorios.status` com 4 valores (rascunho, pendente, aprovado, rejeitado). status_aprovacao foi descontinuada.
type: feature
---

Após a migração de Abril 2026, o ciclo de vida do RME usa **um único campo** `rme_relatorios.status`:

- `rascunho` — técnico está montando, pode editar/salvar/imprimir/submeter
- `pendente` — submetido para avaliação, **edição bloqueada** (apenas visualizar e imprimir)
- `aprovado` — avaliador aprovou, edição permanentemente travada, libera conclusão da OS
- `rejeitado` — avaliador rejeitou, técnico pode editar e re-submeter (volta para `pendente`)

Helpers em `src/utils/rmeStatus.ts`:
- `isRMEEditable(status)` → true para `rascunho` e `rejeitado`
- `isRMELocked(status)` → true para `pendente` e `aprovado`
- `isRMEApproved(status)` → true apenas para `aprovado`
- `RME_STATUS_LABEL` / `RME_STATUS_BADGE_CLASS` para UI
- `normalizeRMEStatus()` para coerção segura de strings legadas

**Regras de negócio derivadas:**
- OS só pode ser concluída se `status === 'aprovado'` (validado pelo trigger `validate_os_completion`).
- Botão "Editar RME" no detalhe da OS vira "Visualizar RME" quando `isRMELocked`.
- PDF (gerado por `generateRMEPDF.ts`) sempre reflete o status real no badge do header.
- RLS de `rme_relatorios` permite UPDATE pelo técnico apenas em `rascunho` ou `rejeitado`.
- Trigger `notify_rme_status_change` dispara notificações in-app de aprovação/rejeição; e-mails saem via `send-rme-decision-email`.
