

# Implementar fluxo de recusa na tela Ordens de Serviço (gestão)

## Contexto
A tela `WorkOrders.tsx` lista as OS para gestores mas não mostra o status de aceite/recusa do técnico. Os gestores precisam ver quais OS foram recusadas e poder agir (reagendar/reatribuir).

## Mudanças em `src/pages/WorkOrders.tsx`

### 1. Badge de aceite no card da OS
Adicionar badge no header do card mostrando o status de aceite:
- `recusado` → Badge destrutivo "Recusada pelo Técnico"
- `pendente` (quando OS aberta) → Badge âmbar "Aguardando Aceite"
- `aceito` → Badge verde "Aceita"

### 2. Indicador visual no card recusado
Quando `aceite_tecnico === 'recusado'`:
- Borda vermelha/âmbar no card para destaque
- Exibir motivo da recusa truncado abaixo das informações

### 3. Filtro por status de aceite
Adicionar filtro select no bloco de filtros:
- "Todos aceites" / "Aguardando Aceite" / "Aceita" / "Recusada"

### 4. Stat card de recusadas
Adicionar contagem de OS recusadas nos stats (ou incorporar no card "Atrasadas" como sub-indicador)

### 5. Interface WorkOrder
Adicionar `aceite_tecnico` e `motivo_recusa` à interface `WorkOrder` (já vêm do select `*`)

## Arquivo impactado
- `src/pages/WorkOrders.tsx`

