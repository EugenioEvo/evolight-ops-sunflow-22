

## Plano Consolidado v3 — Ticket > OS > RME

### Decisões incorporadas (acumuladas)
1. Lógica unificada in-app + email (mesma função `acceptOS/rejectOS`).
2. Auth: Supabase + RLS no app; JWT curto apenas via email.
3. App dispara emails (agendamento no aceite; recusa para criador).
4. `motivo_recusa` obrigatório em ambos canais.
5. `tecnico_responsavel_id` = técnico marcado como "Técnico Responsável" no modal.
6. **NOVO**: Toda OS herda e exibe `tecnico_responsavel_id` (mesmo as OS secundárias do mesmo serviço).
7. **NOVO**: Se o responsável recusa, o **próximo técnico que aceitar** vira responsável automaticamente — propagando para Ticket + todas OS linkadas.
8. **NOVO**: Títulos de email de agendamento e recusa terminam com nome do técnico (ex: `"Agendamento: OS000025 - JJC Alimentos - João Silva"`).

---

### Fase 0 — Memória CORE
Adicionar 2 itens ao `mem://index.md` + arquivo `mem://processo/api-quality-and-recommendations` (rótulos `[VERIFICADO]/[DOCUMENTAÇÃO]/[PADRÃO GERAL]`; calibrar recomendações pelo perfil técnico do usuário).

---

### Fase 1 — UI (a, b, c, f)

**1a `TicketCard.tsx`**: remover dropdowns de seleção de técnico.
**1b `FileUpload.tsx`**: galeria aceita `*/*`; preview com ícone genérico para não-imagens.
**1c `MultiTechnicianOSDialog.tsx`**: remover "Equipe"; mover "Tipo de Trabalho" abaixo dos Técnicos; "Descrição Serviços Solicitados" como Textarea 3 linhas; "Técnico Responsável" como Select obrigatório populado pelos técnicos selecionados.
**1f "+ Nova OS" standalone**: `WorkOrders.tsx` abre `MultiTechnicianOSDialog` em modo standalone (sem ticket). Cliente cria ticket implícito (`status='aprovado'`, `tecnico_responsavel_id` = responsável escolhido, `created_by=auth.uid()`) → invoca `gerar-ordem-servico`. Deprecar `/work-orders/new`.

**Validação**: `tsc --noEmit` + teste E2E manual.

**CHECKPOINT 1** antes da Fase 2.

---

### Fase 2 — Aceite unificado, propagação de responsável, emails

**2.1 Edge function `gerar-ordem-servico`**:
- Receber `tecnico_responsavel_id` no payload.
- Fazer UPDATE no ticket setando `tecnico_responsavel_id` (se ainda for null).
- Criar uma OS por técnico selecionado; **todas** carregam `tecnico_responsavel_id` em campo dedicado (ver 2.2).
- Email "Nova OS Atribuída" agora inclui botões **Aceitar** e **Recusar** (URLs apontam para `os-acceptance-action` com JWT curto).

**2.2 Schema — adicionar coluna `tecnico_responsavel_id` em `ordens_servico`** (migração):
- `tecnico_responsavel_id uuid` (referência lógica a `tecnicos.id`).
- Permite que cada OS carregue a identidade do responsável atual do serviço, não apenas o técnico individual da OS.
- UI de listagem/detalhe passa a exibir badge "Responsável: {nome}" em todas as OS do mesmo ticket.

**2.3 Refatorar `useAceiteOS.tsx`** — função única consolidada:
- `acceptOS(osId)`:
  - UPDATE OS (`aceite_tecnico='aceito'`, `aceite_at`).
  - **Lógica de promoção a responsável**: se o ticket atual tem `tecnico_responsavel_id` apontando para um técnico cuja OS foi recusada (ou nulo), promover este técnico a responsável: UPDATE `tickets.tecnico_responsavel_id` + UPDATE em todas `ordens_servico` do mesmo ticket setando `tecnico_responsavel_id`.
  - Invocar `send-calendar-invite` (action `create`) — título: `"Agendamento: {numero_os} - {cliente} - {nome_tecnico}"`.
  - Notificações in-app para staff.
- `rejectOS(osId, motivo)`:
  - UPDATE OS (`aceite_tecnico='recusado'`, `motivo_recusa`).
  - Reverter ticket para `aprovado` apenas se for a única OS ativa.
  - Invocar `send-rejection-notice` — título: `"OS Recusada: {numero_os} - {cliente} - {nome_tecnico}"`.
  - Notificações in-app para staff e criador.
- Remover `aceitarTicket` (1-step direto na OS).

**2.4 Nova edge function `os-acceptance-action`** (`verify_jwt = false`):
- Valida JWT HS256 (payload `{os_id, tecnico_id, exp:7d}`, assinado com `SUPABASE_JWT_SECRET`).
- `?action=aceitar` → executa mesma lógica de `acceptOS` (incluindo promoção a responsável).
- `?action=recusar` → renderiza HTML leve com textarea obrigatória; POST executa `rejectOS`.
- Retorna HTML de confirmação.

**2.5 Nova edge function `send-rejection-notice`** (`verify_jwt = true`):
- Recebe `os_id`. JOIN `ordens_servico → tickets → profiles.email` (do `created_by`).
- Envia via Resend para o criador, assunto `"OS Recusada: {numero_os} - {cliente} - {nome_tecnico}"`, link `/work-orders/{id}`.

**2.6 Nova edge function `resend-os-acceptance-email`** (`verify_jwt = true`):
- Reenvia email com botões aceite/recusa para um técnico ao reatribuir uma OS recusada.

**2.7 `WorkOrderDetail.tsx`** — Reatribuição quando `aceite_tecnico='recusado'`:
- Dropdown "Reatribuir técnico".
- Ao trocar: UPDATE `tecnico_id` + reset `aceite_tecnico='pendente'` + `motivo_recusa=null` → invoca `resend-os-acceptance-email`.

**2.8 `send-calendar-invite`**: remover botão "Confirmar Presença" do template base (lógica de aceite migrou); ajustar assunto para incluir nome do técnico; manter actions `cancel`/`reassign_removed`/`update`.

**Validação Fase 2**: deploy de todas funções; teste E2E completo (aprovar → gerar OS → email com botões → recusa via email → criador notificado → reatribuir → novo aceite → calendário enviado → responsável propagado para Ticket+OS linkadas).

---

### Fase 3 — Limpeza
- Remover `WorkOrderCreate.tsx` e rota antiga.
- Atualizar memórias: `os-generation/technician-acceptance-flow`, novas `email-delivery/os-acceptance-email-buttons`, `os-generation/standalone-os-creation`, `os-generation/responsible-technician-promotion`.

---

### Detalhes técnicos críticos

**Promoção automática a responsável** (in-app e email — lógica idêntica):
```text
ON acceptOS(osId):
  current_responsavel = tickets.tecnico_responsavel_id
  IF current_responsavel IS NULL OR
     EXISTS(OS with tecnico_id=current_responsavel AND aceite_tecnico='recusado'):
    novo_responsavel = OS.tecnico_id (do que está aceitando)
    UPDATE tickets SET tecnico_responsavel_id = novo_responsavel
    UPDATE ordens_servico SET tecnico_responsavel_id = novo_responsavel
      WHERE ticket_id = OS.ticket_id
```

**Schema change necessária** (migração):
```sql
ALTER TABLE ordens_servico ADD COLUMN tecnico_responsavel_id uuid;
CREATE INDEX idx_os_tecnico_responsavel ON ordens_servico(tecnico_responsavel_id);
```
Sem FK rígida (consistente com padrão atual da tabela). Validação por trigger opcional ou client-side.

**Templates de assunto de email**:
| Tipo | Formato |
|---|---|
| Nova OS Atribuída | `Nova OS Atribuída: {numero_os} - {nome_tecnico}` |
| Agendamento (aceite) | `Agendamento: {numero_os} - {cliente} - {nome_tecnico}` |
| OS Recusada | `OS Recusada: {numero_os} - {cliente} - {nome_tecnico}` |

**Risco — promoção em condição de corrida**: dois técnicos aceitam simultaneamente. Mitigação: usar `UPDATE ... WHERE tecnico_responsavel_id IS NULL OR tecnico_responsavel_id = ?` (condicional) — apenas o primeiro update terá efeito; segundo retorna 0 rows e ignora promoção. `[PADRÃO GERAL]` — validar com teste após deploy.

---

### Ordem de execução
1. Fase 0 (memória)
2. Fase 1a, 1b, 1c, 1f
3. **CHECKPOINT 1**
4. Migração schema (2.2) + Fase 2.1, 2.3 (refator in-app) — testar promoção localmente
5. Fase 2.4–2.8 (edge functions + emails) — deploy incremental
6. **CHECKPOINT 2** — E2E completo
7. Fase 3 — limpeza e memórias

