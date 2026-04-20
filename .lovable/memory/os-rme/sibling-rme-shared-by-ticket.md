---
name: RME compartilhado por ticket — refletir em OS irmãs
description: Quando várias OS pertencem ao mesmo ticket, o RME do técnico responsável deve aparecer em todas as OS irmãs (badge e ações), pois há apenas um RME por ticket.
type: feature
---

Um ticket pode gerar várias Ordens de Serviço (uma por técnico). O RME, porém, é único por ticket — preenchido pelo técnico responsável em nome de toda a equipe (`rme_relatorios.ticket_id` referencia o ticket; `ordem_servico_id` aponta para a OS do responsável).

Para que o status do RME (rascunho/pendente/aprovado/rejeitado) fique visível em todas as OS irmãs, os serviços de listagem fazem **enriquecimento por ticket**:

- `src/features/work-orders/services/workOrderService.ts → loadAll()`
- `src/features/my-orders/services/myOrdersService.ts → loadOrdensServico()`

Após buscar as OS, identificam quais ficaram sem `rme_relatorios` próprio, agrupam por `ticket_id` e fazem uma 2ª query em `rme_relatorios` filtrando por `ticket_id IN (...)`. O RME mais recente do ticket é mesclado nas OS irmãs (`rme_relatorios = [{ id, status }]`).

**Consequências de UX:**
- Card de OS na listagem (`WorkOrders.tsx`) e em `Minhas OS` mostra `RME: Aprovado/Pendente/Rejeitado` mesmo quando a OS irmã não é a "dona" do RME.
- O botão "Ver RME em PDF" em `OSCard` fica disponível para a equipe inteira após submissão.
- Realtime: `useGlobalRealtime` já escuta `rme_relatorios`, então qualquer mudança no RME do responsável reflete instantaneamente em todas as OS irmãs após o reload.

**Atenção:** ao concluir o RME (status `aprovado`), o trigger `auto_complete_ticket_on_rme_approval` marca o ticket como `concluido`, o que cascateia para todas as OS irmãs (que passam a aparecer como "Concluída" na listagem).
