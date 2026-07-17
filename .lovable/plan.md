# Ajustes no Catálogo de Atividades (`/obra-catalogo`)

Aplicar apenas no diálogo de criação/edição de atividade em `src/pages/ObraCatalogo.tsx`. Nenhuma mudança de schema ou backend.

## 1. Categoria vira combobox (lista + digitação livre)

- Trocar o `<Input>` do campo **Categoria** por um combobox (Popover + Command do shadcn) que:
  - Lista as categorias distintas já existentes em `items` (derivadas via `useMemo`, ordenadas alfabeticamente, case-insensitive).
  - Permite selecionar uma existente OU digitar uma nova (o texto digitado aparece como opção "Criar '<texto>'").
  - Mantém o valor em `form.categoria` como string simples (sem alterar tipo salvo).
- Comportamento tanto em **criar** quanto em **editar**.

## 2. Autopreenchimento ao escolher categoria (somente criação)

Quando `form.id` é indefinido (nova atividade) e o usuário seleciona/digita uma **categoria já existente**, pré-preencher os campos abaixo com o valor **mais frequente** entre os itens daquela categoria — apenas se o campo estiver vazio/no default (não sobrescrever o que o usuário já digitou manualmente):

- `unidade` (default atual `'un'` conta como vazio para efeito de auto-preencher)
- `tipo`
- `sort_order` (usar `max(sort_order da categoria) + 1` em vez da moda, para o novo item entrar no fim da categoria)

Ao editar (`form.id` definido), **não** aplicar autopreenchimento — respeita o que já está salvo.

## 3. Chave (`item_key`) derivada do Label — só na criação

- Na criação, gerar `item_key` automaticamente a partir do `label` conforme o usuário digita, usando slug:
  - lowercase, remover acentos, trocar não-alfanuméricos por `_`, colapsar `_` repetidos, trim.
  - Ex.: "Instalação de Painel FV" → `instalacao_de_painel_fv`.
- Se o usuário editar manualmente o campo Chave, marcar como "dirty" e parar de sincronizar automaticamente com o Label.
- Ao editar uma atividade existente, o campo Chave permanece como está hoje (edição manual livre, sem sync automático) — evita quebrar RDOs antigos por mudança acidental.

## Detalhes técnicos

- Arquivo único afetado: `src/pages/ObraCatalogo.tsx`.
- Combobox usa `Popover` + `Command`/`CommandInput`/`CommandItem` do shadcn (já disponíveis no projeto).
- Derivar dados agregados por categoria com `useMemo` sobre `items`:
  ```text
  categoriasDisponiveis: string[]                          // distintas, ordenadas
  defaultsPorCategoria: Record<categoria, {
    unidade: string (moda),
    tipo: string|null (moda),
    proximoSortOrder: number (max+1)
  }>
  ```
- Novo estado local `itemKeyDirty: boolean` (reset ao abrir o dialog: `false` em criação, `true` em edição).
- `openCreate` reseta `itemKeyDirty=false`; `openEdit` seta `true`.
- Ao mudar `label` em criação com `!itemKeyDirty`, atualizar `form.item_key = slug(label)`.
- Ao mudar `item_key` manualmente, `setItemKeyDirty(true)`.
- Ao selecionar/definir `categoria` em criação, aplicar defaults **apenas** aos campos ainda vazios/no default.

## Fora do escopo

- Estrutura da tabela `rdo_atividades_catalogo`, RLS, RDOs existentes, outras telas.
