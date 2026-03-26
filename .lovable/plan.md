

# Melhorar visual de OS recusada — "Aguardando Resposta da Gestão"

## Problema
Quando o técnico recusa uma OS, ela continua na aba "Pendentes" com badge "Recusada", mas não fica claro que está aguardando ação da gestão. O layout precisa comunicar melhor esse estado.

## Mudanças em `src/pages/MinhasOS.tsx`

### 1. Card de OS recusada com layout diferenciado
- Quando `aceite_tecnico === 'recusado'`, o card terá:
  - Borda/fundo diferente (amarelo/cinza) para se destacar visualmente
  - Badge principal: **"Aguardando Resposta da Gestão"** (substituindo "Recusada")
  - Exibição do motivo de recusa informado pelo técnico
  - Ocultar botões de aceite/recusa e iniciar execução (já estão ocultos)
  - Manter apenas botões informativos (Ver PDF, Mapa, Ligar)

### 2. Ajustes nos badges do header do card
- Trocar badge "Recusada" (vermelho) por "Aguardando Gestão" (cinza/azul) no header
- Na seção inferior, substituir o badge atual `OS Recusada — Aguardando reagendamento` por um Alert mais informativo com ícone de clock/hourglass

### 3. Contagem na aba
- Adicionar indicador na aba "Pendentes" mostrando quantas estão aguardando gestão vs aguardando aceite

### Arquivos impactados
- `src/pages/MinhasOS.tsx` — visual do card recusado e badges

