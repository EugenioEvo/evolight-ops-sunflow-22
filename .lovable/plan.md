

# Auditoria Completa v2 — SunFlow

## Status das Correções Anteriores

As correções da Fase 1 e 2 foram aplicadas com sucesso:
- TK000002 agora está com status `ordem_servico_gerada` (confirmado no banco)
- Todos os técnicos têm prestadores vinculados (confirmado: todos com `prestador_count: 1`)
- Rota `/configuracoes` removida do sidebar
- `require()` no ProtectedRoute corrigido para import estático
- PerformanceMetrics com loading/error states
- Paginação implementada em Tickets e WorkOrders
- Realtime consolidado em provider global

---

## NOVOS BUGS ENCONTRADOS

### 1. CRÍTICO: `useGlobalRealtime` causa re-subscribe infinito em Tickets e Index
Em `Tickets.tsx` (linha 196): `useGlobalRealtime(loadData)` passa `loadData` que NÃO é memoizada com `useCallback`. A cada render, uma nova referência de função é criada, fazendo o `useEffect` dentro de `useGlobalRealtime` disparar continuamente (unsubscribe → subscribe → unsubscribe...).

Mesmo problema em `Index.tsx` (linha 161): `useGlobalRealtime(loadRecentActivity)`.

**Impacto**: Pode causar múltiplas chamadas simultâneas ao banco, race conditions, e degradação de performance. Pode explicar por que o usuário viu "Nenhum ticket encontrado" — uma race condition onde `setTickets([])` ocorre durante `setLoading(true)`.

**Correção**: Envolver `loadData` e `loadRecentActivity` com `useCallback`, ou usar `useRef` dentro de `useGlobalRealtime` para evitar re-subscriptions.

### 2. MÉDIO: Tabs de Tickets persistidas no localStorage podem mostrar lista vazia
O `activeTab` é persistido via `localStorage.setItem('tickets_tab', activeTab)`. Se o usuário estava na aba "Abertos" e agora todos os tickets são `ordem_servico_gerada`, ao reabrir verá "Nenhum ticket encontrado" sem contexto claro.

O session replay mostra exatamente isso: o usuário vê a página vazia e troca de aba tentando encontrar os tickets.

**Correção**: Mostrar contadores nas abas (ex: "Abertos (0)") para que o usuário saiba onde estão os tickets.

### 3. MÉDIO: WorkOrders usa `!inner` join — OS sem ticket desaparece
Linha 101: `tickets!inner(...)` faz inner join. Se um ticket for deletado mas a OS existir, a OS some silenciosamente da lista.

**Correção**: Remover `!inner` e tratar caso de ticket nulo no frontend.

### 4. BAIXO: `handleDeleteTicket` não verifica OS/RME vinculados
Deletar um ticket que tem OS/RME associados pode causar dados órfãos ou erros de FK (dependendo de cascades). Não há confirmação ao usuário.

**Correção**: Verificar existência de OS/RME antes de deletar e avisar o usuário.

### 5. BAIXO: DashboardStats usa RPC separado + interval próprio, fora do Realtime global
`DashboardStats.tsx` usa `supabase.rpc('get_dashboard_stats')` com `setInterval(30s)` próprio, não usa o `useGlobalRealtime`. Dupla fonte de atualização.

---

## PLANO DE IMPLEMENTAÇÃO

### Fase 1 — Correção Crítica do Realtime (prioridade máxima)
1. **Corrigir `useGlobalRealtime` para usar `useRef`** internamente, evitando que mudanças de referência da callback causem re-subscriptions. Isso resolve o bug em TODOS os consumidores de uma vez.

### Fase 2 — UX e Robustez
2. **Adicionar contadores nas abas de Tickets** — mostrar "(N)" ao lado de cada status para o usuário saber onde estão os tickets
3. **Remover `!inner` em WorkOrders** — usar join normal e tratar ticket nulo
4. **Adicionar confirmação antes de deletar tickets** — verificar OS/RME vinculados

### Fase 3 — Otimização
5. **Integrar DashboardStats ao realtime global** — remover setInterval redundante

### Detalhes Técnicos

**Arquivos a editar:**
- `src/hooks/useRealtimeProvider.tsx` — usar `useRef` para callback
- `src/pages/Tickets.tsx` — adicionar contadores nas abas
- `src/pages/WorkOrders.tsx` — remover `!inner`
- `src/pages/Tickets.tsx` — confirmação de delete com verificação de OS/RME

**Nenhuma migration SQL necessária.**

