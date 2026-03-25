import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useCancelOS = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const cancelOS = async (osId: string, motivo?: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Buscar dados da OS incluindo técnico e status do ticket
      const { data: os, error: fetchError } = await supabase
        .from('ordens_servico')
        .select(`
          id, numero_os, data_programada, calendar_invite_sent_at, tecnico_id,
          tickets:ticket_id(id, status, titulo),
          tecnicos:tecnico_id(
            id,
            profile:profiles(user_id, nome)
          )
        `)
        .eq('id', osId)
        .single();

      if (fetchError || !os) {
        throw new Error('OS não encontrada');
      }

      // Bloquear se ticket está em execução
      if ((os.tickets as any)?.status === 'em_execucao') {
        toast({
          title: 'Cancelamento bloqueado',
          description: `A OS ${os.numero_os} está em execução pelo técnico. Não é possível cancelá-la enquanto estiver em andamento.`,
          variant: 'destructive',
        });
        return false;
      }

      // Atualizar ticket para cancelado
      const ticketId = (os.tickets as any)?.id;
      if (ticketId) {
        await supabase
          .from('tickets')
          .update({ status: 'cancelado' })
          .eq('id', ticketId);
      }

      // Notificar técnico (in-app)
      const tecnicoUserId = (os.tecnicos as any)?.profile?.user_id;
      if (tecnicoUserId) {
        await supabase.from('notificacoes').insert({
          user_id: tecnicoUserId,
          tipo: 'os_cancelada',
          titulo: 'Ordem de Serviço Cancelada',
          mensagem: `A OS ${os.numero_os}${(os.tickets as any)?.titulo ? ` (${(os.tickets as any).titulo})` : ''} foi cancelada.${motivo ? ` Motivo: ${motivo}` : ''}`,
          link: '/minhas-os',
        });
      }

      // Enviar email de cancelamento ao técnico
      if (os.calendar_invite_sent_at && os.data_programada) {
        try {
          await supabase.functions.invoke('send-calendar-invite', {
            body: {
              os_id: osId,
              action: 'cancel'
            }
          });
        } catch (emailError) {
          console.error('Erro ao enviar cancelamento:', emailError);
        }
      }

      // Limpar dados de agendamento da OS
      const { error: updateError } = await supabase
        .from('ordens_servico')
        .update({
          data_programada: null,
          hora_inicio: null,
          hora_fim: null,
          duracao_estimada_min: null
        })
        .eq('id', osId);

      if (updateError) throw updateError;

      toast({
        title: 'OS cancelada',
        description: `OS ${os.numero_os} foi cancelada. O técnico foi notificado.`
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao cancelar OS:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { cancelOS, loading };
};
