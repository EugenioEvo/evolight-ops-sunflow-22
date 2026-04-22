---
name: Fluxo de Insumos — Saída por OS, Devolução no RME, Validação BackOffice
description: Saídas de insumo/KIT são amarradas a uma OS aceita por um técnico, com flag retornável, devolução visível no RME e validação obrigatória pelo BackOffice
type: feature
---

A movimentação de insumos do estoque para o campo é centralizada na figura do técnico e amarrada a uma Ordem de Serviço aceita. O fluxo substitui completamente a antiga tabela `responsaveis` (que permanece apenas como histórico de `movimentacoes` administrativas).

## Modelo
- `insumos.retornavel` (boolean): indica se o item deve voltar ao estoque (ex: ferramentas, EPIs reutilizáveis).
- `kits` + `kit_itens`: agrupador estático cadastrado por admin/backoffice; uma saída de KIT decrementa cada item filho proporcionalmente.
- `insumo_saidas`: tabela única de saídas de campo. Campos-chave: `insumo_id` XOR `kit_id`, `quantidade`, `retornavel` (snapshot), `ordem_servico_id` (obrigatório), `tecnico_id`, `registrado_por`, `status` (`pendente_aprovacao` | `aprovada` | `rejeitada` | `devolvida_total` | `devolvida_parcial`), `quantidade_devolvida`, `aprovado_por`/`aprovado_at`, `rejeitado_motivo`.
- `insumo_devolucoes`: cada devolução é uma linha com `saida_id`, `quantidade`, `status` (`pendente_aprovacao` | `aprovada` | `rejeitada`).

## Estoque
- Trigger `AFTER INSERT` em `insumo_saidas` decrementa `insumos.quantidade` imediatamente (KIT expande pelos `kit_itens`).
- Rejeição da saída pelo backoffice estorna o estoque.
- Devolução aprovada incrementa o estoque e atualiza `quantidade_devolvida`/`status` da saída de origem.

## UI — registrar saída
Acesso: `/insumos` (técnicos, staff e backoffice). O dialog "Registrar Saída":
1. Toggle Item avulso / KIT.
2. Combobox do insumo ou KIT.
3. Quantidade.
4. Técnico responsável: se quem registra é técnico, vem preenchido com seu nome e fica desabilitado; caso contrário, combobox.
5. Ordem de Serviço: dropdown bloqueado até escolher técnico; depois lista apenas as OS do técnico via RPC `get_tecnico_os_ativas` (OS com `aceite_tecnico in ('aceito','aprovado')` cujo ticket está em `ordem_servico_gerada`/`em_execucao`).
6. Observações.

A OS pode ser pré-selecionada via querystring `/insumos?os=<id>` — usado pelo botão "Registrar Saída de Insumo" no `OSCard` (Minhas OS) que aparece para o técnico após aceitar a OS.

## RME
- O painel `RMEInsumosPanel` aparece no topo de cada passo do RME Wizard e lê via RPC `get_rme_pendencias_insumos` todas as saídas das OS irmãs do mesmo ticket.
- Dentro do RME, qualquer técnico envolvido pode registrar devolução enquanto o RME estiver em `rascunho` ou `rejeitado`. Status `pendente`/`aprovado` bloqueia novas devoluções.
- Trigger em `rme_relatorios` quando `status → aprovado` notifica todos com role `backoffice` se houver saídas pendentes/não devolvidas.

## Painel BackOffice
Rota `/backoffice/insumos` (acesso para `backoffice` + staff). Tabs:
- Saídas pendentes: aprovar ou rejeitar (com motivo).
- Devoluções pendentes: aprovar ou rejeitar.

## Permissões resumidas
- `insumos`: leitura para staff/backoffice/`tecnico_campo`; escrita só staff/backoffice (técnico não cria insumo).
- `kits`/`kit_itens`: leitura igual a insumos; escrita só admin/backoffice.
- `insumo_saidas` / `insumo_devolucoes`: leitura para staff/backoffice e técnico dono da OS; INSERT pelo próprio técnico ou staff/backoffice; UPDATE de status só staff/backoffice.

## Botão removido
O botão "+ Novo Responsável" da página Insumos foi eliminado. A tabela `responsaveis` segue existindo apenas como referência histórica das `movimentacoes` legadas.
