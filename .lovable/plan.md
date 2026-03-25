

# Reestruturação de Roles: De 4 para 5 perfis

## Resumo

Substituir o role `area_tecnica` por dois novos roles: `engenharia` e `supervisao`, ambos com o **mesmo nível de acesso**, mas responsabilidades distintas:

- **Engenharia**: análise técnica, RME, relatórios
- **Supervisão**: operação de campo, agenda, distribuição de OS, presença

Ambos podem aprovar tudo (RME, OS, prestadores).

## Roles finais

```text
admin          → Acesso total, configurações, auditoria
engenharia     → Análise técnica, RME, relatórios, aprovações
supervisao     → Gestão campo, agenda, OS, presença, aprovações
tecnico_campo  → Executa OS, preenche RME, confirma presença
cliente        → Abre tickets, acompanha status, painel próprio
```

## Mudanças necessárias

### 1. Migração de banco de dados

- Alterar o enum `app_role`: adicionar `engenharia` e `supervisao`, remover `area_tecnica`
- Migrar registros existentes em `user_roles` de `area_tecnica` para um dos dois novos roles (definir qual será o padrão)
- Atualizar todas as funções SQL que referenciam `area_tecnica` (RLS policies, `has_role`, etc.)
- Atualizar **todas as 30+ RLS policies** que usam `has_role(auth.uid(), 'area_tecnica')` para incluir ambos os novos roles

### 2. RLS Policies — padrão de substituição

Onde hoje existe:
```sql
has_role(auth.uid(), 'area_tecnica'::app_role)
```
Passará a ser:
```sql
(has_role(auth.uid(), 'engenharia'::app_role) OR has_role(auth.uid(), 'supervisao'::app_role))
```

Tabelas afetadas: `tickets`, `ordens_servico`, `profiles`, `clientes`, `equipamentos`, `insumos`, `prestadores`, `tecnicos`, `rme_relatorios`, `rme_checklist_items`, `aprovacoes`, `notificacoes`, `movimentacoes`, `responsaveis`, `geocoding_cache`, `route_optimizations`, `status_historico`, `rme_checklist_catalog`.

### 3. Edge Function `create-user-profile`

Atualizar para aceitar `engenharia` e `supervisao` como roles válidos no cadastro. Remover referência a `area_tecnica`.

### 4. Frontend — Arquivos afetados (~13 arquivos)

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAuth.tsx` | Atualizar tipo `UserProfile.role` com novos valores |
| `src/App.tsx` | Substituir `'area_tecnica'` por `['engenharia', 'supervisao']` em todas as rotas protegidas |
| `src/components/AppSidebar.tsx` | Atualizar lógica `isAdminOrAreaTecnica` para incluir novos roles |
| `src/components/ProtectedRoute.tsx` | Sem mudança estrutural (já usa array de roles) |
| `src/components/TopHeader.tsx` | Atualizar labels de exibição do role |
| `src/pages/Tickets.tsx` | Substituir `area_tecnica` em verificações de permissão |
| `src/pages/MinhasOS.tsx` | Atualizar `isAreaTecnica` |
| `src/pages/WorkOrderDetail.tsx` | Atualizar `canManageOS` |
| `src/pages/GerenciarRME.tsx` | Atualizar verificação de role |
| `src/pages/Auth.tsx` | Atualizar formulário de cadastro com novos roles |
| `src/pages/Prestadores.tsx` | Atualizar verificações de role |
| `src/pages/ClientDashboard.tsx` | Sem mudança (usa `cliente`) |
| `src/pages/WorkOrderCreate.tsx` | Atualizar verificações |

### 5. Formulário de cadastro (`Auth.tsx`)

Atualizar o select de role para oferecer: Administrador, Engenharia, Supervisão, Técnico de Campo, Cliente.

### 6. Helper de permissão (novo)

Criar função utilitária para simplificar verificações recorrentes:
```typescript
const isStaff = (role?: string) => 
  ['admin', 'engenharia', 'supervisao'].includes(role || '');
```

Isso reduz duplicação em todos os componentes.

## Ordem de execução

1. Migração SQL (enum + policies + dados existentes)
2. Atualizar Edge Function `create-user-profile`
3. Atualizar `useAuth.tsx` (tipo)
4. Criar helper `isStaff`
5. Atualizar todos os componentes frontend
6. Atualizar `AppSidebar` e `Auth.tsx`

## Pergunta pendente antes de executar

Usuários que hoje têm `area_tecnica` devem ser migrados para `engenharia` ou `supervisao`? Ou será feito manualmente depois?

