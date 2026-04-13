

## Problem Analysis

After inspecting the Agenda page code and database, I found these issues:

### 1. Orphaned OS cluttering the agenda
When a ticket is reassigned to a new technician, the old OS gets its `tecnico_id` set to NULL but remains in the database with `aceite_tecnico = 'pendente'`. These orphaned records appear in the agenda alongside the new OS, creating confusion — e.g., OS000010 (no technician) and OS000011 (WEBERSON) both appear for the same ticket on April 2nd.

### 2. No aceite (acceptance) status shown on agenda cards
The agenda cards show email status, presence status, priority, and ticket status — but NOT whether the technician has accepted the OS. This is critical information for supervisors.

### 3. Potential crash if ticket is deleted
The `AgendaOrdemServico` type defines `tickets` as non-nullable, and the UI accesses `os.tickets.titulo` without optional chaining. If a ticket were deleted while an OS still references it, the page would crash.

### 4. No aceite status filter
Supervisors cannot filter the agenda by aceite status (pendente/aceito/recusado).

---

## Plan

### 1. Filter orphaned OS from the agenda query
In `scheduleService.ts`, add `.not('tecnico_id', 'is', null)` to the query to exclude OS records that lost their technician during reassignment. Alternatively, only show OS where `tecnico_id IS NOT NULL`.

### 2. Add aceite status badge to agenda cards
In `Agenda.tsx`, display a badge showing the aceite status (Pendente / Aceito / Recusado) on each OS card, with appropriate colors (yellow/green/red).

### 3. Add null safety for tickets join
In `Agenda.tsx`, add optional chaining for `os.tickets?.titulo`, `os.tickets?.endereco_servico`, etc. Update the `AgendaOrdemServico` type to make `tickets` nullable.

### 4. Add aceite filter to the agenda sidebar
Add a "Filtrar por Aceite" select dropdown alongside the existing technician filter, allowing supervisors to filter by pendente/aceito/recusado/todos.

---

### Technical Details

**File: `src/features/schedule/services/scheduleService.ts`**
- Add `.not('tecnico_id', 'is', null)` to the ordens_servico query to hide orphaned OS

**File: `src/features/schedule/types.ts`**
- Add `aceite_tecnico` field to `AgendaOrdemServico`
- Make `tickets` nullable for safety

**File: `src/pages/Agenda.tsx`**
- Add aceite badge (getAceiteColor helper)
- Add aceite filter state + Select dropdown
- Add null safety for `os.tickets`

**File: `src/features/schedule/hooks/useScheduleData.ts`**
- Add aceite filter to `osDoDia` filtering logic

