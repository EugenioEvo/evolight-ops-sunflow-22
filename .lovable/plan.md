
## Visão geral

Adicionar módulo RDO (Relatório Diário de Obra) para a frente EPC da Evolight, reaproveitando ao máximo a infraestrutura de RME (wizard, evidências, assinaturas, PDF, aprovação). RDO **não** se vincula a ticket/OS — vive em uma nova entidade **Obras**.

## Crítica ao escopo proposto

**Pontos para reforçar / ajustar:**

1. **Falta entidade "Obra"** — sem ela, não há agrupamento de RDOs, histórico de avanço físico, nem dashboard de progresso. Vamos criar `obras`.
2. **Catálogo de atividades padronizadas** — para "Quantidade de Módulos Montados", "Estruturas Instaladas", etc. Sem catálogo, cada RDO vira texto livre e perde-se relatório consolidado. Proposta: tabela `rdo_atividades_catalogo` (item_key, label, unidade, categoria) — admin gerencia, sup.eletromecânico só preenche quantidade. Mais campos "Outros" em texto livre.
3. **Constraint 1 RDO por obra/dia** — evita duplicidade quando múltiplos sup. eletromecânicos atuam na mesma obra. UNIQUE (`obra_id`, `data_rdo`).
4. **Eletromecânico sem assinatura digital** — apenas marcado como presente. Sup.eletromecânico assina como responsável; aprovador (staff) assina ao aprovar.
5. **Permissões cliente** — assumindo que cliente **não** vê RDO no portal (escopo interno). Confirmar depois se quiser expor.
6. **Avanço físico acumulado** — derivar via VIEW somando quantidades por obra/atividade para dashboard. Não duplicar dado.

## Modelo de dados (migrations)

```text
app_role enum
└── adicionar: 'eletromecanico', 'sup_eletromecanico'

obras
├── id, nome, cliente_id (FK clientes), endereco, cidade, estado, cep
├── lat/lng, data_inicio_prevista, data_fim_prevista, data_inicio_real, data_fim_real
├── potencia_kwp, status ('planejada'|'em_execucao'|'pausada'|'concluida'|'cancelada')
├── responsavel_obra_id (FK prestadores — sup.eletromecânico líder)
└── created_by, timestamps

rdo_atividades_catalogo
├── item_key, label, unidade (un, m, m², kg…), categoria, sort_order, is_default
└── (gerenciado por admin)

rdo_relatorios
├── numero_rdo (RDO000001 — função sequencial), obra_id, data_rdo
├── turno, clima (sol/nublado/chuva/...), temperatura_c, condicoes_canteiro
├── horario_inicio, horario_fim
├── observacoes_gerais, ocorrencias, atrasos, restricoes
├── responsavel_id (FK prestadores — sup.eletromecânico que preencheu)
├── status ('rascunho'|'pendente'|'aprovado'|'rejeitado')
├── aprovado_por, data_aprovacao, observacoes_aprovacao
├── assinatura_responsavel, assinatura_aprovador
├── fotos_geral (text[] — paths storage)
├── pdf_url
└── timestamps
└── UNIQUE(obra_id, data_rdo) where status != 'cancelado'

rdo_equipe
├── rdo_id, prestador_id (eletromec. ou sup.eletromec.)
├── funcao, horas_trabalhadas, horas_extras, observacoes
└── UNIQUE(rdo_id, prestador_id)

rdo_atividades
├── rdo_id, catalogo_id (nullable), descricao_livre (nullable — para "outros")
├── quantidade, unidade, percentual_avanco, observacoes
└── CHECK (catalogo_id IS NOT NULL OR descricao_livre IS NOT NULL)

rdo_equipamentos (mobilizados no dia)
├── rdo_id, nome, quantidade, observacoes

rdo_evidencias
├── rdo_id, tipo ('antes'|'depois'|'ocorrencia'|'epi'), storage_path, descricao

Storage bucket: rdo-evidences (privado, signed URLs 1 ano — padrão RME)
```

**RLS resumida:**
- `obras`: staff CRUD; eletromecânico/sup.eletromecânico SELECT se está em `rdo_equipe` de algum RDO da obra OU é `responsavel_obra_id`.
- `rdo_relatorios`: staff CRUD; sup.eletromecânico INSERT/UPDATE próprios em rascunho/rejeitado; eletromecânico SELECT apenas onde está em `rdo_equipe`.
- `rdo_equipe/atividades/equipamentos/evidencias`: herdam visibilidade do RDO via EXISTS.
- Aprovação só para staff (mesma `is_staff()` que aprova RME).

**Função sequencial:** `gerar_numero_rdo()` espelhando `gerar_numero_os()`.

## Frontend — estrutura

```text
src/features/rdo/
├── types.ts (zod schemas por step)
├── services/rdoService.ts, obrasService.ts
├── hooks/useRDOData.ts, useRDOActions.ts, useObrasData.ts
└── components/
    ├── RDOCard.tsx
    └── rdo-wizard/
        ├── StepIdentification.tsx       (obra, data, turno, clima)
        ├── StepEquipe.tsx                (multi-select prestadores eletromec.)
        ├── StepAtividades.tsx            (catálogo + quantidade + "outros")
        ├── StepEquipamentos.tsx          (opcional)
        ├── StepEvidencias.tsx            (fotos antes/depois/ocorrência)
        └── StepSignatures.tsx            (assinatura sup.eletromec.)

src/pages/
├── Obras.tsx                  (CRUD + lista, staff)
├── ObraDetail.tsx             (timeline RDOs, dashboard avanço)
├── RDO.tsx                    (lista — sup.eletromec vê próprios; staff vê todos)
├── RDOWizard.tsx              (wizard auto-save padrão RME)
└── GerenciarRDO.tsx           (aprovação — staff)
```

**Sidebar (`AppSidebar.tsx`):**

```text
Cadastros: + Obras (allow: staff + sup_eletromecanico)
Principal:
  + RDO        (sup_eletromecanico, eletromecanico, staff)
  + Aprovar RDOs (staff) — com badge de pendentes (espelho do RME)
```

**Rotas (`App.tsx`):** `/obras`, `/obras/:id`, `/rdo`, `/rdo/novo`, `/rdo/:id` (wizard), `/gerenciar-rdo`.

**`useAuth`:** novas roles entram automaticamente em `profile.roles[]` e na prioridade (sugiro: `admin > engenharia > supervisao > backoffice > sup_eletromecanico > tecnico_campo > eletromecanico > cliente`).

**`ProtectedRoute`:** eletromec./sup.eletromec. exigem aprovação igual ao `tecnico_campo` (passam por `Candidatar` → `approve-prestador`).

## Reaproveitamento da base de pessoas

- **`prestadores`** ganha mais valores na `categoria` ou em `especialidades` para distinguir eletromec. (alternativa: `categoria` permanece e a role já distingue — mais simples e é o caminho recomendado).
- Edge function `approve-prestador` continua igual — só precisa criar a `app_role` correta baseada em campo escolhido na candidatura. Adicionar select de "Tipo de profissional" em `Candidatar.tsx` (Técnico O&M / Eletromecânico / Sup.Eletromecânico).
- `tecnicos` table continua sendo o link `prestador↔profile`.

## PDF e notificações

- `generateRDOPDF.ts` espelhando `generateRMEPDF.ts` (jspdf-autotable: cabeçalho obra, tabelas equipe/atividades/equipamentos, fotos em grid, assinaturas).
- Edge functions novas:
  - `send-rdo-submitted-email` — notifica staff aprovadores ao submeter
  - `send-rdo-decision-email` — notifica responsável ao aprovar/rejeitar
- Reutilizar `notificationService` para in-app.

## Aprovação

`GerenciarRDO.tsx` espelha `GerenciarRME.tsx`: lista filtrada por `status='pendente'`, modal de aprovação com observações + assinatura, transição `pendente → aprovado/rejeitado`. Rejeitado volta para `rascunho` editável pelo responsável.

## Entrega faseada

**Fase 1 — Schema & roles**
- Migration: enum, tabelas, RLS, sequencial, catálogo seed.

**Fase 2 — Cadastros**
- Página Obras (CRUD), atualização `Candidatar` com tipo de profissional, sidebar.

**Fase 3 — Wizard RDO + lista**
- Wizard 5-6 steps com auto-save (padrão RME), página `/rdo`, geração PDF.

**Fase 4 — Aprovação & notificações**
- `/gerenciar-rdo`, edge functions de email, badge pendentes.

**Fase 5 — Dashboard de obra (opcional, valida em separado)**
- View de avanço acumulado, gráficos por atividade.

## Memórias a registrar

- `mem://rdo/architecture-overview` — entidade Obras + RDO standalone, paralelo ao RME.
- `mem://rdo/wizard-structure` — steps e validações.
- `mem://auth/roles-eletromecanicas` — eletromec. vs sup.eletromec.
- `mem://rdo/single-rdo-per-obra-per-day` — UNIQUE constraint.

## Confirmações antes de implementar

1. **Catálogo de atividades inicial** — pode me passar 5-10 itens iniciais (ex: "Módulos montados [un]", "Estrutura metálica [m]", "Cabo CC lançado [m]") ou começo com lista genérica e você ajusta?
2. **Cliente vê RDO?** Assumi que **não** (interno). Confirma?
3. **`Obras.cliente_id`** obrigatório ou pode existir obra sem cliente cadastrado (obra própria)?
