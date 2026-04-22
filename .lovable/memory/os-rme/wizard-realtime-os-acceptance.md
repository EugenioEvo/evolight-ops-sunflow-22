---
name: RME Wizard — atualização realtime de colaboradores conforme aceites de OS
description: O Wizard do RME assina mudanças em ordens_servico do mesmo ticket via Supabase Realtime e recarrega a lista de técnicos disponíveis (colaboradores) sempre que algum técnico irmão aceita ou recusa a OS, mesmo após o preenchimento já ter começado.
type: feature
---

Quando um técnico responsável abre o Wizard do RME (`/rme-wizard/...`), `loadGroupContext(ticketId)` busca todas as OS irmãs do ticket e popula `availableTechnicians` apenas com aqueles que têm `aceite_tecnico in ('aprovado','aceito')`. Esta lista alimenta o multi-select "Colaboradores Presentes" no `StepIdentification`.

**Problema resolvido:** se outro técnico aceitava sua OS DEPOIS que o responsável já tinha aberto o wizard, ele não aparecia na lista até um reload manual.

**Solução:** `RMEWizard.tsx` mantém um canal Supabase Realtime (`rme-wizard-os-${ticketId}`) que escuta `INSERT` e `UPDATE` em `public.ordens_servico` filtrando por `ticket_id=eq.${ticketId}`. Qualquer evento dispara `loadGroupContext` novamente, repopulando `availableTechnicians` e o flag `isResponsavel`. O canal é criado/derrubado conforme `currentTicketId` muda e na desmontagem do componente.

**Implicações:**
- Não é necessário recarregar a página quando colegas aceitam suas OS — o dropdown de colaboradores reflete em poucos segundos.
- O `tecnico_responsavel_id` também é reavaliado, então se o responsável for trocado durante o preenchimento o estado `isResponsavel` se ajusta sozinho (e o botão de Concluir RME pode ser habilitado/desabilitado de acordo).
- Pré-requisito: a tabela `ordens_servico` deve estar publicada em `supabase_realtime`. Caso ainda não esteja, o wizard funciona normalmente (sem o refresh automático) — não há erro.
