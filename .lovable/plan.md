# Corrigir recursão infinita nas RLS de RDO

## Diagnóstico

Os 500 vistos pelo Dayn vêm das policies SELECT de `rdo_relatorios` e `rdo_equipe` que se referenciam mutuamente:

- `rdo_relatorios."View RDO if responsible or in equipe"` faz `EXISTS (SELECT … FROM rdo_equipe …)`
- `rdo_equipe."View rdo equipe if envolvido"` faz `EXISTS (SELECT … FROM rdo_relatorios …)`

Cada SELECT dispara a RLS da outra tabela, que dispara a RLS da primeira → **infinite recursion** (confirmado em `postgres_logs`). Mesmas policies aparecem replicadas em `rdo_atividades` e `rdo_equipamentos` (já que ambas filtram via subquery em `rdo_relatorios` + `rdo_equipe`), então o problema se propaga para todas as telas que consultam RDO.

Os erros `removeChild` no console são consequência: a query falha → state inconsistente → React tenta desmontar nós que já saíram da árvore.

## Correção (migração SQL)

Substituir os `EXISTS` cruzados por **funções SECURITY DEFINER** que rodam com privilégios elevados e ignoram RLS (padrão já adotado no projeto com `has_role`, `is_staff`, `user_is_prestador`).

### 1. Novas funções

```sql
create or replace function public.user_in_rdo_equipe(_uid uuid, _rdo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rdo_equipe e
    where e.rdo_id = _rdo_id
      and user_is_prestador(_uid, e.prestador_id)
  )
$$;

create or replace function public.user_is_rdo_responsavel(_uid uuid, _rdo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rdo_relatorios r
    where r.id = _rdo_id
      and user_is_prestador(_uid, r.responsavel_id)
  )
$$;

create or replace function public.rdo_status(_rdo_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select status from rdo_relatorios where id = _rdo_id
$$;
```

### 2. Reescrever policies

- `rdo_relatorios "View RDO if responsible or in equipe"` →
  `is_staff(auth.uid()) OR user_is_prestador(auth.uid(), responsavel_id) OR user_in_rdo_equipe(auth.uid(), id)`

- `rdo_equipe "View rdo equipe if envolvido"` →
  `is_staff(auth.uid()) OR user_is_prestador(auth.uid(), prestador_id) OR user_is_rdo_responsavel(auth.uid(), rdo_id)`

- `rdo_atividades "View rdo atividades if envolvido"` →
  `is_staff(auth.uid()) OR user_is_rdo_responsavel(auth.uid(), rdo_id) OR user_in_rdo_equipe(auth.uid(), rdo_id)`

- `rdo_equipamentos "View rdo equipamentos if envolvido"` → idem.

- Policies de **gerência** ("Sup eletromec manages own RDO atividades/equipamentos") que hoje fazem `EXISTS (SELECT … FROM rdo_relatorios …)` passam a usar `user_is_rdo_responsavel(auth.uid(), rdo_id) AND rdo_status(rdo_id) = ANY(ARRAY['rascunho','rejeitado'])`.

Todas as policies de INSERT/UPDATE/DELETE que já não recursam ficam como estão. Policies de `Staff manage …` permanecem inalteradas.

## Sem mudanças de código frontend

`rdoService.ts` e telas consumidoras continuam idênticos — o fix é 100% banco.

## Verificação

1. Logar como Dayn (`sup_eletromecanico`) e abrir `/rdo/dashboard`, `/rdo`, detalhe de RDO.
2. Conferir em `postgres_logs` que não há mais `infinite recursion`.
3. Conferir que staff continua vendo tudo e cliente continua vendo só `aprovado`.

## Fora de escopo

- Não tocar policies de outras tabelas (tickets, OS, RME).
- Não mudar `user_is_prestador`, `is_staff`, `has_role`.
