

# Alinhar emails com o fluxo de aceite/recusa

## Mudanças

### 1. `supabase/functions/send-calendar-invite/index.ts` — nova action `rejection_reschedule`
Adicionar suporte a `action: 'rejection_reschedule'` com template específico:
- Subject: "Reagendamento: OS XXXX — Nova atribuição após recusa"
- Body menciona que a OS foi revista e reagendada, pedindo novo aceite
- Mantém convite .ics anexado normalmente

### 2. `src/hooks/useCancelOS.tsx` — remover condição de envio
Remover a condição `if (os.calendar_invite_sent_at && os.data_programada)` para que o email de cancelamento seja enviado **sempre** que a OS tiver técnico com email.

### 3. `src/hooks/useSchedule.tsx` — detectar reagendamento pós-recusa
Antes de invocar `send-calendar-invite`, verificar se `aceite_tecnico === 'recusado'`. Se sim, usar action `rejection_reschedule` em vez de `update`/`create`.

### 4. Gap 2 — Recusa do técnico
Mantém apenas notificação in-app (já implementado no `useAceiteOS`). Sem email para gestão.

## Arquivos impactados
- `supabase/functions/send-calendar-invite/index.ts`
- `src/hooks/useCancelOS.tsx`
- `src/hooks/useSchedule.tsx`

