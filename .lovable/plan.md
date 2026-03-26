

# Layout diferenciado para OS recusada no card

## Problema
O card da OS recusada mantém o mesmo visual de um card pendente normal. Falta diferenciação visual clara no card inteiro para refletir que o técnico já recusou e está aguardando gestão.

## Mudanças em `src/pages/MinhasOS.tsx`

### 1. Estilo do Card diferenciado
Quando `aceite_tecnico === 'recusado'`, o `<Card>` terá:
- Borda amarela/âmbar (`border-amber-300`)
- Fundo levemente amarelado (`bg-amber-50/50`)
- Opacity reduzida nos botões de ação para indicar que não há ação disponível

### 2. Header do card
- Ocultar badges de prioridade e status genérico ("Pendente"), substituindo por badge grande "Aguardando Resposta da Gestão" com ícone Hourglass
- Manter número da OS e ticket

### 3. Alert de recusa mais proeminente
- Mover o Alert de recusa para o topo do CardContent (antes das informações de data)
- Usar cor âmbar em vez de muted para maior destaque
- Exibir motivo da recusa com destaque

### 4. Ocultar botões desnecessários
- Remover completamente botões "Aceitar", "Recusar" e "Iniciar Execução" (já está feito)
- Manter apenas "Ligar", "Mapa" e "Ver OS em PDF"

### Arquivo impactado
- `src/pages/MinhasOS.tsx` — condicional no className do Card e reorganização do conteúdo para estado recusado

