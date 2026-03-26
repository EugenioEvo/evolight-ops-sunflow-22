

# Corrigir visibilidade da aba "Ordens de Serviço" para staff

## Causa raiz

Em `useAuth.tsx`, `setLoading(false)` é chamado **antes** de `fetchProfile` terminar (pois `fetchProfile` é async mas não é aguardado). Isso causa:

1. `loading = false` com `profile = null`
2. `ProtectedRoute` renderiza o layout antes do perfil carregar
3. `AppSidebar` calcula `isAdminOrAreaTecnica = false` (profile é null)
4. A página `WorkOrders` calcula `canManageOS = false`
5. Quando o profile finalmente carrega, o state atualiza — mas em conexões lentas ou com muitas retentativas, a UI pode ficar dessincronizada

## Correção

### 1. `src/hooks/useAuth.tsx` — Aguardar `fetchProfile` antes de liberar loading

Alterar para que `setLoading(false)` só seja chamado **depois** que `fetchProfile` terminar:

```typescript
// onAuthStateChange
if (session?.user) {
  await fetchProfile(session.user.id);
}
setLoading(false);

// getSession
if (session?.user) {
  await fetchProfile(session.user.id);
}
setLoading(false);
```

O `onAuthStateChange` precisa de cuidado especial pois o callback não pode ser async diretamente — usar `.then()` encadeado.

### 2. `src/components/ProtectedRoute.tsx` — Aguardar profile para roles

Quando `profile` ainda é `null` mas `user` existe e `loading` é `false`, mostrar loading em vez de redirecionar:

```typescript
if (!profile && user) {
  // Profile ainda carregando
  return <LoadingSpinner />;
}
```

## Arquivos impactados
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`

