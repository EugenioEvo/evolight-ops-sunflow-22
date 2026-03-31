

# Fase 4 — Refatoracao modular: todas as paginas restantes acima de 300 linhas

## Inventario

| Pagina | Linhas | Feature module |
|--------|--------|----------------|
| RME.tsx | 1460 | `src/features/rme/` |
| Insumos.tsx | 1080 | `src/features/supplies/` |
| Prestadores.tsx | 831 | `src/features/providers/` |
| DashboardPresenca.tsx | 691 | `src/features/presence/` |
| WorkOrderDetail.tsx | 650 | `src/features/work-orders/` (extend) |
| RMEWizard.tsx | 582 | `src/features/rme/` (shared) |
| WorkOrderCreate.tsx | 570 | `src/features/work-orders/` (extend) |
| Relatorios.tsx | 554 | `src/features/reports/` |
| ClientDashboard.tsx | 515 | `src/features/client-dashboard/` |
| CargaTrabalho.tsx | 482 | `src/features/workload/` |
| GerenciarRME.tsx | 377 | `src/features/rme/` (shared) |
| Tecnicos.tsx | 347 | `src/features/technicians/` |

## Estrutura de arquivos

```text
src/features/
├── rme/
│   ├── types.ts                    # rmeSchema, RMEForm, RME interfaces
│   ├── services/rmeService.ts      # CRUD RME, upload fotos, assinaturas, email
│   ├── hooks/useRMEData.ts         # state, fetch, search, realtime
│   ├── hooks/useRMEActions.ts      # submit, upload, signatures, PDF
│   ├── hooks/useRMEWizardData.ts   # wizard state, auto-save, step navigation
│   ├── components/RMECard.tsx      # card de RME na listagem
│   ├── components/RMEForm.tsx      # formulario legado (RME.tsx)
│   ├── components/RMEListFilters.tsx
│   └── index.ts
├── supplies/
│   ├── types.ts                    # insumoSchema, movimentacaoSchema, responsavelSchema
│   ├── services/supplyService.ts   # CRUD insumos, movimentacoes, responsaveis
│   ├── hooks/useSupplyData.ts      # state, fetch, search, tabs
│   ├── hooks/useSupplyActions.ts   # movimentacao, CRUD mutations
│   ├── components/SupplyForm.tsx
│   ├── components/SupplyCard.tsx
│   ├── components/MovementDialog.tsx
│   ├── components/ResponsibleDialog.tsx
│   └── index.ts
├── providers/
│   ├── types.ts                    # prestadorSchema, especialidades, certificacoes
│   ├── services/providerService.ts # CRUD prestadores
│   ├── hooks/useProviderData.ts
│   ├── hooks/useProviderMutations.ts
│   ├── components/ProviderForm.tsx
│   ├── components/ProviderCard.tsx
│   └── index.ts
├── presence/
│   ├── types.ts                    # OrdemServicoPresenca
│   ├── services/presenceService.ts # fetch OS com presenca, export PDF/Excel
│   ├── hooks/usePresenceData.ts    # state, filtros, fetch
│   ├── components/PresenceFilters.tsx
│   ├── components/PresenceTable.tsx
│   └── index.ts
├── reports/
│   ├── types.ts
│   ├── services/reportService.ts   # queries agregadas por periodo
│   ├── hooks/useReportData.ts      # state, filtros, fetch
│   ├── components/ReportCharts.tsx  # graficos recharts
│   ├── components/ReportFilters.tsx
│   └── index.ts
├── client-dashboard/
│   ├── services/clientDashService.ts
│   ├── hooks/useClientDashData.ts
│   ├── components/ClientTicketList.tsx
│   ├── components/ClientStatsCards.tsx
│   └── index.ts
├── workload/
│   ├── types.ts                    # WorkloadData, TecnicoStats
│   ├── services/workloadService.ts # fetch carga por tecnico/periodo
│   ├── hooks/useWorkloadData.ts
│   ├── components/WorkloadChart.tsx
│   ├── components/WorkloadFilters.tsx
│   └── index.ts
├── technicians/
│   ├── types.ts                    # Tecnico interface
│   ├── services/technicianService.ts
│   ├── hooks/useTechnicianData.ts
│   ├── hooks/useTechnicianMutations.ts
│   ├── components/TechnicianCard.tsx
│   ├── components/TechnicianEditDialog.tsx
│   └── index.ts
├── work-orders/  (estender modulo existente)
│   ├── hooks/useWorkOrderDetail.ts   # novo: state + fetch do detalhe
│   ├── hooks/useWorkOrderCreate.ts   # novo: form + submit
│   ├── components/WorkOrderDetailView.tsx
│   ├── components/WorkOrderCreateForm.tsx
│   └── (manter arquivos existentes)
```

## Decomposicao por pagina

### 1. RME.tsx (1460 → ~100 linhas)
- **types.ts**: `rmeSchema`, `RMEForm`, interfaces de RME com fotos/assinaturas
- **rmeService.ts**: `fetchRMEs`, `createRME`, `updateRME`, `uploadPhoto`, `submitSignature`, `sendEmail`
- **useRMEData.ts**: state de lista, search, selectedOS, realtime
- **useRMEActions.ts**: submit form, upload fotos, capturar assinatura, gerar PDF
- **RMEForm.tsx**: formulario completo com campos eletricos, assinaturas, fotos
- **RMECard.tsx**: card na listagem
- **RME.tsx**: composicao: lista ou formulario baseado em selectedOS

### 2. Insumos.tsx (1080 → ~80 linhas)
- **types.ts**: 3 schemas (insumo, movimentacao, responsavel)
- **supplyService.ts**: CRUD insumos + movimentacoes + responsaveis
- **useSupplyData.ts**: state, fetch, search, tabs (estoque/movimentacoes/responsaveis)
- **useSupplyActions.ts**: mutations, movimentacao entrada/saida
- **SupplyForm.tsx**, **MovementDialog.tsx**, **ResponsibleDialog.tsx**: dialogs separados
- **SupplyCard.tsx**: card com badge de estoque

### 3. Prestadores.tsx (831 → ~80 linhas)
- **types.ts**: `prestadorSchema`, arrays de especialidades/certificacoes/experiencia
- **providerService.ts**: CRUD com filtro por categoria/ativo
- **useProviderData.ts**: state, fetch, search, tabs
- **useProviderMutations.ts**: submit, edit, delete, toggle ativo
- **ProviderForm.tsx**: dialog com multi-select especialidades
- **ProviderCard.tsx**: card com badges

### 4. DashboardPresenca.tsx (691 → ~60 linhas)
- **presenceService.ts**: fetch OS com join presenca, export PDF/Excel
- **usePresenceData.ts**: filtros por data/tecnico, fetch
- **PresenceFilters.tsx**: select tecnico + mes
- **PresenceTable.tsx**: tabela com status confirmacao

### 5. WorkOrderDetail.tsx (650 → ~60 linhas)
- **useWorkOrderDetail.ts**: fetch OS por id, state, acoes (PDF, status)
- **WorkOrderDetailView.tsx**: renderizacao do detalhe completo

### 6. RMEWizard.tsx (582 → ~80 linhas)
- **useRMEWizardData.ts**: step navigation, auto-save, load/save formData, submit final
- Componentes de step ja existem em `rme-wizard/` — manter
- **RMEWizard.tsx**: composicao: progress bar + step router + footer buttons

### 7. WorkOrderCreate.tsx (570 → ~60 linhas)
- **useWorkOrderCreate.ts**: form state, fetch clientes/tecnicos, submit
- **WorkOrderCreateForm.tsx**: formulario com date picker, multi-select

### 8. Relatorios.tsx (554 → ~60 linhas)
- **reportService.ts**: queries agregadas (tickets por status, por periodo, por tecnico)
- **useReportData.ts**: filtros, fetch, dados derivados para graficos
- **ReportCharts.tsx**: graficos recharts (bar, pie, line)
- **ReportFilters.tsx**: periodo + tipo

### 9. ClientDashboard.tsx (515 → ~60 linhas)
- **clientDashService.ts**: fetch tickets/OS do cliente logado
- **useClientDashData.ts**: state, fetch
- **ClientTicketList.tsx**: lista de tickets do cliente
- **ClientStatsCards.tsx**: cards de resumo

### 10. CargaTrabalho.tsx (482 → ~60 linhas)
- **workloadService.ts**: fetch carga por tecnico, export PDF
- **useWorkloadData.ts**: filtros por mes/tecnico
- **WorkloadChart.tsx**: grafico de carga
- **WorkloadFilters.tsx**: select tecnico + periodo

### 11. GerenciarRME.tsx (377 → ~60 linhas)
- Usa hooks existentes (`useRMEQuery`), pouca logica para extrair
- Extrair **RMEManagementList.tsx** (renderizacao de cards) e **RMEManagementFilters.tsx**
- Manter no modulo `src/features/rme/`

### 12. Tecnicos.tsx (347 → ~60 linhas)
- **technicianService.ts**: fetch, update, toggle ativo
- **useTechnicianData.ts**: state, fetch
- **TechnicianCard.tsx**: card com badges
- **TechnicianEditDialog.tsx**: dialog de edicao

## Regras (padrao para todas as implementacoes futuras)

1. **Services**: funcoes puras, recebem parametros, retornam dados. Sem useState/useEffect
2. **Hooks**: encapsulam state + effects + callbacks. Retornam objeto tipado
3. **Components**: recebem props tipadas. Sem queries diretas ao banco
4. **Types**: schemas zod + interfaces TypeScript. Compartilhados via `types.ts`
5. **Index**: barrel exports. Pages importam apenas do index
6. **Pages**: composicao pura, max ~80-150 linhas. Export default mantido para rotas
7. **Threshold**: qualquer pagina acima de 200 linhas deve ser decomposta neste padrao

## Ordem de execucao

Prioridade por tamanho: RME → Insumos → Prestadores → DashboardPresenca → WorkOrderDetail → RMEWizard → WorkOrderCreate → Relatorios → ClientDashboard → CargaTrabalho → GerenciarRME → Tecnicos

Cada pagina e independente — o app continua funcionando apos cada refatoracao.

