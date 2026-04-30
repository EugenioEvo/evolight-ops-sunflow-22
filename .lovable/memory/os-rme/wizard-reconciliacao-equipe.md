---
name: RME Wizard reconcilia aceite das OS irmãs ao concluir
description: Ao submeter um RME, o sistema usa a lista de "Colaboradores Presentes" como verdade — promove OSs pendentes a aceito (técnico marcado) e marca como recusado quem não está marcado, eliminando a necessidade de o responsável esperar aceites manuais.
type: feature
---

## Comportamento

Quando o técnico responsável clica "Concluir RME" (`handleFinalize` em `src/pages/RMEWizard.tsx`), antes de salvar `status='pendente'` o sistema executa `reconcileTeamFromCollaboration(ticketId)`:

Para cada OS irmã (mesmo `ticket_id`, exceto a do próprio responsável):
- Está em `collaboration` e `aceite_tecnico in ('pendente')` → vira `aceito` (`aceite_at = now()`).
- NÃO está em `collaboration` e `aceite_tecnico in ('pendente','aceito','aprovado')` → vira `recusado` com `motivo_recusa` automático ("Técnico ausente conforme RME do responsável").
- Está em `aceite_tecnico = 'recusado'` → mantida (decisão prévia do técnico nunca é sobrescrita).

A reconciliação é "best-effort": falhas são logadas e geram toast de atenção, mas não bloqueiam a submissão do RME.

## Catálogo de colaboradores

`get_ticket_rme_group_context` retorna técnicos cujas OSs estão em `pendente`, `aceito` ou `aprovado` (antes era apenas aceitos/aprovados). A função também devolve o `aceite_status` de cada um para a UI exibir badge ("Em aprovação"/"Aceita"/"Aprovada").

`StepIdentification` usa esse status para destacar visualmente cada opção do dropdown de Colaboradores Presentes.

## Refresh ao entrar na etapa 1

Além do canal Realtime existente (`rme-wizard-os-${ticketId}`), o wizard chama `loadGroupContext` toda vez que `currentStep === 1` (useEffect dedicado). Isso garante que técnicos que aceitaram entre etapas reapareçam imediatamente sem reload manual.

## Implicação operacional

O responsável não precisa mais aguardar a equipe aceitar manualmente para fechar o RME — basta marcar quem esteve em campo. O fluxo de notificação de aceite/recusa continua disparando normalmente porque a UPDATE em `ordens_servico` não muda (mesma transição de status).
