

# Revisao geral: alinhar tickets e todos os perfis com o fluxo atual

## Problemas identificados

### 1. Tickets.tsx — Formulario com campo duplicado
- `endereco_servico` aparece duas vezes (linhas 957-969 e 1024-1036)

### 2. Tickets.tsx — Sem indicador de aceite/recusa da OS vinculada
- Cards de tickets com status `ordem_servico_gerada` nao mostram se a OS foi aceita, recusada ou esta pendente de aceite
- Quando ticket voltou para `aprovado` apos recusa de OS, nao ha indicacao visual

### 3. Tickets.tsx — Botao Editar aparece em estados onde nao deveria
- Ticket em `em_execucao` e `concluido` ainda permite editar (linhas 1517, 1577), o que pode causar inconsistencias com OS ativa

### 4. TechnicianDashboard — Sem dados de aceite/recusa
- Stats nao contam OS aguardando aceite vs recusadas (linha 71: conta tudo como `pendentes`)
- Cards de OS nao mostram badge de aceite/recusa
- Botao "Ver Agenda" (linha 261) aponta para `/agenda` que e bloqueada para tecnicos

### 5. DashboardStats (gestao) — Sem metricas de recusa
- RPC `get_dashboard_stats()` nao retorna contagem de OS recusadas
- Nao ha card "OS Recusadas" no dashboard

## Plano de correcao

### A. `src/pages/Tickets.tsx`
1. Remover campo `endereco_servico` duplicado (linhas 1024-1036)
2. Adicionar badge de aceite da OS vinculada nos cards de tickets com status `ordem_servico_gerada`:
   - Buscar `aceite_tecnico` na query de tickets (ja vem via `ordens_servico`)
   - Expandir select para incluir `aceite_tecnico, motivo_recusa` de `ordens_servico`
   - Mostrar badge: "Aguardando Aceite" (amarelo), "Aceita" (verde), "Recusada" (vermelho)
   - Se recusada, mostrar motivo truncado
3. Quando ticket esta em `aprovado` e possui OS recusada vinculada, mostrar alerta "Retornou apos recusa"
4. Remover botao "Editar" para tickets em status `em_execucao` e `concluido`

### B. `src/components/TechnicianDashboard.tsx`
1. Separar stats: `aguardandoAceite` (aceite_tecnico = 'pendente'), `recusadas` (aceite_tecnico = 'recusado')
2. Adicionar badge de aceite nos cards de OS ativas
3. Substituir botao "Ver Agenda" por "Ver Rota" (aponta para `/routes` que ja funciona para tecnicos)

### C. `src/components/DashboardStats.tsx` + SQL Migration
1. Atualizar RPC `get_dashboard_stats()` para incluir `os_recusadas`:
   ```sql
   SELECT COUNT(*) INTO v_os_recusadas
   FROM public.ordens_servico
   WHERE aceite_tecnico = 'recusado';
   ```
2. Adicionar card "OS Recusadas" no DashboardStats com icone XCircle e cor vermelha

## Arquivos impactados
- `src/pages/Tickets.tsx`
- `src/components/TechnicianDashboard.tsx`
- `src/components/DashboardStats.tsx`
- Migration SQL para `get_dashboard_stats()`

