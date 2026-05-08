import { useQuery } from '@tanstack/react-query';
import { obraMetasService } from '../services/obraMetasService';

export function useObraMetasQuery(obraId: string | null | undefined) {
  return useQuery({
    queryKey: ['obra-metas', obraId],
    enabled: !!obraId,
    queryFn: () => obraMetasService.listByObra(obraId!),
    staleTime: 60_000,
  });
}

export function useObraProgressoQuery(obraId: string | null | undefined) {
  return useQuery({
    queryKey: ['obra-progresso', obraId],
    enabled: !!obraId,
    queryFn: () => obraMetasService.progressoObra(obraId!),
    staleTime: 30_000,
  });
}
