

# Fase 3 — Refatoracao modular: MinhasOS, Equipamentos, Clientes, Agenda

## Resumo

Aplicar o mesmo pattern de `src/features/` usado em tickets e work-orders para as 4 paginas restantes, reduzindo cada uma de 580-759 linhas para ~80-150 linhas.

## Estrutura de arquivos a criar

```text
src/features/
├── my-orders/
│   ├── services/myOrdersService.ts    # queries supabase (load OS, iniciar execucao)
│   ├── hooks/useMyOrdersData.ts       # state, filtros, realtime, loadOrdensServico
│   ├── hooks/useMyOrdersActions.ts    # aceitar, recusar, iniciar, ver PDF, ligar, mapa
│   ├── components/OSCard.tsx          # renderOSCard extraido (~250 linhas)
│   ├── components/OSFilters.tsx       # filtro de prioridade
│   ├── components/OSTabList.tsx       # tabs pendentes/execucao/concluidas
│   ├── types.ts
│   └── index.ts
├── clients/
│   ├── services/clientService.ts      # fetchClientes, createCliente, updateCliente, deleteCliente
│   ├── hooks/useClientData.ts         # state + fetch + search
│   ├── hooks/useClientMutations.ts    # submit, edit, delete, import
│   ├── components/ClientForm.tsx      # formulario com schema zod
│   ├── components/ClientCard.tsx      # card individual
│   ├── types.ts
│   └── index.ts
├── equipment/
│   ├── services/equipmentService.ts   # CRUD equipamentos
│   ├── hooks/useEquipmentData.ts      # state + fetch + search + tabs
│   ├── hooks/useEquipmentMutations.ts # submit, edit, delete
│   ├── components/EquipmentForm.tsx   # formulario
│   ├── components/EquipmentCard.tsx   # card com icones por tipo
│   ├── types.ts
│   └── index.ts
├── schedule/
│   ├── services/scheduleService.ts    # loadOrdensServico, loadTecnicos, resendInvite, generateQR
│   ├── hooks/useScheduleData.ts       # state, filtros, realtime
│   ├── hooks/useScheduleActions.ts    # resend, generateQR, cancel
│   ├── components/AgendaCalendar.tsx  # calendario + filtro tecnico
│   ├── components/AgendaOSCard.tsx    # card da OS na agenda
│   ├── types.ts
│   └── index.ts
```

## Decomposicao por pagina

### 1. MinhasOS.tsx (759 → ~80 linhas)
- **types.ts**: Interface `OrdemServico` (linhas 25-60)
- **myOrdersService.ts**: `loadOrdensServico(profileId, isTecnico)`, query com join
- **useMyOrdersData.ts**: useState para loading, filtros, activeTab + loadOrdensServico + realtime + filtros derivados (pendentes/execucao/concluidas)
- **useMyOrdersActions.ts**: `handleIniciarExecucao`, `handleVerOS` (gerar PDF), `handleLigarCliente`, `handleAbrirMapa`, `handleAceitarOS`, `handleRecusarOS`
- **OSCard.tsx**: Extrair `renderOSCard` inteiro (linhas 316-564) como componente com props
- **OSFilters.tsx**: Filtro de prioridade (linhas 618-658)
- **OSTabList.tsx**: Tabs com contadores (linhas 667-743)
- **MinhasOS.tsx**: Composicao: breadcrumb + filtros + tabs + dialog recusa

### 2. Clientes.tsx (651 → ~60 linhas)
- **types.ts**: Schema zod `clienteSchema`, interface `Cliente`, `ESTADOS_BR`
- **clientService.ts**: `fetchAll`, `create`, `update`, `delete`
- **useClientData.ts**: State de clientes + loading + search + fetch
- **useClientMutations.ts**: `onSubmit`, `handleEdit`, `handleDelete` + form react-hook-form
- **ClientForm.tsx**: Dialog com formulario completo (linhas ~250-500)
- **ClientCard.tsx**: Card de cliente (linhas ~500-651)
- **Clientes.tsx**: Layout + search + botoes + lista + dialogs

### 3. Equipamentos.tsx (678 → ~60 linhas)
- **types.ts**: Schema `equipamentoSchema`, interface `Equipamento`
- **equipmentService.ts**: `fetchAll`, `fetchClientes`, `create`, `update`, `delete`
- **useEquipmentData.ts**: State + fetch + search + tab filtering
- **useEquipmentMutations.ts**: `onSubmit`, `handleEdit`, `handleDelete`
- **EquipmentForm.tsx**: Dialog com formulario
- **EquipmentCard.tsx**: Card com icone por tipo
- **Equipamentos.tsx**: Layout + composicao

### 4. Agenda.tsx (586 → ~80 linhas)
- **types.ts**: Interfaces `OrdemServico` (agenda), `Tecnico`
- **scheduleService.ts**: `loadOrdensServico(date, tecnicoId)`, `loadTecnicos`, `resendCalendarInvite`, `generatePresenceQR`
- **useScheduleData.ts**: State + fetch + realtime (useGlobalRealtime + useAgendaRealtime)
- **useScheduleActions.ts**: `resendCalendarInvite`, `generatePresenceQR`, `cancelOS`
- **AgendaCalendar.tsx**: Calendario + filtro de tecnico (linhas 260-330)
- **AgendaOSCard.tsx**: Card da OS com email status, badges, botoes (linhas 330-540)
- **Agenda.tsx**: Grid layout + calendario + lista + modais

## Regras de implementacao

1. Manter exports default nas pages para nao quebrar rotas
2. Services recebem parametros puros e retornam dados — sem useState
3. Hooks encapsulam state + effects + callbacks
4. Components recebem props tipadas — sem queries diretas
5. Cada feature tem `index.ts` com re-exports

## Ordem de execucao

MinhasOS primeiro (maior e mais critica), depois Clientes, Equipamentos, e Agenda.

