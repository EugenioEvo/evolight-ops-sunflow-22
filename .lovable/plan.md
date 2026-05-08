## Análise dos 6 itens

Análise individual considerando custo, segurança e diretrizes do core (mobile-first, dark theme, RLS, sonner, design tokens, outer joins).

### Item 1 — Reorganização do menu lateral
- **Custo:** baixo (1 arquivo). **Risco:** zero.
- Renomear seção `Principal` → `RMEs` e criar nova seção `RDOs` agrupando `Dashboard RDO` (novo), `RDOs` (lista), `Aprovar RDOs` e `Obras` (mover de Cadastros).

### Item 2 — Métricas RDO (Dashboard dedicado em `/rdo/dashboard`)
- **Eficiência:** uma única query agregada com `select` + `count` por status + agregação client-side de horas (já temos React Query com staleTime 10min).
- **Segurança:** já protegido por RLS (`is_staff` + envolvidos).
- **Conteúdo:** cards (RDOs do mês, pendentes, aprovados, rejeitados) + gráficos `recharts` (já usado no projeto): horas por obra (bar) e horas por prestador (bar). Filtro por período (mês corrente / 30d / 90d).

### Item 3 — Página de detalhe da obra `/obras/:id`
- Header com cliente dono, endereço completo, status, datas (prevista/real), kWp.
- **Timeline de RDOs** (lista vertical por data, com badge de status) + link para o RDO.
- **% avanço acumulado** = média ponderada de `rdo_atividades.percentual_avanco` dos RDOs aprovados (gráfico linear).
- **Equipe alocada** = união distinta de `prestador_id` em `rdo_equipe` da obra, com horas totais.
- **Galeria de fotos consolidadas** (lazy-load das `rdo_evidencias` + `fotos_geral` via signed URLs 1y, padrão do projeto).
- Página `/obras` continua para CRUD; clicar na linha → detalhe.

### Item 4 — Exposição da obra no portal do cliente (preparação)
- **Estratégia:** entregar agora **somente a estrutura** (rota `/portal/obra/:id` reaproveitando o componente, com guard `cliente` + verificação de propriedade via `obras.cliente_id → clientes.profile_id → user_id`) e um flag `<ObraDetail mode="staff" | "cliente" />` que oculta seções sensíveis (custos futuros, observações internas, equipe). RLS de `obras` precisa de policy adicional para `cliente` ver apenas a própria obra. **Filtro fino de campos** fica para depois (conforme você indicou).
- **Custo:** baixo, evita retrabalho. **Segurança:** RLS + checagem dupla na query.

### Item 5 — Multi-role operacional
- **Boa notícia:** já temos infra de [Multi-role pontual](mem://auth/multi-role-pontual) (`user_roles` + `profile.roles[]`). Basta:
  1. Garantir que a UI de cadastro de Usuários permita múltiplas roles para os 4 papéis operacionais (técnico O&M, eletromecânico, sup. O&M, sup. eletromecânico).
  2. Revisar `useAuth` para que a "role principal" não esconda permissões secundárias (já é o caso, mas vou validar).
  3. Sidebar e RLS já usam `.some()` / `has_role()`, então herdam automaticamente.
- **Custo:** muito baixo se a infra já está pronta (validar + ajuste pontual em UsuariosPage).

### Item 6 — Catálogo de atividades em `/obra-catalogo`
- CRUD simples sobre `rdo_atividades_catalogo` (label, item_key, unidade, categoria, sort_order, ativo). RLS já é admin-only.
- **Falta:** coluna `type` mencionada não existe ainda → adicionar `tipo text` (ex: `instalacao | comissionamento | civil | eletrica | logistica`) via migration, mais filtro/agrupamento na UI.
- Página acessível só para `admin`.

### Aproveitamento de TODOs do core (token-baratos, encaixe natural)
- ✅ **[TODO: Unify RME/OS pages](mem://tech-debt/unificacao-rme-os-pages)** — **NÃO incluir agora.** Mexer em RME/OS no mesmo PR de RDO aumenta superfície de regressão. Mantenho adiado.
- ✅ **[TODO: Unify prestadores × tecnicos](mem://tech-debt/unificacao-prestadores-tecnicos)** — **NÃO incluir.** Mudança estrutural pesada; o item 5 já se beneficia da arquitetura atual sem precisar unificar tabelas.
- ➕ **Encaixe natural:** ao tocar `UsuariosPage` (item 5), atualizar a UI para também mostrar/editar `tecnicos.especialidades` e `prestadores.categoria` em uma única tela — sem migration, custo marginal.

---

## Plano de execução (fases independentes, deployáveis isoladamente)

```text
F1  Sidebar reorg + nova seção RDOs (1 arquivo)
F2  Dashboard RDO em /rdo/dashboard (1 página + 1 hook agregador)
F3  Detalhe da Obra em /obras/:id (modo staff)
F4  Catálogo de atividades em /obra-catalogo (+ migration: coluna `tipo`)
F5  Multi-role operacional (validação + ajuste UsuariosPage)
F6  Portal: rota /portal/obra/:id reusando ObraDetail (mode=cliente) + RLS
```

### Detalhamento técnico

**F1 — Sidebar**
- Novos grupos: `RMEs` (atual Principal renomeado, Dashboard ↔ Dashboard RME continua), `RDOs` (Dashboard, RDOs, Aprovar RDOs, Obras), `Operação` (Tickets, OS, Rotas, Agenda, Carga, Confirmações, Validar Insumos), `Cadastros`, `Sistema`. Usar `SidebarGroupLabel` + `Collapsible` (padrão shadcn).

**F2 — Dashboard RDO** (`src/pages/DashboardRDO.tsx` + `useRDOMetrics.ts`)
- Query única: `rdo_relatorios` joinado a `rdo_equipe (prestador_id, horas_trabalhadas, horas_extras)` e `obras (nome)`.
- React Query, staleTime 10min, agregação no client (volume baixo).
- Cards: total mês, pendentes, aprovados, rejeitados.
- Charts (`recharts` BarChart): Horas por obra (top 10), Horas por prestador (top 10). Filtro de período.

**F3 — `ObraDetail`** (`src/pages/ObraDetail.tsx`)
- Hooks: `useObra(id)`, `useRDOsByObra(id)`, `useObraStats(id)`.
- Seções: Header / Timeline / Avanço (LineChart) / Equipe (table com horas) / Fotos (grid lazy com signed URLs 1y).
- Reutilizar `signedUrl` helper já existente.

**F4 — Catálogo `/obra-catalogo`**
- Migration: `ALTER TABLE rdo_atividades_catalogo ADD COLUMN tipo text;` (nullable).
- Página com tabela editável (Dialog para create/edit), filtros por categoria/tipo/ativo. RLS já cobre admin.
- Atualizar wizard RDO (etapa Atividades) para opcionalmente filtrar por tipo.

**F5 — Multi-role**
- Validar `useAuth` retorna `roles[]` corretamente. Ajustar `UsuariosPage` para `MultiSelect` de roles operacionais (já temos shadcn select). Sem migration.

**F6 — Portal cliente (estrutura)**
- Migration RLS: policy `Cliente vê própria obra` em `obras` (`EXISTS clientes JOIN profiles WHERE user_id=auth.uid()`), e leituras correspondentes em `rdo_relatorios`/`rdo_evidencias`/`rdo_equipe` quando obra pertence ao cliente.
- Rota nova `/portal/obras` (lista das obras do cliente) e `/portal/obras/:id` (mesmo componente `ObraDetail` com prop `mode="cliente"` que já oculta blocos sensíveis — filtro fino fica para depois, conforme combinado).
- Sidebar: adicionar item "Minhas Obras" no `Meu Painel` para `cliente`.

### Garantias de qualidade
- Toasts via `sonner`. Tokens semânticos do design system. Outer joins em joins de prestador/obra/cliente. Mobile-first (44px). RLS revisada por fase. PRs sequenciais, cada fase verificável isoladamente.

### Ordem proposta
F1 → F4 (migration leve) → F2 → F3 → F5 → F6. Confirme e seguimos por F1.