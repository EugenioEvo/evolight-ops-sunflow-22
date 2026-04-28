## Objetivo

Reorganizar a UI de campos de data/hora em **Tickets**, **OS** e **RME** para que:
1. Campos **automáticos** apareçam como leitura (ou nem apareçam) — técnico só edita o que é manual.
2. Travas de coerência impeçam datas/horários inválidos.
3. Cálculo de "Horário Programado" da OS respeite a janela útil (09:00-12:00 e 14:00-17:00, seg-sex), com **virada de dia** automática quando a duração ultrapassa.

---

## Escopo por entidade

### Ticket (`TicketForm.tsx`)

| Campo | Tipo hoje | Ação |
|---|---|---|
| `created_at` (a) | Auto | Já é auto. **Manter visível no card** como hoje. |
| `data_servico` (b) | Manual | Manter input. Trava: ≥ hoje. |
| `data_vencimento` (c) | Manual | Manter input. Trava: ≥ `data_servico`. |
| `horario_previsto_inicio` (d) | Manual | Manter input (confirmado). Trava: dentro de 09:00-12:00 ou 14:00-17:00 (warning, não bloqueia). |

**Novas validações Zod** no `ticketFormSchema`: refinements cruzando os 3 campos. Erros via `FormMessage`.

### OS (`MultiTechnicianOSDialog.tsx` + `WorkOrderDetail.tsx`)

| Campo | Origem | UI |
|---|---|---|
| `created_at` (e) | Auto | **Não exibir no card.** Visível apenas em detalhe (read-only). |
| `data_programada` (f) = ticket.data_servico | Auto | Card: read-only, vindo do ticket. No dialog standalone continua editável (campo do ticket implícito). |
| `hora_inicio`/`hora_fim` (g) | Auto = `horario_previsto_inicio` + duração computada | Card mostra `HH:MM - HH:MM (dd/MM/yy)` quando vira o dia. **Remover qualquer input manual** do dialog para esses campos. |
| `data_inicio_execucao` (h) + hora (i) | Auto ao "Iniciar Execução" | Já é assim. Garantir que aparecem como read-only. |
| `data_conclusao` (j) + hora (k) | Auto ao aprovar RME (vem de `rme.end_time`) | Já é assim no `WorkOrderDetail`. Manter. |

**Cálculo de janela útil (novo helper `src/utils/scheduleWindow.ts`):**
- Input: `data_servico` (YYYY-MM-DD), `hora_inicio` (HH:MM), `duracao_min`.
- Distribui minutos nas janelas 09:00-12:00 e 14:00-17:00, seg-sex.
- Pula sábados/domingos.
- Retorna `{ endDate, endTime, crossedDay: boolean, weekendWarning: boolean }`.
- Usado no `MultiTechnicianOSDialog` para preencher `hora_fim` ao gerar a OS, e no card/detalhe da OS para renderizar `08:40 - 15:00 (29/04/26)` quando `crossedDay`.

**Edge function `gerar-ordem-servico`**: passar a calcular `hora_fim` (e `data_programada` final) usando esse helper em vez do `horas_previstas` simples — para consistência server-side.

### RME (`StepServiceShift.tsx`)

| Campo | Origem | UI |
|---|---|---|
| `data_execucao` (l-data) | Auto = `os.data_inicio_execucao` | **Read-only** (Input disabled). Botão de Calendar removido. |
| `start_time` (l-hora) | Auto = hora de início da execução | **Read-only**. |
| `data_fim_execucao` (m-data) | Manual | Manter editável. Trava: ≥ `data_execucao`. |
| `end_time` (m-hora) | Manual | Manter editável. Trava: se `data_fim == data_execucao`, então `end_time > start_time`. |

Pré-preencher `data_execucao` e `start_time` ao abrir o wizard via `useEffect` lendo `ordem_servico.data_inicio_execucao` (já existe no ticket linked).

---

## Detalhes técnicos

**Arquivos editados:**
- `src/utils/scheduleWindow.ts` *(novo)* — helper de janela útil + virada de dia.
- `src/features/tickets/components/TicketForm.tsx` — refinements Zod e mensagens.
- `src/components/MultiTechnicianOSDialog.tsx` — usar helper para preview do `hora_fim`, exibir aviso "vira para dd/MM" ou "cai em FDS", aplicar mesmas travas no modo standalone.
- `src/features/work-orders/components/` (e `WorkOrderDetail.tsx`) — formatar exibição de "Horário Programado" com virada de dia.
- `src/components/rme-wizard/StepServiceShift.tsx` — `data_execucao` e `start_time` como read-only; validações em `data_fim_execucao`/`end_time`.
- `src/pages/RMEWizard.tsx` — pré-preencher data/hora de início vindo da OS.
- `supabase/functions/gerar-ordem-servico/index.ts` — usar mesma lógica de janela ao persistir `hora_inicio`/`hora_fim`/`data_programada`.

**Travas resumidas:**
- Ticket: `data_servico ≥ today`, `data_vencimento ≥ data_servico`.
- OS standalone: idem ticket.
- RME: `data_fim_execucao ≥ data_execucao`; mesmo dia → `end_time > start_time`.
- Janela útil: warning, nunca bloqueio (preferência confirmada).

**Sem mudança de schema** — todos os campos já existem.