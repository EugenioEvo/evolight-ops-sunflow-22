---
name: Technician can cancel OS acceptance
description: After accepting an OS (still pending execution), a technician can cancel the acceptance, which routes through the rejection flow with a mandatory reason.
type: feature
---
**Rule:** enquanto a OS estiver no estado `aceite_tecnico = 'aceito'` e ainda não tiver iniciado execução (`tickets.status` em `ordem_servico_gerada` ou `aprovado`), o card em **Minhas OS** exibe o botão "Cancelar aceite (devolver para gestão)" para o próprio técnico.

**Comportamento:** o botão abre o mesmo `RecusaOSDialog` (motivo obrigatório) e dispara `useAceiteOS.rejectOS`, que:
- atualiza `aceite_tecnico = 'recusado'`, grava `motivo_recusa` e `aceite_at`;
- reverte o ticket para `aprovado` se não houver outra OS ativa para o mesmo ticket;
- chama a edge function `send-rejection-notice` (notifica o criador do ticket);
- cria notificação in-app para staff (`admin`, `engenharia`, `supervisao`).

**Por quê:** evita que uma OS aceita por engano fique presa com o técnico sem caminho de retorno — gestão recebe o pedido de reatribuição imediatamente, com motivo registrado para auditoria.

**Não aplicar quando:** a OS já está em execução (`em_execucao`) ou concluída — nestes casos somente staff pode cancelar/reverter via Agenda.
