

## Integração contínua com Solarz + Conta Azul + De-Para

Três MySQL remotos viram fonte de verdade do cadastro; SunFlow preserva campos operacionais locais (`prioridade`, observações, vínculos com tickets/equipamentos). Sync manual + cron diário.

### 1. Modelo de dados novo (migrations)

**Princípio:** a tabela `clientes` atual continua sendo o "card unificado" que o resto do sistema referencia (`tickets.cliente_id`, `equipamentos.cliente_id`, RLS, etc.). Adicionamos tabelas satélite para IDs externos e UFVs, e colunas de origem em `clientes`.

Novas colunas em `public.clientes`:
- `solarz_customer_id text unique` — id do cliente no Solarz (chave primária de match quando existe)
- `origem text check (origem in ('solarz','conta_azul'))` — `'solarz'` quando tem Solarz; `'conta_azul'` para clientes sem Solarz (fallback)
- `sync_source_updated_at timestamptz` — última vez que a origem atualizou o registro
- `sem_solarz boolean generated always as (solarz_customer_id is null) stored` — flag para o alerta da UI

Novas tabelas:

```text
public.cliente_conta_azul_ids
  id uuid pk
  cliente_id uuid -> clientes.id on delete cascade
  conta_azul_customer_id text  -- id no banco do Conta Azul
  nome_fiscal text, cnpj_cpf text, email text, observacoes text
  updated_at timestamptz
  unique (conta_azul_customer_id)
  index (cliente_id)

public.cliente_ufvs
  id uuid pk
  cliente_id uuid -> clientes.id on delete cascade  -- sempre cliente com solarz
  solarz_ufv_id text unique
  nome text, endereco text, cidade text, estado text, cep text
  latitude numeric, longitude numeric
  potencia_kwp numeric, status text
  updated_at timestamptz
  index (cliente_id)

public.sync_runs
  id uuid pk, source text, started_at, finished_at
  status text, rows_read int, rows_upserted int, error text
```

Índice único parcial em `clientes.cnpj_cpf` **onde `cnpj_cpf is not null`** para prevenir duplicatas como a de EVOLIGHT.

RLS: staff total, cliente vê suas UFVs/IDs CA via `clientes.profile_id`, técnico via `can_tech_view_cliente`.

### 2. Secrets necessários

A serem adicionados via `add_secret` após aprovação:
- `SOLARZ_MYSQL_HOST`, `SOLARZ_MYSQL_PORT`, `SOLARZ_MYSQL_USER`, `SOLARZ_MYSQL_PASSWORD`, `SOLARZ_MYSQL_DATABASE`
- `CONTA_AZUL_MYSQL_HOST`, `CONTA_AZUL_MYSQL_PORT`, `CONTA_AZUL_MYSQL_USER`, `CONTA_AZUL_MYSQL_PASSWORD`, `CONTA_AZUL_MYSQL_DATABASE`
- `DEPARA_MYSQL_HOST`, `DEPARA_MYSQL_PORT`, `DEPARA_MYSQL_USER`, `DEPARA_MYSQL_PASSWORD`, `DEPARA_MYSQL_DATABASE`

**Antes de escrever a edge function** preciso que você informe os nomes exatos das tabelas/colunas em cada banco (ex: no Solarz, tabela de clientes é `clientes`? E de UFVs é `ufvs`/`usinas`? Quais colunas?). Peço isso na fase de implementação.

### 3. Edge function `sync-clientes-external`

Uma única função Deno usando `npm:mysql2`. Fluxo:

```text
1. Abre 3 conexões MySQL (Solarz, Conta Azul, De-Para)
2. Carrega De-Para em memória (Map: solarz_id -> [conta_azul_ids], conta_azul_id -> solarz_id)
3. Lê todos os clientes do Solarz   -> upsert clientes (origem='solarz', solarz_customer_id)
4. Para cada solarz_customer_id:
     - upsert UFVs (cliente_ufvs)  (delete-then-insert por cliente OU merge por solarz_ufv_id)
     - upsert IDs Conta Azul relacionados (cliente_conta_azul_ids)
5. Lê clientes do Conta Azul NÃO mapeados no De-Para:
     - upsert como clientes órfãos (origem='conta_azul', solarz_customer_id=null)
     - registra cliente_conta_azul_ids
6. Registra sync_runs (status, contagens, erros)
```

**Campos que a sync NÃO sobrescreve** em `clientes`: `prioridade`, `profile_id`, `ufv_solarz` (legado, mantido por compat), `observacoes`. Todos os demais (empresa, cnpj_cpf, endereço) vêm da origem.

**Match / upsert key**:
- Cliente Solarz → `on conflict (solarz_customer_id)`
- Cliente órfão Conta Azul → `on conflict (conta_azul_customer_id)` na tabela `cliente_conta_azul_ids`; cria registro em `clientes` com origem='conta_azul'

Autenticação: JWT staff obrigatório quando chamada manualmente; service role quando chamada pelo cron.

### 4. Cron diário + botão manual

Cron via `pg_cron` (3h da manhã BRT):
```text
select cron.schedule('sync-clientes-daily', '0 6 * * *', $$...net.http_post...$$)
```

Botão **"Sincronizar agora"** em `/clientes`:
- Chama `supabase.functions.invoke('sync-clientes-external')`
- Mostra progresso (`sync_runs` via realtime) e resultado (X criados, Y atualizados, Z erros)
- Visível apenas para staff

### 5. UI unificada do card de cliente

**`/clientes` (lista)** — novo badge:
- Cliente com Solarz: badge verde "Solarz" + id
- Cliente sem Solarz: badge âmbar "Só Conta Azul" (alerta explícito)
- Contador de UFVs e contador de IDs Conta Azul

**Dialog de detalhes do cliente** (novo componente `ClientDetailDialog`) com 3 seções:
1. Identificação (dados da origem, read-only; campos SunFlow editáveis: prioridade, observações)
2. **UFVs vinculadas** (de `cliente_ufvs`): lista com nome, localização, potência; cada UFV com botão "Abrir chamado aqui" (pré-preenche endereço)
3. **IDs Conta Azul relacionados** (de `cliente_conta_azul_ids`): lista com CNPJ/razão social, para referência no faturamento

Se `sem_solarz = true`, exibir alerta no topo: *"Cliente sem cadastro no Solarz — apenas dados financeiros disponíveis."*

### 6. Abertura de chamado (TicketForm)

O dropdown de cliente hoje usa `clientes.id`. Ajustes:
- Ordenar/priorizar clientes com `origem='solarz'` no topo
- Label no dropdown: `{empresa}` + badge se "Só CA"
- Quando uma UFV é selecionada (campo `ufv_solarz` atual), priorizar match via nova tabela `cliente_ufvs.solarz_ufv_id` (mais robusto que o campo texto atual); fallback para comportamento legado

### 7. Ordem de execução

1. Migration: novas tabelas, colunas, índice parcial CNPJ
2. Secrets dos 3 MySQL
3. Confirmar esquemas dos bancos de origem (tabelas/colunas reais) — uma rodada curta de perguntas
4. Edge function `sync-clientes-external` + deploy
5. Botão manual + tela de histórico de sync em `/clientes`
6. Cron diário (`pg_cron` + `pg_net`)
7. `ClientDetailDialog` com UFVs e IDs CA
8. Ajustes no TicketForm para usar `cliente_ufvs`

### Detalhes técnicos / trade-offs

- **MySQL direto em edge function**: usarei `npm:mysql2` (Deno suporta via `npm:` specifier). Alternativa seria criar um proxy Node, mas é overkill. Caveat: latência e estabilidade dependem da qualidade da rede do MySQL remoto; por isso o sync é idempotente e registra em `sync_runs`.
- **Soft-delete vs hard-delete**: se um cliente some da origem, marcamos `ativo=false` em vez de deletar, para não quebrar FKs com tickets/OS/RME.
- **Performance inicial**: primeira sync pode ser grande; edge function tem limite de ~150s. Se passar, paginaremos por cursor (LIMIT/OFFSET ou `updated_at > last_sync`). Recomendo adicionar colunas `last_sync_cursor` em `sync_runs` já nessa primeira fase.
- **Conflito EVOLIGHT existente**: o índice único parcial em `cnpj_cpf` vai falhar no primeiro deploy se houver duplicata. Mitigação: dedup manual prévio (já recomendado anteriormente) OU criar o índice **após** a primeira sync limpar o estado.

### Perguntas que ficam para a fase de implementação (não bloqueiam a aprovação do plano)

- Nomes exatos das tabelas/colunas nos 3 MySQL
- Se "classificação como cliente" no Conta Azul é por uma coluna tipo `tipo_cadastro = 'cliente'` (precisaremos dessa regra exata no WHERE)
- Se o Solarz tem `updated_at` por registro (para sync incremental) ou se sempre será full load

