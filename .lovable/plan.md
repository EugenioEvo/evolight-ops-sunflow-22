# Plano de implementação

## Parte A — RDO: wizard de 3 steps + evidências audiovisuais

### A1. Refatorar `RDOWizard.tsx` em 3 steps (padrão RME)
Criar `src/components/rdo-wizard/`:
- `StepIdentificacao.tsx` — Obra, data, turno, horários, clima/temperatura (auto Open-Meteo, readonly), condições do canteiro, horas paradas (programadas/não programadas).
- `StepExecucao.tsx` — Equipe (linhas com prestador + horas), atividades (catálogo/livre, com quantidade; % avanço continua greyed-out e calculado pela obra), equipamentos, ocorrências/atrasos/restrições.
- `StepRevisao.tsx` — Evidências audiovisuais, observações gerais, assinatura do responsável + nome do usuário logado, resumo read-only dos steps anteriores, botão "Enviar para aprovação".

Header com stepper (3 bolinhas) + footer fixo mobile (`Voltar` / `Salvar rascunho` / `Próximo`/`Enviar`). Auto-save por step usando `rdoService.upsertDraft` (ou equivalente). Validação por step com Zod parcial.

### A2. Helper text em cada campo de texto
Adicionar `description` curta abaixo do label em todos os inputs/textareas (ex.: "Descreva resumidamente o estado do tempo no canteiro"). Padrão: `<p className="text-xs text-muted-foreground">…</p>` logo após o `FormLabel`.

### A3. Evidências Audiovisuais (renomear + vídeos)
- Renomear "Evidências Fotográficas" → "Evidências Audiovisuais" (UI + label).
- `accept="image/*,video/*"`, `multiple`, suporte câmera (`capture="environment"`), galeria, upload arrastado, e gravação de vídeo (`capture` em input dedicado).
- Salvar `tipo` em `rdo_evidencias` como `foto` ou `video` (já existe coluna `tipo`).
- Preview: thumbnail para imagens, `<video controls>` para vídeos.
- Bucket `rdo-evidences` aceitar `video/*` (verificar policies de storage; aumentar limite se necessário).

## Parte B — Obras (Nova/Editar Obra)

### B1. Cliente como busca de texto (combobox)
Substituir `<Select>` por `Command` (shadcn Combobox) com busca por `empresa`, `cnpj_cpf`, `cidade`. Permite limpar para "obra própria".

### B2. Lat/Lng com geocoding automático + edição manual
- Adicionar inputs `latitude` / `longitude` (numéricos, opcionais) na obra.
- Botão "Buscar coordenadas" e auto-trigger (debounce) quando endereço+cidade+uf estiverem preenchidos, chamando edge function `geocode-address` (já existe — usa Google Maps).
- Campos editáveis manualmente; mostrar mini-mapa Leaflet opcional ou só os números com link para Google Maps.
- Persistir em `obras.latitude` / `obras.longitude` (colunas já existem).

### B3. RDO usa lat/lng da obra para clima
Em `StepIdentificacao` do RDO, ao carregar a obra:
- Se `obra.latitude && obra.longitude` → usar diretamente no Open-Meteo.
- Senão → fallback para geocode do endereço (comportamento atual) ou desabilitar com mensagem "Cadastre coordenadas na obra".

### B4. Tab "Metas do Catálogo" no modal de obra
Converter `ObraFormDialog` em **Tabs** (`Dados`, `Metas`):
- Tab **Metas**: lista `rdo_atividades_catalogo` agrupado por `categoria`. Para cada item: input de quantidade meta + unidade (readonly do catálogo).
- Persistir em nova tabela `obra_metas_catalogo (obra_id, catalogo_id, quantidade_meta, unidade, observacoes)` com upsert.
- Migration cria a tabela + RLS (staff manage; cliente/sup view).

### B5. Página de status da obra (`ObraDetail`) — avanço por etapa
Nova seção "Avanço por etapa":
- Para cada item em `obra_metas_catalogo` da obra: somar `quantidade` em `rdo_atividades` (agrupado por `catalogo_id`) onde `rdo_id` ∈ RDOs **aprovados** dessa obra.
- Mostrar barra de progresso: `(realizado / meta) * 100%`, badge com `realizado / meta unidade`.
- Visualização também usada para preencher o `percentual_avanco` calculado (continua greyed-out no wizard).

### B6. Helper text também em ObraFormDialog
Pequenas descrições abaixo de cada label (ex.: "CEP no formato 00000-000", "Potência total instalada da usina em kWp").

## Detalhes técnicos

### Migration nova
```sql
CREATE TABLE public.obra_metas_catalogo (
  id uuid PK default gen_random_uuid(),
  obra_id uuid NOT NULL,
  catalogo_id uuid NOT NULL,
  quantidade_meta numeric NOT NULL DEFAULT 0,
  unidade text,
  observacoes text,
  created_at, updated_at timestamptz default now(),
  UNIQUE(obra_id, catalogo_id)
);
ALTER TABLE ... ENABLE RLS;
-- Staff manage; cliente do obra view; sup_eletromecanico view
```

### Storage
Garantir bucket `rdo-evidences` com mime aceitos `image/*,video/*` e limite ~50MB (revisar policy existente).

### Componentes novos
```
src/components/rdo-wizard/
  StepIdentificacao.tsx
  StepExecucao.tsx
  StepRevisao.tsx
  index.ts
src/features/obras/
  hooks/useObraMetas.ts
  services/obraMetasService.ts
  components/ObraMetasTab.tsx
  components/ObraProgressoEtapas.tsx
  components/ClienteCombobox.tsx
  components/CoordsField.tsx
```

### Arquivos editados
- `src/pages/RDOWizard.tsx` — vira shell com stepper + render do step ativo
- `src/features/obras/components/ObraFormDialog.tsx` — Tabs + combobox + coords
- `src/features/obras/types.ts` — adiciona `latitude`/`longitude` no schema
- `src/features/obras/services/obrasService.ts` — normalize lat/lng
- `src/pages/ObraDetail.tsx` — bloco "Avanço por etapa"

### Fora de escopo
- Não mudaremos o schema de `rdo_relatorios` nem `rdo_atividades`.
- `percentual_avanco` continua calculado client-side a partir das metas (não persistido no item por enquanto).

Posso seguir com essa estrutura?
