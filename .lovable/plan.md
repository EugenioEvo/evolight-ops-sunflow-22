# Por que Dayn e Adailton não aparecem

Diagnóstico no banco:

- Ambos têm `prestadores` + `tecnicos` + role `tecnico_campo` corretamente criados (provisionamento OK).
- Dayn: `prestadores.categoria = 'supervisao'`
- Adailton: `prestadores.categoria = 'eletromecanico'`

O modal "Gerar Ordem de Serviço" recebe a lista via `ticketService.loadPrestadores()`, que faz:

```ts
db.from('prestadores').select('*').eq('categoria', 'tecnico').eq('ativo', true)
```

Esse filtro `categoria = 'tecnico'` exclui qualquer prestador cujo cargo principal seja supervisão, liderança ou eletromecânico — exatamente o caso de Dayn e Adailton. Hércules aparece porque seu prestador tem `categoria = 'tecnico'`.

# Correção

Trocar o filtro por categoria por um filtro baseado em "tem `tecnicos` ativo" — que é a fonte de verdade da escalabilidade (consistente com a memória `staff-tecnico-provisioning` e com o `provision-staff-as-tecnico`).

## Mudança

**`src/features/tickets/services/ticketService.ts` → `loadPrestadores`**

Substituir a query por uma que retorne apenas prestadores que possuem registro em `tecnicos` (inner join), mantendo `ativo = true`:

```ts
const { data } = await db
  .from('prestadores')
  .select('*, tecnicos!inner(id)')
  .eq('ativo', true);
```

E mapear ignorando o campo `tecnicos` no retorno (apenas usado como filtro). Mantém a forma `TicketPrestador[]` atual.

Resultado: Dayn (supervisao), Adailton (eletromecanico) e qualquer outro supervisor/líder provisionado passam a aparecer junto de Hércules, Weberson, Adrian e Diego — sem inflar a lista com prestadores que não estão escaláveis.

## Detalhes técnicos

- Não toca em RLS nem em edge functions.
- Não altera `prestadores.categoria` (preserva o cargo real para outros usos como RDO/relatórios).
- O ScheduleModal e outros consumidores que usam essa mesma lista herdam a correção automaticamente.
- `useTechnicianScoreEngine(prestadores)` continua funcionando — só passa a pontuar também supervisores/líderes escaláveis.

## Fora de escopo

- Não mexer no provisionamento (já está correto).
- Não consolidar `prestadores`/`tecnicos` (TODO já registrado em memória).
