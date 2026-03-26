

# Corrigir: Criar migration das colunas de aceite

## Problema
As colunas `aceite_tecnico`, `aceite_at` e `motivo_recusa` não existem na tabela `ordens_servico`. A migration nunca foi criada/executada, então todo o código de aceite/recusa está referenciando colunas inexistentes.

## Solução

### 1. Database Migration
Criar migration SQL para adicionar as 3 colunas:

```sql
ALTER TABLE public.ordens_servico
  ADD COLUMN aceite_tecnico text NOT NULL DEFAULT 'pendente',
  ADD COLUMN aceite_at timestamptz,
  ADD COLUMN motivo_recusa text;
```

### 2. Habilitar realtime (opcional)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
```

## Após a migration
Uma vez que as colunas existam, todo o código já implementado (useAceiteOS, useSchedule reset, Tickets.tsx reset on edit/delete, MinhasOS botões aceitar/recusar, WorkOrderDetail badges) passará a funcionar. Aí sim poderemos testar o fluxo completo.

## Arquivos impactados
- Nova migration SQL (via ferramenta de migration)
- Nenhuma alteração de código necessária — o código já foi implementado nas mensagens anteriores

