---
name: Calendar Invite Permission for Technicians
description: send-calendar-invite allows staff OR the assigned technician of the OS to trigger the invite, enabling technician acceptance flow from the app.
type: feature
---
**Authorization rule:** the `send-calendar-invite` edge function accepts requests from:
- staff (`admin`, `engenharia`, `supervisao`), or
- the technician assigned to the target OS (matched by `tecnicos.profiles.user_id == auth.uid()`).

**Why:** when a technician accepts an OS in-app via `useAceiteOS.acceptOS`, the hook invokes `send-calendar-invite` with the user's JWT. Restricting to staff would silently 403 (the hook only `console.warn`s) and the .ics email would never be sent. Email-link acceptance via `os-acceptance-action` keeps using the service-role key and is unaffected.

**Do NOT** open this function to all authenticated users — assignment ownership must be validated against `ordens_servico.tecnico_id`.
