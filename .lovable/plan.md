

# Reformulação de Insumos + nova role BackOffice

## Objetivo
Eliminar a tabela paralela `responsaveis` (e o botão "Novo Responsável"), centralizar movimentações na figura do técnico já existente, criar a role **BackOffice** com fluxo de aprovação de saídas/devoluções, introduzir flag **Retornável** e **KITs**, e amarrar tudo a OS aceitas + RME.

---

## 1. Nova role: BackOffice

- Adicionar valor `'backoffice'` ao enum `app_role`.
- Atribuição feita via **Usuários** (mesma UI que admin/engenharia já usam — sem mudança estrutural, só incluir o novo papel no `ALL_ROLES`).
- Edge function `create-staff-user` aceita também `'backoffice'` como role válida no convite.
- Helper de banco `is_backoffice(uuid)` (security definer) para uso em RLS e UI.

### Permissões de menu (sidebar)

| Item                      | admin | engenharia | supervisao | backoffice | tecnico_campo |
|---------------------------|:-----:|:----------:|:----------:|:----------:|:-------------:|
| Agenda (Principal)        |   ✓   |     ✓      |     ✓      |     ✓      |       —       |
| Cadastros (todo o grupo)  |   ✓   |     ✓      |     ✓      |     ✓      |       —       |
| Insumos (em Cadastros)    |   ✓   |     ✓      |     ✓      |     ✓      |       ✓       |
| Relatórios (Sistema)      |   ✓   |     ✓      |     ✓      |     ✓      |       —       |
| Demais itens admin-only   |   ✓   |     ✓      |     ✓      |     —      |       —       |

`AppSidebar`: introduzir flag `backofficeAllowed` por item; rota `/insumos` passa a aceitar técnicos também.

---

## 2. Limpeza da página Insumos

- Remover botão **"+ Novo Responsável"** e todo o diálogo associado.
- Remover `useSupplyActions.onSubmitResponsavel` / `responsavelForm` / `createResponsavel` do service.
- Botão **"+ Novo Insumo"** fica oculto para técnicos (apenas leitura + ações de saída/devolução para eles).
- Tabela `responsaveis`: mantida no banco apenas para histórico das movimentações antigas; **remover RLS de leitura para não-staff** e parar de carregá-la no front.

---

## 3. Modelo de dados (migrações)

### 3.1 `insumos`
- `retornavel boolean NOT NULL DEFAULT false` — flag controlada no formulário de cadastro/edição.

### 3.2 KITs (cadastro estático)
```text
kits (id, nome, descricao, ativo, created_at, updated_at)
kit_itens (id, kit_id, insumo_id, quantidade)
```
RLS: leitura para staff/backoffice/técnicos; escrita só para admin/backoffice.
Tela nova **Cadastros → Kits** (lista + dialog de cadastro) — mesma estrutura visual de Insumos.

### 3.3 Saídas vinculadas a OS — substitui o uso atual de `movimentacoes` para retiradas de campo
```text
insumo_saidas (
  id,
  insumo_id, kit_id (nullable, exclusivo com insumo_id),
  quantidade,
  retornavel boolean,                    -- snapshot da flag no momento da saída
  ordem_servico_id NOT NULL,             -- amarração obrigatória à OS
  tecnico_id NOT NULL,                   -- responsável pela saída (sempre técnico)
  registrado_por uuid NOT NULL,          -- profile.user_id de quem registrou
  status text NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK in ('pendente_aprovacao','aprovada','rejeitada','devolvida_total','devolvida_parcial'),
  quantidade_devolvida int DEFAULT 0,
  aprovado_por uuid, aprovado_at,
  rejeitado_motivo text,
  observacoes text,
  created_at, updated_at
)

insumo_devolucoes (
  id, saida_id, quantidade,
  status text DEFAULT 'pendente_aprovacao'  -- backoffice valida toda devolução
    CHECK in ('pendente_aprovacao','aprovada','rejeitada'),
  registrada_por, aprovado_por, aprovado_at,
  observacoes, created_at
)
```

### 3.4 Regra de estoque — **decrementa na saída** (escolhido)
Trigger `AFTER INSERT` em `insumo_saidas`: `insumos.quantidade -= quantidade` (expandindo KITs).
Trigger `AFTER UPDATE` em `insumo_devolucoes` quando `status → aprovada`: incrementa `insumos.quantidade` pela quantidade devolvida e atualiza `quantidade_devolvida`/`status` da saída.
Rejeição da saída pelo backoffice estorna o estoque.

### 3.5 RPCs auxiliares (security definer)
- `get_tecnico_os_ativas(p_tecnico_id)` → OS com `aceite_tecnico in ('aceito','aprovado')` e ticket em `ordem_servico_gerada`/`em_execucao` (para o dropdown).
- `get_rme_pendencias_insumos(p_rme_id)` → todas as saídas das OS-irmãs do ticket do RME que ainda não foram devolvidas/aprovadas.

### 3.6 Migração de dados
- Para cada `movimentacoes.responsavel_id` cujo `responsaveis.tipo='prestador'`, tentar match por nome com `prestadores → tecnicos` e remapear como histórico em uma view; movimentações sem match ficam só com nome em texto livre. Sem perda de histórico, sem migrar para a nova tabela (são entradas/saídas administrativas, não saídas de OS).

---

## 4. Fluxo de saída de insumo (UI)

Dialog **"Registrar Saída"** unificado (substitui o diálogo de Saída atual):

| Campo                  | Comportamento                                                                                  |
|------------------------|------------------------------------------------------------------------------------------------|
| Tipo                   | Toggle: **Item avulso** / **KIT**                                                              |
| Insumo / KIT           | Combobox conforme toggle                                                                       |
| Quantidade             | Numérico (KIT já calcula multiplicador)                                                        |
| **Técnico responsável**| Se quem registra é técnico → preenchido com seu nome, **disabled**. Caso contrário: combobox.  |
| **Ordem de Serviço**   | Dropdown **disabled até técnico ser escolhido**; depois lista só OS aceitas/em execução dele   |
| Observações            | Livre                                                                                          |

Saída entra com `status='pendente_aprovacao'` + estoque já decrementado. Aviso visual: "Aguardando validação do BackOffice".

### Botão "Devolver"
Disponível em qualquer saída ainda não bloqueada (RME do ticket não aprovado). Cria `insumo_devolucoes` `pendente_aprovacao`. Permitido para retornáveis e não-retornáveis (parafusos parciais).

---

## 5. Integração com RME

- Nova aba **"Insumos"** no detalhe do RME (e leitura no Wizard) que **herda** `insumo_saidas` de **todas** as OS irmãs do ticket cujo `aceite_tecnico in ('aceito','aprovado')`.
- Não permite editar diretamente as saídas; só visualizar, registrar devoluções e ver status (pendente/aprovada/devolvida).
- Trigger `AFTER UPDATE` em `rme_relatorios` quando `status → aprovado`:
  - Cria notificação in-app para todos com role `backoffice`: "RME XYZ aprovado — N saídas pendentes de validação".
  - Bloqueia novas devoluções nas saídas vinculadas (constraint na tabela: `can_register_devolucao(saida_id)` checa se RME do ticket está aprovado).
- Aprovação do RME = limite final para devoluções, conforme regra do usuário.

---

## 6. Painel BackOffice (nova rota `/backoffice/insumos`)

Acessível para `backoffice` + staff. Tabs:
1. **Saídas pendentes** — aprovar / rejeitar (com motivo).
2. **Devoluções pendentes** — para retornáveis: confirmar quantidade que voltou; para não-retornáveis: confirmar baixa parcial.
3. **RMEs aprovados com pendências** — lista RME aprovados com saídas não-validadas/devolvidas; ação direta para resolver cada item.

Notificações in-app + badge no menu lateral (mesmo padrão do "Aprovar RMEs").

---

## 7. RLS resumido

| Tabela              | Leitura                                                | Escrita                                                                    |
|---------------------|--------------------------------------------------------|----------------------------------------------------------------------------|
| `insumos`           | staff + backoffice + tecnico_campo                     | staff + backoffice (técnico **não** cria)                                  |
| `kits`/`kit_itens`  | mesmos da leitura de insumos                            | admin + backoffice                                                         |
| `insumo_saidas`     | staff + backoffice + técnico dono da OS                | INSERT: técnico/staff/backoffice; UPDATE de `status`: só staff+backoffice |
| `insumo_devolucoes` | mesmos da saída                                        | INSERT: técnico/staff/backoffice; UPDATE de `status`: só staff+backoffice |

---

## Arquivos impactados (resumo)

**Banco/edge:**
- Nova migração: enum + tabelas + triggers + RPCs + RLS + remapeamento de histórico.
- `supabase/functions/create-staff-user/index.ts` aceita `'backoffice'`.

**Frontend:**
- `src/hooks/useAuth.tsx`: adicionar `'backoffice'` ao tipo + prioridade (entre supervisao e tecnico_campo).
- `src/components/AppSidebar.tsx`: nova flag `backofficeAllowed`, Insumos liberado p/ técnico, novo item "Validar Insumos" para backoffice.
- `src/App.tsx`: ajustar `roles=` das rotas (Insumos abre p/ técnico; novas rotas `/backoffice/insumos` e `/cadastros/kits`).
- `src/pages/Usuarios.tsx`: incluir `'backoffice'` em `ALL_ROLES` + label/cor.
- `src/pages/Insumos.tsx`: remove "Novo Responsável", esconde "Novo Insumo" para técnicos, adiciona campo "Retornável" no form, novo dialog de saída com técnico+OS.
- `src/features/supplies/`: novo `kitService`, `saidaService`; remoção do fluxo de responsável; `useSupplyData` carrega via novas RPCs.
- Novo módulo `src/features/backoffice-insumos/` com hooks e página.
- `src/pages/RMEWizard.tsx` + `RMEDetailDialog`: nova aba "Insumos" lendo `insumo_saidas` agrupadas.
- Memory updates: registrar role backoffice + fluxo de insumos.

