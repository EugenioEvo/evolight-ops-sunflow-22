

# Corrigir Score de Técnicos — Usar Dados Reais do Ticket

## Problema
O score mostra 70% para todos os técnicos porque `getSortedPrestadores` usa `globalScores` que é chamado com todos os parâmetros nulos. O cálculo real existe (`ticketScores`, linhas 113-120) mas não é utilizado.

Sem dados de contexto: agenda=100, distância=50, habilidades=50 → `100×0.4 + 50×0.3 + 50×0.3 = 70` para todos.

## Correção

### `src/pages/Tickets.tsx`

1. **Remover `globalScores`** (linhas 122-129) — não faz sentido score sem contexto de ticket

2. **Alterar `getSortedPrestadores`** para aceitar um ticket e calcular scores sob demanda:
   - Usar `ticketScores` quando há um ticket selecionado (expandido/modal)
   - Nos selects de atribuição de técnico dentro da lista de tickets, passar o ticket da linha correspondente

3. **Nos selects de técnico**: cada select já está dentro de um loop/contexto de ticket específico. Passar os dados desse ticket (data, coordenadas, equipamento_tipo) para o scoring.

4. **Fallback**: quando não há ticket selecionado (ex: formulário de criação), usar os dados do formulário (`watch('data_vencimento')`, `watch('equipamento_tipo')`) para calcular score parcial — mesmo sem coordenadas, agenda + habilidades já diferenciam os técnicos.

### `src/hooks/useTechnicianScore.tsx`

5. **Melhorar contagem de agenda**: atualmente conta tickets ativos (sem filtrar por data) quando `ticketDate` é null. Ajustar para contar OS totais abertas do técnico como fallback de carga de trabalho geral quando não há data específica.

## Resultado esperado
- Técnicos com agenda livre na data do ticket terão score mais alto
- Técnicos mais próximos geograficamente (baseado em OS existentes) terão score mais alto
- Técnicos com especialidades compatíveis terão score mais alto
- Scores diferenciados e úteis para tomada de decisão

