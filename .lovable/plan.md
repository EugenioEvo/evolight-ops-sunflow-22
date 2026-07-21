
# Módulo HSE/EHS

Entrega em 3 fases pequenas, cada uma testável isoladamente. Após cada fase valido antes de seguir.

---

## Fase 1 — Certificações vivas (Usuários + Prestadores)

### O que muda para o usuário
- No cadastro de **Usuário** e de **Prestador** aparece a seção "Certificações HSE" com botão **+ Nova certificação**.
- Cada certificação: **Tipo** (do catálogo global), **Data de vencimento**, **Observações**, **Anexos ilimitados** (foto/vídeo/qualquer arquivo, galeria ou câmera).
- Admin ganha `/hse/catalogo-certificacoes` (menu "Sistema") — CRUD do catálogo global.
- Badge de status na lista de usuários/prestadores: verde (>30d), amarelo (≤30d), vermelho (vencida).

### Backend
Migração criando:
- `hse_certificacao_tipos` — catálogo global (`nome`, `descricao`, `obrigatoria`, `ativo`).
- `hse_certificacoes` — `tipo_id`, `profile_id` **ou** `prestador_id` (CHECK exatamente-um), `data_vencimento`, `observacoes`, `created_by`, `origem` (`manual` | `migrado_legado`).
- `hse_certificacao_anexos` — `certificacao_id`, `storage_path`, `nome_original`, `mime_type`, `tamanho_bytes`.
- Bucket privado `hse-certificacoes` (sem restrição de MIME) + RLS em `storage.objects`.

RLS:
- Catálogo: leitura para autenticados, escrita só admin.
- Certificações/anexos: leitura para staff/backoffice + próprio dono; escrita para staff/backoffice.

### Migração dos dados legados (novo)
Hoje `prestadores.certificacoes text[]` guarda checkboxes ("NR-10", "NR-35", "CAT", etc.). Vou:
1. **Seed do catálogo** com os valores distintos hoje existentes em `prestadores.certificacoes` (unificados com o array `certificacoesOptions` do frontend), todos ativos.
2. **Backfill**: para cada string no `certificacoes[]` de cada prestador, criar 1 registro em `hse_certificacoes` com `prestador_id` do dono, `tipo_id` = match no catálogo (case-insensitive, trim), `data_vencimento = NULL`, `origem = 'migrado_legado'`, `observacoes = 'Migrado do cadastro legado — preencher vencimento e anexar comprovante'`.
3. **UI marca** essas certificações com badge cinza "Pendente de complemento" enquanto `data_vencimento IS NULL`. Usuário ou admin abre e completa vencimento + anexos.
4. **Coluna legado preservada** por enquanto (`prestadores.certificacoes`) só como fallback histórico; a UI passa a ler do novo modelo. Remoção fica para tech debt separado depois de validado.
5. Alertas da Fase 2 **ignoram** registros com `data_vencimento IS NULL` (não spamma o admin com legado incompleto).

### Frontend
- Componente `HSECertificationsPanel({ profileId?, prestadorId? })` reutilizado em `/usuarios` e no dialog de edição de `/prestadores`.
- Upload multi-arquivo no padrão RDO/RME (`accept="*/*"` + input com `capture="environment"`).
- Nova página do catálogo de tipos, estilo `ObraCatalogo`.
- Onde havia o multiselect antigo de `certificacoes` no form de prestador, substituo pelo novo painel.

### Validação da Fase 1
(a) rodar migração e conferir contagem de `hse_certificacoes` = soma de itens em `prestadores.certificacoes`; (b) abrir um prestador migrado, ver badge "Pendente" e completar vencimento + anexo; (c) criar tipo novo no catálogo; (d) anexar foto+vídeo+PDF; (e) RLS bloqueando outro perfil.

---

## Fase 2 — Alertas de vencimento (in-app + e-mail)

- Notificações in-app + e-mail (Resend) nas janelas **30/7/0 dias** para o dono e para admin/engenharia.
- Tabela `hse_certificacao_alertas(certificacao_id, janela_dias, enviado_em)` para dedupe.
- Edge function `hse-check-certificacoes` + cron diário 08:00 BRT via `supabase--insert`.
- Ignora registros com `data_vencimento IS NULL` (legado incompleto).

### Validação
Inserir vencimentos em 30/7/0 dias, disparar manual, confirmar notificação + e-mail sem duplicar em reexecuções.

---

## Fase 3 — Afastamentos (só admin/engenharia)

- Novo item **HSE › Afastamentos**.
- Formulário:
  - **Pessoa**: combobox unificando `profiles` + `prestadores`, com opção "Nome customizado".
  - **Vínculo**: Contratado / Subcontratado.
  - **Local**: combobox de `obras` (opcional texto livre).
  - **Data do acidente**, **Descrição**, **Data do afastamento**, **Dias afastado**, **Data de retorno** (auto = afastamento + dias, editável).
- Cards de totalizadores: acidentes no período, dias perdidos, top obras. Filtros por mês/ano/obra/vínculo.
- Tabela `hse_afastamentos` com CHECK exatamente-um em pessoa e em local; RLS via `has_role('admin'|'engenharia')`.

### Validação
Cadastrar 3 afastamentos (interno, prestador, custom), conferir totalizadores/filtros e bloqueio para outros roles.

---

## Fora do escopo
- Bloqueio de escala por certificação vencida (coluna `obrigatoria` fica preparada).
- Integração RDO ↔ afastamento.
- TF/TG e dashboard HSE avançado.
- Drop da coluna `prestadores.certificacoes` legada — só após ciclo de validação.

---

## Ordem de execução
Começo pela **Fase 1** (migração + seed do catálogo + backfill legado + UI). Te chamo para validar antes de mexer no cron da Fase 2. Aprova?
