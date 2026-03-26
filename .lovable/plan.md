
# Corrigir: RLS bloqueando aceite/recusa do técnico

## Problema raiz
A recusa/aceite do técnico falha silenciosamente porque a tabela `ordens_servico` só tem policy de update para `is_staff()`. Técnicos não conseguem atualizar nenhum campo, incluindo `aceite_tecnico`, `aceite_at` e `motivo_recusa`.

O toast "OS recusada" aparece porque o `useAceiteOS` não verifica se rows foram realmente afetadas — o Supabase retorna sucesso com 0 rows atualizadas quando RLS bloqueia.

## Solução

### 1. Database Migration — RLS policy para técnicos
Criar policy permitindo técnicos atualizarem apenas suas próprias OS:

```sql
CREATE POLICY "Technicians can update aceite on their own OS"
ON public.ordens_servico
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id
    AND p.user_id = auth.uid()
  )
);
```

### 2. Corrigir `useAceiteOS` — verificar rows afetadas
Após o `.update()`, verificar se `data` retornou rows (ou usar `.select()` encadeado) para detectar quando RLS bloqueou silenciosamente.

## Arquivos impactados
- Nova migration SQL (via ferramenta)
- `src/hooks/useAceiteOS.tsx` — verificação de sucesso real
