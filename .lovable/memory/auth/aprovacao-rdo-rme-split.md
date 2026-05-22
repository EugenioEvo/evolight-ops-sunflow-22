---
name: aprovacao-rdo-rme-split
description: Quem aprova RDO vs RME — split por especialidade (eletromecânico vs elétrico).
type: feature
---
**Regra:**
- **RME** (elétrico): aprovado por `admin`, `engenharia`, `supervisao`. Líder elétrico (`lider`) NÃO aprova.
- **RDO** (eletromecânico): aprovado por `admin`, `engenharia`, `sup_eletromecanico`. Líder eletromecânico (`lider_eletromecanico`) NÃO aprova, mas pode submeter (junto com `sup_eletromecanico`).
- Usuário com múltiplos roles (ex.: `supervisao` + `sup_eletromecanico`) aprova ambos naturalmente via union de roles.

**Onde aplicado:**
- Rotas: `/gerenciar-rme` (App.tsx), `/gerenciar-rdo` (App.tsx).
- Sidebar: itens "Aprovar RMEs" e "Aprovar RDOs" com `allow` específico.
- Edge functions: `send-rme-submitted-email` filtra `['admin','engenharia','supervisao']`; `send-rdo-submitted-email` filtra `['admin','engenharia','sup_eletromecanico']`.
- In-app helpers: `notifyRMESubmitted` e `notifyRDOStaffSubmitted` (rdoService.ts) usam os mesmos filtros.
- RLS: policy `Sup eletromec approves RDO` permite UPDATE em `rdo_relatorios` para sup_eletromecanico. RME continua via `is_staff` (que inclui `lider`; mas UI/funções já restringem).
