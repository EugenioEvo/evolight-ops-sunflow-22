

# Ajustes no sistema de e-mail — 4 alteracoes

## Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/send-calendar-invite/index.ts` | MIME headers, remover ATTENDEE O&M, trocar emails, TRIGGER 60min |
| `supabase/functions/gerar-ordem-servico/index.ts` | Trocar sender email |
| `supabase/functions/send-rme-email/index.ts` | Trocar sender email |
| `supabase/functions/send-os-reminders/index.ts` | Trocar sender email |
| `supabase/functions/process-email-retries/index.ts` | Trocar sender email |

## Detalhes por item

### 1. Cabecalho MIME no anexo .ics

Alterar o objeto `attachments` do Resend para incluir `content_type` com os headers corretos:

```typescript
attachments: [{
  filename: "convite.ics",
  content: icsContent,
  content_type: 'text/calendar; charset="UTF-8"; method=REQUEST',
}]
```

Tambem adicionar header customizado no email:

```typescript
headers: {
  "Content-Class": "urn:content-classes:calendarmessage",
}
```

Isso garante que clientes como Outlook interpretem o anexo como convite de calendario nativo.

### 2. Remover ATTENDEE "Equipe O&M"

No bloco de geracao do `.ics` (linha 167), remover:
```
ATTENDEE;CN=Equipe O&M;RSVP=TRUE:mailto:${CONFIG.teamEmail}
```

O time continua recebendo o email (esta na lista `recipients`), mas nao aparece como participante no evento do calendario.

### 3. Trocar agendamento@ para oem@

Em todos os 5 arquivos, substituir `agendamento@grupoevolight.com.br` por `oem@grupoevolight.com.br`:

- `send-calendar-invite`: CONFIG.senderEmail, CONFIG.organizerEmail
- `gerar-ordem-servico`: campo `from` do Resend
- `send-rme-email`: campo `from` do Resend
- `send-os-reminders`: CONFIG.senderEmail
- `process-email-retries`: CONFIG.senderEmail

### 4. TRIGGER de 30min para 60min

Linha 169: trocar `TRIGGER:-PT30M` para `TRIGGER:-PT60M`
Linha 171: trocar descricao para "Lembrete: OS em 60 minutos"

## Resultado esperado do .ics apos mudancas

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SunFlow//Agendamento OS//PT
METHOD:REQUEST
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:os-OS000042@sunflow.grupoevolight.com.br
DTSTAMP:20260715T103000Z
DTSTART:20260716T083000
DTEND:20260716T103000
SUMMARY:OS000042 - Solar Energy Ltda
DESCRIPTION:...
LOCATION:Rua das Flores, 123
STATUS:CONFIRMED
SEQUENCE:0
ORGANIZER;CN=SunFlow:mailto:oem@grupoevolight.com.br
ATTENDEE;CN=Joao Silva;RSVP=TRUE:mailto:joao@email.com
BEGIN:VALARM
TRIGGER:-PT60M
ACTION:DISPLAY
DESCRIPTION:Lembrete: OS em 60 minutos
END:VALARM
END:VEVENT
END:VCALENDAR
```

