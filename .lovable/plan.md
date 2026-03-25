

# Análise: Email ao Técnico + Confirmação de Presença

## Fluxo Atual (como deveria funcionar)

```text
OS Gerada → [manual] Enviar Convite (send-calendar-invite) → Técnico recebe email .ics
                                                                    ↓
OS D-1    → [cron?] send-os-reminders → Email lembrete com botão "Confirmar Presença"
                                         (gera token em presence_confirmation_tokens)
                                                                    ↓
Técnico clica → confirm-presence edge function → Valida token → Marca presence_confirmed_at
                                                                    ↓
QR Code na UI → PresenceConfirmationStatus → Gera QR apontando para confirm-presence
```

---

## BUGS ENCONTRADOS

### 1. CRITICO: QR Code usa `qr_code` como token — mas `confirm-presence` valida contra `presence_confirmation_tokens`

O `PresenceConfirmationStatus.tsx` (linha 58) gera o QR Code assim:
```
confirmUrl = `${baseUrl}/functions/v1/confirm-presence?os_id=${id}&token=${ordemServico.qr_code}`
```

O campo `qr_code` contém valores como `OS-OS000004-34641b5b-...` (gerado na criação da OS).

Porém, `confirm-presence` valida o token com `validate_presence_token()`, que busca na tabela `presence_confirmation_tokens`. Os tokens reais nessa tabela são UUIDs como `04ecc225-3ff9-...`, gerados APENAS por `send-os-reminders` via `generate_presence_token()`.

**Resultado**: O QR Code da UI NUNCA funciona. O token `OS-OS000004-...` nunca existirá na tabela `presence_confirmation_tokens`, então `validate_presence_token` sempre retorna `false`.

### 2. CRITICO: `PresenceConfirmation.tsx` redireciona para URL errada

Linha 23: `const confirmUrl = ${baseUrl}/supabase/functions/v1/confirm-presence?...`

O path `/supabase/functions/v1/` não existe no domínio do app. O correto seria usar `VITE_SUPABASE_URL` + `/functions/v1/confirm-presence`. Porém essa página nem é necessária — o email do lembrete já aponta direto para o edge function.

### 3. MEDIO: `send-calendar-invite` não envia link de confirmação de presença

O convite de calendário (.ics) é enviado quando o admin clica "Enviar convite" na UI, mas esse email NÃO contém botão/link de confirmação de presença. O link de confirmação só é enviado pelo `send-os-reminders` (lembrete D-1).

Se o `send-os-reminders` não rodar (não há cron job configurado), o técnico NUNCA recebe o link de confirmação.

### 4. MEDIO: `send-os-reminders` não tem cron job ativo

Não há evidência de um `pg_cron` configurado para disparar `send-os-reminders` automaticamente. OS000001 e OS000002 tiveram `reminder_sent_at` preenchido (provavelmente disparados manualmente), mas OS000003 e OS000004 não.

### 5. MEDIO: Nenhuma OS teve `calendar_invite_sent_at` preenchido

Todas as 4 OS têm `calendar_invite_sent_at: null` — o envio de convite por email nunca funcionou ou nunca foi acionado. Os logs do `send-calendar-invite` estão vazios.

---

## PLANO DE CORREÇÃO

### Fase 1 — Corrigir QR Code (bug crítico)

**`PresenceConfirmationStatus.tsx`**: Em vez de usar `ordemServico.qr_code` como token, gerar um token real via `generate_presence_token` RPC ao abrir o QR Code. Guardar o token gerado e usá-lo na URL.

Alternativamente, gerar o token no momento de "Gerar QR Code" e armazená-lo junto com o qr_code.

### Fase 2 — Corrigir `PresenceConfirmation.tsx`

Reescrever para chamar o edge function via `VITE_SUPABASE_URL` (não `window.location.origin`), ou melhor: fazer a confirmação inline no próprio componente React chamando o edge function via fetch e mostrando o resultado sem redirect.

### Fase 3 — Adicionar link de confirmação no email do convite

Modificar `send-calendar-invite` para também gerar um `presence_token` e incluir o botão "Confirmar Presença" no corpo do email, assim o técnico pode confirmar já no primeiro email (não apenas no lembrete D-1).

### Fase 4 — Verificar/criar cron para `send-os-reminders`

Verificar se existe cron job para disparar os lembretes automaticamente e criar se necessário.

---

### Detalhes Técnicos

**Arquivos a editar:**
- `src/components/PresenceConfirmationStatus.tsx` — gerar token real via RPC
- `src/pages/PresenceConfirmation.tsx` — corrigir URL ou reescrever como inline
- `supabase/functions/send-calendar-invite/index.ts` — adicionar link de confirmação
- Possível migration SQL para cron job do `send-os-reminders`

**Nenhuma mudança de schema necessária.**

