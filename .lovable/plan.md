

# Fluxo de Aceite/Recusa de OS pelo Técnico

## Problema atual
- A OS usa `data_vencimento` (data limite) como `data_programada`, quando deveria usar `data_servico`
- Não existe fluxo de aceite/recusa — o técnico recebe a OS e pronto

## Nova lógica

```text
OS Gerada → Técnico notificado
  ├─ ACEITAR → data_programada = data da OS confirmada, status = "aceita"
  └─ RECUSAR → técnico pede reagendamento
       ├─ Gestor reagenda (mesma OS, nova data) → técnico original notificado
       └─ Gestor reatribui a outro técnico → técnico original recebe cancelamento
            └─ Novo técnico recebe fluxo inicial (aceite/recusa)
```

## Mudanças

### 1. Database Migration
- Adicionar coluna `aceite_tecnico` na tabela `ordens_servico`: `text DEFAULT 'pendente'` (valores: `pendente`, `aceito`, `recusado`)
- Adicionar coluna `aceite_at` (timestamp) e `motivo_recusa` (text)
- Habilitar realtime na tabela `ordens_servico` para aceite

### 2. Edge Function `gerar-ordem-servico`
- Mudar de `data_programada: ticket.data_vencimento` para `data_programada: ticket.data_servico || ticket.data_vencimento`
- Priorizar `data_servico` sobre `data_vencimento`

### 3. Tela "Minhas OS" (MinhasOS.tsx)
- Para OS com `aceite_tecnico = 'pendente'`: mostrar botões "Aceitar" e "Recusar"
- Aceitar: atualiza `aceite_tecnico = 'aceito'`, `aceite_at = now()`
- Recusar: abre modal pedindo motivo, atualiza `aceite_tecnico = 'recusado'`, `motivo_recusa`, envia notificação ao gestor

### 4. Novo componente: AceiteOSDialog
- Modal de recusa com campo de motivo obrigatório
- Confirma a recusa e notifica gestores

### 5. Notificações
- **Aceite**: notificação para gestores (staff) informando que técnico aceitou
- **Recusa**: notificação para gestores com motivo, link para reagendar/reatribuir
- **Reagendamento**: notificação ao técnico original informando nova data
- **Reatribuição**: notificação ao técnico original (cancelamento) + notificação ao novo técnico (fluxo inicial)

### 6. Tela de Gestão (WorkOrderDetail.tsx / Tickets.tsx)
- Mostrar status de aceite na OS (badge: Pendente/Aceito/Recusado)
- Para OS recusadas: botões "Reagendar" e "Reatribuir Técnico"
- Reatribuição: ao trocar técnico, reseta `aceite_tecnico = 'pendente'`, envia cancelamento ao antigo e notificação ao novo

### 7. Hook useSchedule
- No reagendamento: resetar `aceite_tecnico = 'pendente'` para que o técnico precise aceitar novamente

### 8. Hook useCancelOS
- Ao cancelar: notificar técnico atual do cancelamento

### Arquivos impactados
- `supabase/migrations/` — nova migration (3 colunas em ordens_servico)
- `supabase/functions/gerar-ordem-servico/index.ts` — priorizar data_servico
- `src/pages/MinhasOS.tsx` — botões aceitar/recusar
- `src/pages/WorkOrderDetail.tsx` — badge de aceite, ações de reatribuição
- `src/pages/Tickets.tsx` — exibir status aceite
- `src/hooks/useSchedule.tsx` — resetar aceite no reagendamento
- `src/hooks/useCancelOS.tsx` — notificação de cancelamento
- Novo: `src/components/RecusaOSDialog.tsx` — modal de recusa com motivo
- Novo: `src/hooks/useAceiteOS.tsx` — lógica de aceite/recusa

