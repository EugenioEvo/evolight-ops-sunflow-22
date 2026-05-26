---
name: Business hours window (08-18)
description: Janela útil canônica para cálculo de hora_fim de OS — 08:00–18:00 contínuo, seg-sex
type: feature
---
Janela útil única do sistema: **08:00 — 18:00 contínuo, segunda a sexta**. Fonte da verdade: `src/utils/scheduleWindow.ts` (`computeScheduleEnd`). Edge `gerar-ordem-servico` segue a mesma regra (sem split manhã/tarde). Qualquer cálculo novo de hora_fim/recálculo de duração deve referenciar este util ou replicar exatamente a mesma regra (DAY_START=8*60, DAY_END=18*60, pula sábado/domingo).
