## Diagnóstico raiz (causa única para os 3 sintomas)

`tickets.tecnico_responsavel_id` e `ordens_servico.tecnico_responsavel_id` armazenam **`prestadores.id`** (decisão arquitetural intencional, vide `useTechnicianScore`, `buildOSPDFData`, joins `prestadores:tecnico_responsavel_id`).

Porém a função `get_ticket_rme_group_context` (e o trecho que resolve o e-mail do responsável) faz `LEFT JOIN tecnicos t ON t.id = rt.resp_tec_id` — comparando `tecnicos.id` com `prestadores.id`. Resultado: o JOIN nunca casa, `responsavel_email` vira NULL, e a comparação `responsavelEmail === profile.email` no `RMEWizard` falha. Isso explica:

- **OS59 (Diego)**: não consegue fechar RME — embora seja responsável real
- **TK033 / OS50 (Hercules) [item anterior]**: mesmo bug
- Qualquer técnico responsável é bloqueado no `handleFinalize`

Isso **NÃO é dado órfão** — os 3 IDs "fantasmas" (`777d1943` Diego, `c67f5c32` Hercules, `7de4c21a` Weberson) existem em `prestadores`. Não há corrupção de dados.

---

## Plano de execução

### 1. Fix raiz do RPC (resolve OS59 e qualquer caso futuro)
Migration alterando `get_ticket_rme_group_context`: o JOIN para resolver `responsavel_email` passa por `prestadores` → `tecnicos.prestador_id` → `profiles`. Mantém compatibilidade com `tecnico_responsavel_id` que (por design) guarda `prestadores.id`.

### 2. Caso OS65 / TK042 (Hercules)
Adicionar Hercules como OS-irmã do TK042 mantendo Adrian. Hercules vira responsável (o ticket também). Disparar e-mail/calendar para Hercules via `gerar-ordem-servico`.

### 3. Caso RME OS53 (Weberson ausente)
Confirmado: TK036 só tem 1 OS (Diego). Weberson nunca foi escalado nessa OS — não tem sibling. Se a intenção é registrar que ele participou em campo, posso adicioná-lo ao array `collaboration` do RME existente (715905ee). **Pergunta implícita já respondida com "sim, pode seguir"** → adiciono.

### 4. Cascata ao trocar técnico (frontend)
Em `MultiTechnicianOSDialog` e `useTicketMutations`: ao alterar Técnico Responsável ou adicionar/remover técnico do ticket, sincronizar:
- `tickets.tecnico_responsavel_id`
- `ordens_servico.tecnico_responsavel_id` em todas as OSs do ticket
- `rme_relatorios.tecnico_id` somente para RMEs **ainda não aprovados** (status `rascunho`/`pendente`/`rejeitado`)

Isso já é parcialmente feito hoje (linhas 280-288 do dialog) — vou consolidar e estender ao acréscimo/retirada.

### 5. RME Wizard — Colaboradores Presentes inteligente
- **Catálogo expandido**: trazer todos os técnicos do ticket com OS em `pendente`, `aceito` ou `aprovado` (hoje só `aceito`/`aprovado`). Editar `get_ticket_rme_group_context` para incluir pendentes, retornando também o status atual.
- **Refresh ao entrar na etapa 1**: já existe via realtime; garantir refresh extra no `handleStepChange` para `currentStep === 1`.
- **Reconciliação ao concluir RME**: em `handleFinalize`, antes de salvar:
  - Para cada técnico marcado em `collaboration` cuja OS está `pendente` → forçar `aceite_tecnico='aceito'` + `aceite_at=now()` (e disparar mesma cadeia de notificações do aceite manual).
  - Para cada técnico **não marcado** com OS `pendente` ou `aceito`/`aprovado` (exceto o próprio responsável) → forçar `aceite_tecnico='recusado'` com motivo "Técnico ausente conforme RME do responsável" + disparar notificação de recusa.

### 6. Atualizar memória
Documentar a decisão "tecnico_responsavel_id armazena prestadores.id" e o novo fluxo de reconciliação RME para evitar regressões.

---

## Arquivos a tocar

```
supabase/migrations/<new>.sql             (fix RPC + incluir pendentes)
src/pages/RMEWizard.tsx                   (handleFinalize reconciliação + refresh step 1)
src/components/rme-wizard/StepIdentification.tsx  (mostrar status na opção)
src/components/MultiTechnicianOSDialog.tsx (cascata RME não-aprovado)
src/features/tickets/hooks/useTicketMutations.ts (cascata simples de troca)
.lovable/memory/os-rme/responsavel-id-prestador.md (NOVO)
.lovable/memory/os-rme/wizard-reconciliacao-equipe.md (NOVO)
```

---

## Operações de dados (via insert tool)

1. OS65: criar OS adicional para Hercules no TK042 (preferível usar edge function `gerar-ordem-servico` para enviar e-mail/calendar — vou invocá-la pelo backend após confirmar payload).
2. RME OS53: adicionar "Weberson da Silva Ferreira" ao array `collaboration`.

Sem riscos colaterais: nenhum dado existente é apagado.
