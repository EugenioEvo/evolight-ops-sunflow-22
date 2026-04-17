---
name: Standalone OS Creation
description: Creating an OS without an existing ticket implicitly creates the ticket (status=aprovado) and triggers gerar-ordem-servico in one flow.
type: feature
---
The "+ Nova OS" button in /work-orders opens MultiTechnicianOSDialog in standalone mode (no ticketId). The dialog collects client, address, schedule, technicians, and responsible technician. On submit it creates an implicit ticket (`status='aprovado'`, `tecnico_responsavel_id` = chosen responsible, `created_by=auth.uid()`), then invokes `gerar-ordem-servico` with that ticket. From there the flow is identical to the regular ticket → OS path. The legacy `/work-orders/new` route and `WorkOrderCreate.tsx` page were removed in Phase 3 to eliminate ambiguity.
