---
name: Tickets nunca são excluídos — apenas cancelados
description: Tickets são fonte de verdade para OS/RME/histórico. Não podem ser hard-deletados. Cancelamento cascateia para todas as OS vinculadas e é bloqueado se existir RME em rascunho.
type: feature
---

Tickets são a fonte de verdade do sistema (OS, RME, histórico de status, aprovações e logs apontam para eles). Por isso **não podem ser excluídos da base** — apenas cancelados.

## Regras

1. **Cancelar (não excluir):** o botão na listagem de tickets é "Cancelar Ticket". `ticketService.delete()` foi mantido apenas como guarda e lança erro se chamado.
2. **Bloqueio por RME em rascunho:** o cancelamento é bloqueado se existir **pelo menos 1 RME com `status='rascunho'`** vinculado ao ticket (`rme_relatorios.ticket_id = :id`). O usuário precisa concluir/excluir o RME antes.
3. **Cascata para OS vinculadas:** ao cancelar, todas as OS do ticket que **não estão** `concluido`/`cancelado` têm seus campos de agendamento limpos (`data_programada`, `hora_inicio`, `hora_fim`, `duracao_estimada_min = NULL`) liberando o slot de agenda.
4. **Status do ticket:** atualizado para `cancelado` (e `data_conclusao = NULL`). Em `WorkOrders.tsx` o `getOSStatus` já mapeia `ticket.status === 'cancelado' → "cancelada"`, então o badge propaga para todas as OS irmãs sem alteração adicional.
5. **Notificações:** para cada OS cancelada na cascata o sistema dispara `send-calendar-invite` com `action: 'cancel'` (ICS CANCEL ao técnico) e `notifyOSCancelled` (in-app + email ao criador). Conforme regra existente, o email de cancelamento é enviado **antes** de qualquer alteração destrutiva.

## Implementação

- `src/features/tickets/services/ticketService.ts → cancel(ticketId)` faz o guard de RME, busca OS canceláveis, limpa scheduling, flipa status e devolve a lista.
- `src/features/tickets/hooks/useTicketMutations.ts → cancelTicket(id, motivo?)` orquestra notificações em paralelo.
- `src/features/tickets/components/TicketCard.tsx → CancelButton` substitui o antigo `DeleteButton`. Visível em todos os status exceto `concluido` e `cancelado`.

## Por que esta regra existe

A função `auto_complete_ticket_on_rme_approval` e `validate_os_completion` dependem do ticket existir; deletar um ticket com OS/RME violaria FKs e quebraria histórico de auditoria. Cancelar preserva tudo (status timeline, RME aprovados, anexos) enquanto sinaliza a operação como encerrada sem execução.
