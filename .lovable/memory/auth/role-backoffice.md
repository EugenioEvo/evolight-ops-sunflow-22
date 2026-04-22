---
name: Role BackOffice
description: Novo papel de validação de movimentações de insumos, com acesso restrito a Agenda, Cadastros e Relatórios
type: feature
---

A role `backoffice` foi adicionada ao enum `app_role` e segue a mesma forma de atribuição que `admin` e `engenharia`: feita pela aba **Usuários**, sem registro público. A edge function `create-staff-user` aceita `'backoffice'` como role válida.

## Permissões de menu
| Menu                      | backoffice |
|---------------------------|:----------:|
| Agenda (Principal)        |     ✓      |
| Cadastros (todo o grupo)  |     ✓      |
| Insumos / Kits            |     ✓      |
| Validar Insumos           |     ✓      |
| Relatórios (Sistema)      |     ✓      |
| Aprovar RMEs / OS / Tickets / Usuários | — |

## Helpers de banco (SECURITY DEFINER)
- `is_backoffice(uuid)`: true quando o usuário tem a role `backoffice`.
- `is_staff_or_backoffice(uuid)`: usado em RLS de `insumos`, `insumo_saidas`, `insumo_devolucoes` para autorizar leitura/aprovação.

## Notificações
Quando um RME é aprovado e existem saídas de insumo pendentes/não devolvidas vinculadas a ele, todos os usuários com role `backoffice` recebem notificação in-app com link para `/backoffice/insumos`.
