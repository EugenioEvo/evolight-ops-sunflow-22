---
name: edge-function-multi-role-check
description: Edge functions devem checar roles via SELECT lista (sem .maybeSingle/.single) e usar .some() para suportar usuários multi-role.
type: constraint
---
**Regra:** Em edge functions, NUNCA usar `.maybeSingle()` ou `.single()` para checar role do usuário em `user_roles`. O sistema suporta múltiplas roles por usuário ([multi-role pontual](mem://auth/multi-role-pontual)) — `.maybeSingle()` retorna `null` quando há >1 linha, bloqueando indevidamente staff legítimos.

**Padrão correto:**
```ts
const { data: rolesData } = await supabase
  .from('user_roles').select('role').eq('user_id', userId);
const userRoles = (rolesData || []).map((r: { role: string }) => r.role);
if (!userRoles.some((r: string) => ['admin', 'engenharia', 'supervisao'].includes(r))) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
}
```

**Por quê:** Caso real (TK000039, abr/2026): Hercules ganhou role `supervisao` adicional ao `tecnico_campo` → `.maybeSingle()` retornou null → bloqueado em `gerar-ordem-servico` mesmo sendo staff.

**Onde aplicado:** gerar-ordem-servico, geocode-address, mapbox-directions, mapbox-geocode, process-email-retries, process-pending-geocoding, resend-os-acceptance-email, send-calendar-invite, send-os-reminders, send-ticket-decision-email.
