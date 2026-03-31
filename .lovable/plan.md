

# Auditoria Retrospectiva — Premissas de Arquitetura

## 1. Status de Conformidade

| Premissa | Status | Nota |
|----------|--------|------|
| **Modularizacao (SRP)** | 85% | Features decompostas em services/hooks/components. Porem 5 hooks importam `supabase` direto, violando a camada de servico |
| **Tipagem Estrita** | 40% | 287 ocorrencias de `: any` em 25 arquivos de features. Schemas Zod existem para tickets/rme/supplies mas retornos de services nao sao tipados |
| **Fail-Fast / Defensiva** | 30% | Services fazem `if (error) throw error` mas nao validam parametros de entrada. Hooks nao validam dados antes de enviar ao service |
| **Injecao de Dependencia** | 10% | Services importam `supabase` direto (hardcoded). Hooks importam services direto. Nenhum usa DI — tudo acoplado |
| **Error Handling padronizado** | 15% | `useErrorHandler` existe mas ZERO features o utilizam. Cada hook tem try/catch proprio com toast inline |
| **Design Patterns** | 25% | Service Object pattern parcial. Sem Repository, Strategy, ou Factory. Logica de notificacao duplicada em tickets e work-orders |
| **Async/Concorrencia** | 60% | `Promise.all` usado em alguns fetches paralelos. Porem mutations sao sequenciais (ex: `assignTechnician` faz 8+ awaits em serie) |
| **Memoization/Caching** | 40% | `useMemo` para filtros/derivados. Sem cache de queries — cada navegacao refaz fetch do zero |
| **Lazy Evaluation** | 20% | Paginacao existe. Sem virtualização consistente (VirtualizedList existe mas pouco usado) |

## 2. Divida Tecnica por Modulo

### Critico — Tipagem `any` generalizada

**Onde**: Todos os 25 arquivos de features
- `ticketService.create(ticketData: any)` — nenhum service tem tipos de entrada/saida
- `useTicketData` retorna `tickets: any[]`, `clientes: any[]`
- `useProviderMutations.handleEdit(prestador: any)`
- `rmeService.createRME(rmeData: any)`, `exportRMEPDF(rme: any)`
- `as any` em 15+ inserts/updates para contornar tipos do Supabase

### Critico — Hooks com acesso direto ao Supabase

**Onde**: 5 hooks violam a separacao services/hooks
- `useClientDashData.ts` — queries inline ao supabase
- `useWorkloadData.ts` — queries inline ao supabase
- `usePresenceData.ts` — realtime channel inline
- `useWorkOrderCreate.ts` — queries inline ao supabase
- `useWorkOrderDetail.ts` — queries inline ao supabase

### Alto — useErrorHandler nao adotado

**Onde**: 13 arquivos de hooks com 80 catch blocks
- Cada hook tem seu proprio pattern de error handling
- Mistura `toast()` (shadcn) com `toast.error()` (sonner) — 2 sistemas de toast
- `console.error` exposto em producao em varios hooks

### Alto — Duplicacao de logica de notificacao

**Onde**: `ticketService.sendNotification`, `workOrderService.sendNotification`
- Mesma funcao duplicada em 2 services
- Logica de calendar invite duplicada em tickets e work-orders
- Padrao de "buscar userId do tecnico → enviar notificacao" repetido 6+ vezes

### Medio — Services sem validacao de entrada

**Onde**: Todos os services
- `ticketService.approve(ticketId, profileId)` nao valida se sao UUIDs validos
- `supplyService.createMovimentacao(data)` nao valida quantidade > 0
- Nenhum service valida se o usuario tem permissao (toda seguranca depende de RLS)

### Medio — Mutations sequenciais desnecessarias

**Onde**: `useTicketMutations.assignTechnician` (linhas 165-245)
- 8 awaits sequenciais que poderiam ser parcialmente paralelizados
- `updateTicket` faz loop sequencial em OS vinculadas

## 3. Plano de Sincronizacao

### Etapa 1 — Infraestrutura base (pre-requisito para tudo)

1. **Criar `src/shared/services/notificationService.ts`** — unificar `sendNotification` e `sendCalendarInvite` duplicados
2. **Criar `src/shared/services/baseService.ts`** — factory para queries Supabase com validacao de parametros (UUID, strings nao-vazias)
3. **Adotar `useErrorHandler` em todos os hooks** — substituir 80 catch blocks por `handleAsyncError`
4. **Unificar sistema de toast** — escolher sonner OU shadcn toast (nao ambos)

### Etapa 2 — Tipagem estrita nos services

1. **Definir interfaces de retorno** em cada `types.ts` de feature (ex: `TicketWithRelations`, `WorkOrderWithDetails`)
2. **Substituir `any` por tipos concretos** nos parametros e retornos de todos os services
3. **Remover `as any`** nos inserts — criar tipos de input que mapeiam para as tabelas do Supabase
4. **Tipar retornos dos hooks** — `useTicketData` retorna `tickets: Ticket[]` em vez de `any[]`

### Etapa 3 — Injecao de Dependencia e desacoplamento

1. **Mover queries inline** dos 5 hooks para seus respectivos services
2. **Services recebem client como parametro opcional** — `createTicketService(client = supabase)` para testabilidade
3. **Hooks recebem services via parametro** — `useTicketData(service = ticketService)` para mocking

### Etapa 4 — Design Patterns e Performance

1. **Strategy Pattern** para notificacoes (email, in-app, calendar) — substituir ifs por estrategias
2. **Paralelizar mutations** onde seguro (notificacoes independentes em `assignTechnician`)
3. **Cache layer** — React Query ou cache manual para dados que mudam pouco (clientes, tecnicos)

### Prioridade de execucao

```text
Etapa 1 (base)     ████████████  Bloqueante — tudo depende disso
Etapa 2 (tipos)    ████████████  Maior volume de mudancas
Etapa 3 (DI)       ██████        Melhora testabilidade
Etapa 4 (patterns) ████          Otimizacao final
```

Aguardo autorizacao para iniciar pela Etapa 1 (infraestrutura base).

