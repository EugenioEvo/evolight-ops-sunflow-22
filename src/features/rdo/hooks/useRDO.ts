import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rdoService } from '../services/rdoService';
import { toast } from 'sonner';

const KEY = ['rdo-relatorios'] as const;

export function useRDOQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => rdoService.fetchAll(),
    staleTime: 60_000,
  });
}

export function useRDOMutations() {
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => rdoService.remove(id),
    onSuccess: () => {
      toast.success('RDO removido');
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover RDO'),
  });

  return { remove };
}
