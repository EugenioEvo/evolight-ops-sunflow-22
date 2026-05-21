## Problema

`os-acceptance-action` (acionada pelos botões Aceitar/Recusar do e-mail) chama `send-calendar-invite` autenticando com `SUPABASE_SERVICE_ROLE_KEY`. Porém `send-calendar-invite` valida o header tratando-o como JWT de usuário (`auth.getClaims`), o que falha → 401 → e-mail de agendamento nunca é enviado.

Aceite feito dentro do app funciona normalmente (usa o JWT do usuário logado, que é o técnico atribuído à OS).

## Correção

Permitir bypass da checagem de papel quando a chamada vier com a service role key (uso server-to-server confiável), mantendo as regras atuais (staff ou técnico atribuído) para chamadas com JWT de usuário.

### Alteração em `supabase/functions/send-calendar-invite/index.ts`

No bloco de autorização (início do handler), antes de tentar `auth.getClaims`:

1. Extrair o bearer do header `Authorization`.
2. Se o token for igual a `SUPABASE_SERVICE_ROLE_KEY`, considerar a chamada autorizada como "system" e pular a checagem de papel/atribuição.
3. Caso contrário, manter o fluxo atual: `getClaims` → checar `user_roles` (staff) ou técnico atribuído à OS.

Mantém-se inalterado:
- O envelope de envio do e-mail (`recipients = [tecnicoEmail, "oem@grupoevolight.com.br"]`).
- A regra para chamadas em-app (técnico aceita pelo app continua validado por RLS/atribuição).
- A função `os-acceptance-action` continua passando a service role key (já é o padrão de outras chamadas server-to-server do projeto).

## Validação

1. Aceitar uma OS de teste pelo botão "Aceitar" do e-mail.
2. Conferir logs de `os-acceptance-action` e `send-calendar-invite` (ambos devem registrar a chamada).
3. Conferir no painel do Resend o envio do e-mail "Agendamento: OSxxxxxx - Cliente - Técnico" para o técnico e para `oem@grupoevolight.com.br`, com `.ics` anexado.
4. Repetir um aceite **dentro do app** para garantir que o fluxo já existente continua funcionando (não regredir).

## Fora de escopo

- Mudanças no conteúdo do e-mail/.ics.
- Alterações no fluxo de recusa.
- Mudança da lista de destinatários (mantido como está, conforme combinado anteriormente).
