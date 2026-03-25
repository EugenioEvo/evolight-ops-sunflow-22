

# Auditoria Completa do SunFlow

## Resumo da Varredura

Analisei o banco de dados, queries, rotas, componentes e fluxos end-to-end. Abaixo os achados organizados por severidade.

---

## BUGS CRITICOS

### 1. Rota "/configuracoes" não existe
O sidebar (`AppSidebar.tsx`) tem um link para `/configuracoes`, mas nao existe nenhuma pagina para essa rota. Clicar nela leva ao NotFound.

**Correção**: Criar uma página `Configuracoes.tsx` ou remover o item do menu.

### 2. `require()` no ProtectedRoute (incompatível com Vite/ESM)
Linha 60 usa `require('@/pages/PendingApproval')` — isso pode falhar em builds ESM/Vite. Deveria usar lazy import com `React.lazy()` + `Suspense`, ou importação estática.

### 3. Ticket TK000002 tem status "aberto" mas já tem OS gerada
No banco: `TK000002` está com `status: aberto` mas tem `OS000002` associada. Isso é inconsistente — o fluxo deveria ter mudado o status para `ordem_servico_gerada` ao gerar a OS.

**Correção**: Verificar a edge function `gerar-ordem-servico` para garantir que atualiza o status do ticket. Corrigir o dado manualmente.

### 4. Técnicos sem prestador vinculado
3 técnicos (Edson Eulalio, Eugenio Garcia, ze faisca, zezinho das couves) existem na tabela `tecnicos` mas NÃO têm `prestadores` correspondente. Isso pode causar problemas ao atribuir técnicos em tickets, pois `tickets.tecnico_responsavel_id` referencia `prestadores.id`, não `tecnicos.id`.

**Impacto**: Esses técnicos aparecem na Agenda e em Tecnicos, mas não podem ser atribuídos a tickets pelo fluxo normal.

---

## BUGS MEDIANOS

### 5. Dualidade tecnicos vs prestadores causa confusão
O sistema usa duas tabelas para representar técnicos:
- `prestadores` (usado em Tickets para `tecnico_responsavel_id`)
- `tecnicos` (usado em OS para `tecnico_id`)

A correspondência é feita por email, o que é frágil. Se emails diferirem minimamente, o vínculo se perde.

### 6. Agenda: `loadOrdensServico` chamado no `useEffect` sem `loadOrdensServico` na dependência
Linha 140-141: `useEffect` depende de `[selectedDate, selectedTecnico]` mas deveria incluir `loadOrdensServico` (que é `useCallback`). Na prática funciona porque `loadOrdensServico` já depende dessas variáveis, mas é um antipattern.

### 7. Dashboard: PerformanceMetrics faz queries diretas sem tratamento de erro visível
O componente `PerformanceMetrics` no Index.tsx busca dados diretamente sem mostrar loading ou erros ao usuário.

### 8. Sidebar: item "Configurações" visível para todos os roles, sem filtro `adminOnly`
Todos os usuários veem "Configurações" no menu, incluindo técnicos e clientes, mas a rota nem existe.

### 9. WorkOrders usa `!inner` join em tickets
Se um ticket for deletado mas a OS permanecer, a OS desaparece silenciosamente da lista.

---

## MELHORIAS SUGERIDAS

### 10. Unificar tabelas tecnicos/prestadores
A maior fonte de bugs é a duplicidade. Idealmente, `prestadores` com `categoria = 'tecnico'` deveria ser a tabela canônica, ou um campo `tecnico_id` FK deveria vincular diretamente.

### 11. Adicionar paginação nas listas de tickets e OS
Tickets e WorkOrders carregam TODOS os registros de uma vez. Com crescimento de dados, isso vai degradar performance. O limite padrão do Supabase é 1000 rows.

### 12. Adicionar confirmação antes de deletar tickets
`handleDeleteTicket` faz delete direto. Deveria verificar se há OS/RME vinculados e avisar o usuário.

### 13. Criar página de Configurações
Adicionar configurações básicas: perfil do usuário, preferências de notificação, etc.

### 14. Loading states consistentes
Algumas páginas usam `LoadingState`, outras usam spinners customizados, e algumas (como PerformanceMetrics) não têm loading visual.

### 15. Realtime duplicado
`useTicketsRealtime` é chamado no Index.tsx, Tickets.tsx, MinhasOS.tsx e Agenda.tsx — cada um criando canais Realtime separados. Poderia ser centralizado.

---

## PLANO DE IMPLEMENTAÇÃO

### Fase 1 — Correções Críticas (prioridade)
1. **Remover ou criar rota `/configuracoes`** — remover do sidebar por enquanto
2. **Corrigir `require()` no ProtectedRoute** — trocar para import estático
3. **Corrigir status do TK000002** no banco para `ordem_servico_gerada`
4. **Criar prestadores faltantes** para técnicos sem vínculo (Edson, Eugenio, ze faisca, zezinho)

### Fase 2 — Melhorias de Robustez
5. **Adicionar `loadOrdensServico` como dependência** do useEffect na Agenda
6. **Adicionar loading/error states** no PerformanceMetrics
7. **Filtrar "Configurações"** do sidebar para não aparecer (ou criar a página)

### Fase 3 — Melhorias de Escala
8. **Adicionar paginação** em Tickets e WorkOrders
9. **Consolidar realtime** em um único hook global

### Detalhes Técnicos
- **Arquivos a editar**: `AppSidebar.tsx`, `ProtectedRoute.tsx`, `Index.tsx` (PerformanceMetrics), `Agenda.tsx`
- **Migrations SQL**: INSERT de prestadores faltantes, UPDATE status TK000002
- **Nenhuma mudança de schema** necessária nesta fase

