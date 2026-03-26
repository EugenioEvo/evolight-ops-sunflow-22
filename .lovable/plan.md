

# Corrigir cancelamento definitivo: email + atualização no app do técnico

## Problemas identificados

### Problema 1: Email nunca chega ao técnico na exclusão da OS
Em `WorkOrders.tsx` → `handleDeleteOS`:
- A OS é **deletada primeiro** (linha 263), depois tenta enviar email (linha 293)
- A edge function `send-calendar-invite` busca a OS por ID — que já foi deletada. Resultado: erro "OS não encontrada"
- Além disso, a condição `if (osData.calendar_invite_sent_at)` ainda existe, bloqueando o envio quando nunca houve convite prévio

### Problema 2: Edge function exige data/hora mesmo para cancelamento
Em `send-calendar-invite` (linha 71-74), a validação `if (!os.data_programada || !os.hora_inicio || !os.hora_fim)` bloqueia a action `cancel` quando a OS não tem horário definido.

### Problema 3: App do técnico não atualiza
A tela `MinhasOS.tsx` usa realtime, mas se a OS foi deletada do banco, ela desaparece da query. O problema pode ser que o realtime não está capturando DELETEs, ou que a recarga não acontece.

## Plano de correção

### 1. `src/pages/WorkOrders.tsx` — Enviar email ANTES de deletar
- Mover o bloco de envio de email para **antes** do `delete`
- Remover a condição `if (osData.calendar_invite_sent_at)` — enviar sempre que houver técnico

### 2. `supabase/functions/send-calendar-invite/index.ts` — Permitir cancel sem data/hora
- Na action `cancel`, pular a validação de `data_programada`/`hora_inicio`/`hora_fim`
- Quando esses campos são null no cancel, gerar o email sem anexo .ics (apenas notificação HTML) ou usar dados placeholder no .ics

### 3. `src/pages/MinhasOS.tsx` — Garantir atualização
- Verificar se o realtime listener captura eventos DELETE e força refetch
- Se necessário, adicionar listener específico para `ordens_servico` DELETE events

## Arquivos impactados
- `src/pages/WorkOrders.tsx` — reordenar email antes do delete, remover condição
- `supabase/functions/send-calendar-invite/index.ts` — skip validação data/hora no cancel
- `src/pages/MinhasOS.tsx` — verificar/ajustar realtime para DELETEs

