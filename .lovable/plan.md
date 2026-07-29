## Objetivo

Transformar o item "Certificações HSE" (grupo Cadastros) em um menu expansível com dois submenus:

1. **Catálogo** — a página atual de tipos mestres de certificação.
2. **Certificações Cadastradas** — nova página listando todas as certificações de todos os usuários/prestadores.

## Menu

Em `src/components/AppSidebar.tsx`, o item "Certificações HSE" passa a ser um item colapsável (usando `Collapsible` + `SidebarMenuSub`, padrão shadcn já disponível), expandindo ao clicar e ficando aberto automaticamente quando a rota atual for `/hse/*` de certificações:

```text
Cadastros
  └ Certificações HSE  ▾
      ├ Catálogo                  → /hse/catalogo-certificacoes
      └ Certificações Cadastradas → /hse/certificacoes
```

Mesma permissão do item atual (`admin`). No modo colapsado (ícone), o item continua navegando para o catálogo.

## Nova página `/hse/certificacoes`

Arquivo novo `src/pages/HseCertificacoes.tsx`, rota registrada em `src/App.tsx` protegida para `admin`.

Consulta única em `hse_certificacoes` com joins para o tipo, o perfil/prestador e os anexos (as políticas de acesso já permitem que staff leia todas as certificações e seus anexos).

Tabela com colunas:

| Coluna | Conteúdo |
|---|---|
| Pessoa | nome do usuário (`profiles`) ou do prestador (`prestadores`) |
| Certificação | nome do tipo, com selo "Obrigatória" quando aplicável |
| Observação | texto do campo observações |
| Anexo | link(s) para abrir o arquivo em nova aba (URL assinada gerada no clique, como já é feito no painel de certificações) |
| Validade | data formatada dd/MM/yyyy, ou "Sem validade" |
| Dias até expirar | número de dias, com badge: vermelho = vencida, âmbar ≤ 30 dias, verde acima disso, neutro quando não há data |

Recursos de apoio:
- Busca por nome da pessoa ou da certificação.
- Filtro por situação: Todas / Vencidas / Vencendo em 30 dias / Válidas / Sem validade.
- Ordenação padrão pelo vencimento mais próximo primeiro.
- Cartões-resumo no topo com contagem de vencidas, vencendo em 30 dias e válidas.
- Layout responsivo: tabela no desktop, cartões empilhados no mobile.

## Detalhes técnicos

- Arquivos alterados: `src/components/AppSidebar.tsx`, `src/App.tsx`; novo: `src/pages/HseCertificacoes.tsx`.
- Sem mudanças de banco de dados nem de políticas de acesso — o modelo atual já cobre a leitura necessária.
- Cálculo de dias por diferença de datas em dias corridos (`differenceInCalendarDays` do date-fns, já usado no projeto), evitando deslocamento de fuso ao interpretar a data de vencimento.
- Reuso dos componentes de UI existentes (Card, Table, Badge, Input, Select) e tokens de tema; nenhuma cor fixa.
