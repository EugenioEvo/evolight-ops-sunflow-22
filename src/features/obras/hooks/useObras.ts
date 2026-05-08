import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obrasService } from '../services/obrasService';
import type { Obra, ObraForm } from '../types';
import { toast } from 'sonner';

const KEY = ['obras'] as const;

export function useObrasQuery() {
  return useQuery<Obra[]>({
    queryKey: KEY,
    queryFn: () => obrasService.fetchAll(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useObraMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (payload: ObraForm) => obrasService.create(payload),
    onSuccess: () => { invalidate(); toast.success('Obra criada'); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao criar obra'),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ObraForm }) => obrasService.update(id, payload),
    onSuccess: () => { invalidate(); toast.success('Obra atualizada'); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao atualizar obra'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => obrasService.remove(id),
    onSuccess: () => { invalidate(); toast.success('Obra removida'); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao remover obra'),
  });

  return { create, update, remove };
}
