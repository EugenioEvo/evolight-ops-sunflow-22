import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ObraShareToken {
  id: string;
  obra_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
  created_by: string | null;
}

export function useObraActiveShareToken(obraId: string | null | undefined) {
  return useQuery({
    queryKey: ['obra-share-token', obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraShareToken | null> => {
      const { data, error } = await supabase
        .from('obra_share_tokens')
        .select('*')
        .eq('obra_id', obraId!)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ObraShareToken | null;
    },
    staleTime: 30_000,
  });
}

export function useObraShareMutations(obraId: string) {
  const qc = useQueryClient();

  const generate = useMutation({
    mutationFn: async () => {
      // Revoga qualquer link ativo anterior antes de criar um novo (unique index parcial).
      await supabase
        .from('obra_share_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('obra_id', obraId)
        .is('revoked_at', null);

      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('obra_share_tokens')
        .insert({ obra_id: obraId, created_by: user.user?.id ?? null })
        .select('*')
        .single();
      if (error) throw error;
      return data as ObraShareToken;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obra-share-token', obraId] }),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('obra_share_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('obra_id', obraId)
        .is('revoked_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obra-share-token', obraId] }),
  });

  return { generate, revoke };
}

export function buildObraPublicUrl(token: string): string {
  return `${window.location.origin}/p/obra/${token}`;
}
