

# Sugestoes e detalhes adicionais para o plano de multi-tecnico e conflito

## Pontos que o plano atual ja cobre bem
- Troca de tecnico com notificacoes (email + in-app)
- Multi-selecao de tecnicos gerando N OS
- Bloqueio por conflito via `check_schedule_conflict` RPC

## Detalhes esquecidos / Sugestoes

### 1. Edge function `gerar-ordem-servico` bloqueia multiplas OS (linha 44)
A edge function atual faz `maybeSingle()` e retorna a OS existente se ja houver uma para o ticket. Para multi-tecnico funcionar, essa checagem precisa ser removida ou ajustada para verificar por `tecnico_id` especifico, nao apenas por `ticket_id`. **Ja esta no plano, mas e critico.**

### 2. Validacao de status `aprovado` na edge function (linha 139)
Ao gerar a 2a OS para o mesmo ticket, o status ja sera `ordem_servico_gerada` (setado na 1a chamada, linha 277). A edge function precisa aceitar tanto `aprovado` quanto `ordem_servico_gerada` quando `tecnico_override_id` for fornecido, senao a 2a OS falhara.

### 3. Pagina WorkOrders.tsx — visualizacao de multiplas OS por ticket
Hoje o layout mostra OS agrupadas por ticket implicitamente. Com multiplas OS por ticket, seria bom agrupar visualmente ou ao menos mostrar um indicador "1 de 3 OS para este ticket".

### 4. WorkOrderDetail.tsx — Troca de tecnico diretamente da OS
Alem de trocar pelo Tickets.tsx, faz sentido permitir trocar tecnico diretamente na pagina de detalhe da OS (WorkOrderDetail), ja que o gestor pode estar visualizando a OS quando decide trocar.

### 5. Historico de atribuicoes
Quando um tecnico e trocado, registrar no `audit_logs` ou criar um campo `historico_tecnicos` na OS para rastreabilidade. O trigger `audit_trigger` ja existe, entao isso ja pode ser coberto automaticamente se estiver ativo na tabela `ordens_servico`.

### 6. MinhasOS.tsx — Tecnico ver que foi desatribuido
Se o tecnico esta na tela MinhasOS e a OS e reatribuida, o realtime precisa capturar o UPDATE e remover a OS da lista. Verificar se o listener atual faz refetch completo ou apenas append.

### 7. Notificacao ao tecnico antigo — conteudo do email
No cancelamento por troca, o email deveria dizer "Voce foi reatribuido" e nao "OS cancelada", para evitar confusao. Pode precisar de um novo action type `reassign_removed` no `send-calendar-invite`.

### 8. GerarOSDialog.tsx — Substituir por MultiTechnicianOSDialog
O dialog atual (`GerarOSDialog`) e usado em Tickets.tsx. Para multi-tecnico, substituir ou estender para incluir selecao de multiplos tecnicos com checkboxes + indicador de disponibilidade.

## Resumo de ajustes ao plano aprovado

| Item | Impacto | Prioridade |
|------|---------|------------|
| Ajustar validacao de status na edge function (aceitar `ordem_servico_gerada`) | Bloqueante para multi-OS | Alta |
| Novo action `reassign_removed` no email | Clareza para tecnico | Media |
| Agrupar OS por ticket no WorkOrders | UX | Media |
| Troca de tecnico direto do WorkOrderDetail | Conveniencia | Baixa |
| Verificar realtime em MinhasOS para reatribuicao | Consistencia | Alta |

Se concordar, posso seguir com a implementacao incluindo esses ajustes.

