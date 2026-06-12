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

  const approve = useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes?: string }) =>
      rdoService.approve(id, observacoes),
    onSuccess: () => {
      toast.success('RDO aprovado. Equipe notificada por e-mail.');
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao aprovar RDO'),
  });

  const reject = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      rdoService.reject(id, motivo),
    onSuccess: () => {
      toast.success('RDO rejeitado. Responsável notificado por e-mail.');
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao rejeitar RDO'),
  });

  const reopen = useMutation({
    mutationFn: (id: string) => rdoService.reopen(id),
    onSuccess: () => {
      toast.success('RDO retornado para rascunho. O responsável pode editar.');
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao reabrir RDO'),
  });

  return { remove, approve, reject, reopen };
}

