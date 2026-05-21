---
name: Devolução multi-OS e Entradas Pendentes
description: lote_id em insumo_saidas propaga devolução entre OSs irmãs; insumo_entradas_pendentes registra sobras de não-retornáveis para validação do backoffice
type: feature
---

## Multi-OS via lote_id
- `insumo_saidas.lote_id` (uuid) agrupa saídas criadas no mesmo ato (mesmo técnico, mesmo item, várias OSs).
- `useSupplyActions.onSubmitSaida` gera 1 `crypto.randomUUID()` e reutiliza em todas as inserções do batch.
- `supplyService.createDevolucao` chama RPC `register_devolucao_lote(saida_id, qtd, obs, evidencias)`:
  - Localiza todas as saídas do mesmo `lote_id` com `retornavel=true`
  - Insere uma `insumo_devolucao` em cada, com `qty = LEAST(qtd_solicitada, saldo_individual)`
  - Funciona idêntico via RMEInsumosPanel, MinhasDevolucoes e BackofficeInsumos
- Backoffice e MinhasDevolucoes agrupam visualmente por `lote_id` (1 card por lote, lista as OSs).

## Entradas Pendentes (sobras de não-retornáveis)
- Tabela `insumo_entradas_pendentes` com RLS: técnico dono ou staff/backoffice insere; só staff/backoffice aprova/rejeita.
- Trigger `handle_entrada_pendente_aprovada` soma ao estoque ao aprovar (suporta insumo e kit).
- Em MinhasDevolucoes, itens não-retornáveis com saldo mostram botão "Registrar sobra".
- Backoffice tem aba "Entradas pendentes" com aprovar/rejeitar.

## RPCs de leitura
- `get_minhas_devolucoes()` retorna `lote_id` + `entradas` jsonb.
- `get_backoffice_devolucoes()` lista todas saídas retornáveis ainda em jogo + devoluções aninhadas.
- `get_backoffice_entradas_pendentes()` lista entradas com técnico/OS resolvidos.
