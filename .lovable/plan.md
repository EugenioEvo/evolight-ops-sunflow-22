

# Refatoracao modular do projeto para eficiencia de desenvolvimento por IA

## Diagnostico

O projeto tem varios arquivos-pagina que ultrapassam 500+ linhas, misturando logica de negocio, estado, queries, e renderizacao no mesmo componente. Isso causa problemas para a IA:

- **Contexto grande**: Tickets.tsx tem 1760 linhas, WorkOrders.tsx 788, MinhasOS.tsx 759, Equipamentos.tsx 678, Clientes.tsx 651, Agenda.tsx 586
- **Acoplamento**: Logica de fetch, mutacao, e UI vivem juntas — alterar uma parte exige ler o arquivo inteiro
- **Duplicacao**: Patterns de fetch/filter/paginate se repetem em cada pagina
- **Sem camada de servico**: Queries Supabase estao espalhadas diretamente nos componentes

## Estrategia: Feature-based modules

Reorganizar por dominio, cada um com separacao clara de responsabilidades.

```text
src/
├── features/
│   ├── tickets/
│   │   ├── components/       # TicketCard, TicketForm, TicketList
│   │   ├── hooks/            # useTickets, useTicketMutations
│   │   ├── services/         # ticketService.ts (queries supabase)
│   │   ├── types.ts
│   │   └── index.ts
│   ├── work-orders/
│   │   ├── components/       # WorkOrderCard, WorkOrderFilters
│   │   ├── hooks/            # useWorkOrders, useWorkOrderActions
│   │   ├── services/
│   │   ├── types.ts
│   │   └── index.ts
│   ├── technicians/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   ├── clients/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   ├── equipment/
│   │   └── ...
│   ├── rme/
│   │   └── ...  (ja parcialmente feito em rme-wizard/)
│   ├── schedule/
│   │   └── ...
│   ├── routes/
│   │   └── ...  (ja feito em components/routes/)
│   └── auth/
│       └── ...
├── shared/
│   ├── components/   # EmptyState, LoadingState, Pagination, FileUpload
│   ├── hooks/        # useDebounce, useVirtualization, useErrorHandler
│   ├── services/     # supabaseHelpers.ts
│   └── types/        # common types
├── pages/            # Ficam finos — apenas composicao de feature components
└── components/ui/    # Mantido como esta (shadcn)
```

## Prioridade de refatoracao (por tamanho e impacto)

### Fase 1 — Tickets (1760 linhas — maior ganho)
1. **`features/tickets/types.ts`** — Interfaces Ticket, TicketForm schema
2. **`features/tickets/services/ticketService.ts`** — Todas as queries (fetchTickets, createTicket, updateTicket, deleteTicket, assignTechnician)
3. **`features/tickets/hooks/useTickets.ts`** — State management com React Query
4. **`features/tickets/hooks/useTicketMutations.ts`** — Mutacoes (criar, editar, deletar, atribuir tecnico)
5. **`features/tickets/components/TicketForm.tsx`** — Formulario de criacao/edicao
6. **`features/tickets/components/TicketCard.tsx`** — Card individual
7. **`features/tickets/components/TicketList.tsx`** — Lista com filtros e paginacao
8. **`pages/Tickets.tsx`** — Reduzido para ~50 linhas: composicao dos componentes acima

### Fase 2 — Work Orders (788 linhas)
Mesmo pattern: services + hooks + components separados

### Fase 3 — MinhasOS, Clientes, Equipamentos, Agenda
Cada pagina segue o mesmo template de refatoracao

### Fase 4 — Shared components
Mover EmptyState, LoadingState, Pagination, FileUpload, ErrorBoundary para `shared/components/`

## Camada de servicos — Pattern

```typescript
// features/tickets/services/ticketService.ts
export const ticketService = {
  async list(filters: TicketFilters) {
    let query = supabase.from('tickets').select('*, clientes(empresa)');
    if (filters.status) query = query.eq('status', filters.status);
    // ...
    return query;
  },
  async create(data: CreateTicketDTO) { /* ... */ },
  async assignTechnician(ticketId: string, tecnicoId: string) { /* ... */ },
};
```

## Beneficios para a IA

| Problema atual | Solucao |
|---|---|
| Editar 1 campo exige ler 1760 linhas | Arquivo de 80-150 linhas, focado |
| Risco de efeito colateral em edits | Separacao clara de responsabilidades |
| Duplicacao de patterns de fetch | Camada de servicos reutilizavel |
| Dificil adicionar features | Modulo novo = copiar template de feature |

## Abordagem de implementacao

Refatorar uma feature por vez, comecando por Tickets (maior e mais complexa). Cada fase e independente — o app continua funcionando apos cada fase. As pages continuam exportando o mesmo componente default, entao o roteamento nao muda.

