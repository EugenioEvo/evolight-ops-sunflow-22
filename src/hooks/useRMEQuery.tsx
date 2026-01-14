import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 15;

interface RMEQueryParams {
  page?: number;
  searchTerm?: string;
  status?: string;
}

export const useRMEQuery = (params: RMEQueryParams = {}) => {
  const { page = 1, searchTerm = '', status = 'pendente' } = params;

  return useQuery({
    queryKey: ['rmes', { page, searchTerm, status }],
    queryFn: async () => {
      let query = supabase
        .from('rme_relatorios')
        .select(`
          *,
          tickets!inner(
            titulo,
            numero_ticket,
            clientes!inner(empresa, prioridade)
          ),
          tecnicos!inner(
            profiles!inner(nome)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Filtro de status
      if (status !== 'all') {
        query = query.eq('status_aprovacao', status);
      }

      // Busca
      if (searchTerm) {
        query = query.or(`
          tickets.titulo.ilike.%${searchTerm}%,
          tickets.numero_ticket.ilike.%${searchTerm}%
        `);
      }

      // Paginação
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        rmes: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
      };
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useApproveRMEMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ rmeId, observacoes }: { rmeId: string; observacoes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'aprovado',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: observacoes,
        })
        .eq('id', rmeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rmes'] });
      toast({
        title: 'RME Aprovado',
        description: 'O relatório foi aprovado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useRejectRMEMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ rmeId, motivo }: { rmeId: string; motivo: string }) => {
      if (!motivo) throw new Error('Motivo da rejeição é obrigatório');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'rejeitado',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: motivo,
        })
        .eq('id', rmeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rmes'] });
      toast({
        title: 'RME Rejeitado',
        description: 'O relatório foi rejeitado. O técnico será notificado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook para estatísticas (com cache mais longo)
export const useRMEStatsQuery = () => {
  return useQuery({
    queryKey: ['rme-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rme_relatorios')
        .select('status_aprovacao');

      if (error) throw error;

      const stats = {
        pendente: data?.filter(r => r.status_aprovacao === 'pendente').length || 0,
        aprovado: data?.filter(r => r.status_aprovacao === 'aprovado').length || 0,
        rejeitado: data?.filter(r => r.status_aprovacao === 'rejeitado').length || 0,
        total: data?.length || 0,
      };

      return stats;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};
