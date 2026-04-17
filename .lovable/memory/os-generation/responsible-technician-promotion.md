---
name: Responsible Technician Promotion
description: When the current responsible technician rejects an OS, the next technician who accepts is automatically promoted to responsible across the ticket and all linked OS records.
type: feature
---
**Rule:** `ordens_servico.tecnico_responsavel_id` mirrors `tickets.tecnico_responsavel_id` for every OS in the same service.

**Promotion logic** (identical for in-app `useAceiteOS.acceptOS` and email-based `os-acceptance-action`):
```
ON acceptOS(osId):
  current_responsavel = tickets.tecnico_responsavel_id
  IF current_responsavel IS NULL OR
     EXISTS(OS with tecnico_id=current_responsavel AND aceite_tecnico='recusado'):
    novo_responsavel = OS.tecnico_id (do que está aceitando)
    UPDATE tickets SET tecnico_responsavel_id = novo_responsavel
      WHERE id = ticket_id
        AND (tecnico_responsavel_id IS NULL OR tecnico_responsavel_id = current_responsavel)
    UPDATE ordens_servico SET tecnico_responsavel_id = novo_responsavel
      WHERE ticket_id = ticket_id
```
**Race condition mitigation [PADRÃO GERAL]:** conditional UPDATE ensures only the first concurrent accept wins; later updates affect 0 rows and are no-ops.
