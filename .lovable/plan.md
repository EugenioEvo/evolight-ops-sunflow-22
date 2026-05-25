## Diagnóstico

Após investigar `send-calendar-invite`, `os-acceptance-action`, `useAceiteOS` e os logs:

1. **Zero logs** em `send-calendar-invite` (`edge_function_logs` vazio). Isso indica que a função **não está sendo executada** — nem mesmo entra no `try/catch` que loga erros.
2. `**os-acceptance-action` retorna 200** (HTML "OS aceita") confirmado nos logs, mas o `fetch` interno para `send-calendar-invite` (com Bearer = service role key) não produz invocação registrada.
3. **Bug latente em `send-calendar-invite**`: a variável `const method` é declarada dentro do bloco `if (hasSchedule) { ... }` (linha 169) e referenciada fora dele em `content_type: text/calendar; ...; method=${method}` (linha 329, dentro de `if (icsContent)`). Isso é um `ReferenceError` em runtime quando há agendamento — exatamente o caminho do "create" pós-aceite.

A combinação mais provável: o gateway com `verify_jwt = true` está rejeitando as chamadas (tanto a do app quanto a service-role vinda do `os-acceptance-action`), e mesmo quando passa, o `ReferenceError` mata o envio antes do Resend.

## Correções

### 1. `supabase/functions/send-calendar-invite/index.ts`

- Promover `method` e `status` para escopo externo ao `if (hasSchedule)` para que fiquem acessíveis no `emailPayload.attachments[].content_type` e nos headers (default `REQUEST`).
- Sanitizar: se `icsContent` for nulo (cancel sem schedule), não anexar `.ics` (já feito) — mas o `content_type` agora referencia `method` que sempre existe.
- Adicionar log no topo (`console.log('[send-calendar-invite] invoked', { os_id, action, isSystemCall })`) para garantir rastreabilidade mesmo em falhas precoces.

### 2. `supabase/config.toml`

- Alterar `[functions.send-calendar-invite] verify_jwt = true` → `verify_jwt = false`.
- Justificativa: a função **já valida autenticação no código** (linhas 33–75) com três caminhos: (a) service-role bypass (`isSystemCall`), (b) staff via `user_roles`, (c) técnico atribuído à OS. Manter `verify_jwt = true` no gateway interfere com a chamada server-to-server feita por `os-acceptance-action` (Bearer = service role) e bloqueia o fluxo. Mesmo padrão já é usado em `os-acceptance-action`, `process-pending-geocoding`, `api-export`, `confirm-presence` e `send-os-reminders`.

### 3. Verificação

Após o deploy automático:

- Reaceitar uma OS via app → conferir `edge_function_logs` para `send-calendar-invite` (deve registrar "invoked" + "Email enviado") e Resend (e-mail entregue para o técnico e `oem@grupoevolight.com.br`).
- Reaceitar via botão do e-mail → mesmo resultado, com `isSystemCall=true` no log.
- Verificar fila `email_retry_queue` para confirmar que não há novos registros pendentes deste tipo.

## Fora do escopo

- Não mexer em `useAceiteOS` nem em `os-acceptance-action` — ambos já invocam corretamente; o problema é no destino.
- Não alterar a lógica de promoção de responsável, notificações in-app ou conteúdo do e-mail.