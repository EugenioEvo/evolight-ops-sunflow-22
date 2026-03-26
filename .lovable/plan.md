

# Resetar Aceite e Notificar Técnico ao Alterar/Excluir Ticket ou OS

## Contexto
Quando o gestor altera campos críticos (data, hora, tipo de serviço) no ticket ou na OS, ou exclui o ticket, o técnico que já aceitou precisa ser notificado e o ciclo de aceite deve ser resetado.

## Cenários cobertos

1. **Ticket editado** (data_servico, horario_previsto_inicio, equipamento_tipo alterados) — se já existe OS com aceite, resetar aceite e notificar técnico
2. **Ticket excluído** — se existe OS com técnico que aceitou, notificar técnico sobre cancelamento
3. **OS excluída** — já notifica o técnico (existente), apenas garantir que menciona o reset do aceite
4. **OS reagendada via ScheduleModal** — já reseta aceite (existente em useSchedule.tsx)

## Mudanças

### 1. `src/pages/Tickets.tsx` — onSubmit (edição de ticket)
Após atualizar o ticket no modo edição, verificar se existe OS vinculada com `aceite_tecnico = 'aceito'`. Se sim:
- Resetar `aceite_tecnico` para `'pendente'`, limpar `aceite_at` e `motivo_recusa` na OS
- Inserir notificação ao técnico informando que houve alteração no ticket e que ele precisa aceitar novamente
- Só fazer isso se campos críticos mudaram (`data_servico`, `horario_previsto_inicio`, `equipamento_tipo`)

### 2. `src/pages/Tickets.tsx` — handleDeleteTicket
Antes de excluir o ticket, buscar OS vinculada e técnico. Se técnico tinha aceite, notificá-lo sobre o cancelamento (complementar à notificação existente no handleDeleteOS de WorkOrders).

### 3. `src/pages/WorkOrders.tsx` — handleDeleteOS
A exclusão já notifica o técnico. Nenhuma mudança necessária aqui, pois a OS é excluída e o aceite deixa de existir.

### 4. `src/pages/WorkOrderDetail.tsx` / Edição de OS inline
Se houver edição de campos da OS (work_type, servico_solicitado, data_programada, hora_inicio/fim), resetar aceite e notificar. Atualmente não há formulário de edição inline na OS — a edição acontece via ScheduleModal (que já reseta). Se work_type/servico_solicitado forem editáveis no futuro, aplicar a mesma lógica.

## Resumo dos arquivos impactados
- `src/pages/Tickets.tsx` — lógica de reset de aceite ao editar/excluir ticket
- Nenhuma migration necessária (colunas já existem)

