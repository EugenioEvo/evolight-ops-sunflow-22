import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAceiteOS = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const aceitarTicket = async (ticketId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update({ aceite_tecnico: 'aceito' } as any)
        .eq('id', ticketId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Não foi possível atualizar. Verifique suas permissões.');

      // Notify staff
      const { data: staffUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'engenharia', 'supervisao']);

      const { data: ticket } = await supabase
        .from('tickets')
        .select('numero_ticket')
        .eq('id', ticketId)
        .single();

      if (staffUsers && ticket) {
        const notifications = staffUsers.map((u) => ({
          user_id: u.user_id,
          tipo: 'ticket_aceito',
          titulo: 'Ticket Aceito pelo Técnico',
          mensagem: `O técnico aceitou o ticket ${ticket.numero_ticket}. Agora a OS aguarda aceite.`,
          link: `/tickets`,
        }));
        await supabase.from('notificacoes').insert(notifications);
      }

      toast({
        title: 'Ticket aceito!',
        description: 'Agora aceite a Ordem de Serviço vinculada para iniciar a execução.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao aceitar ticket',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const aceitarOS = async (osId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update({
          aceite_tecnico: 'aceito',
          aceite_at: new Date().toISOString(),
        } as any)
        .eq('id', osId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Não foi possível atualizar. Verifique suas permissões.');

      const { data: staffUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'engenharia', 'supervisao']);

      const { data: os } = await supabase
        .from('ordens_servico')
        .select('numero_os')
        .eq('id', osId)
        .single();

      if (staffUsers && os) {
        const notifications = staffUsers.map((u) => ({
          user_id: u.user_id,
          tipo: 'os_aceita',
          titulo: 'OS Aceita pelo Técnico',
          mensagem: `O técnico aceitou a OS ${os.numero_os}.`,
          link: `/work-orders/${osId}`,
        }));
        await supabase.from('notificacoes').insert(notifications);
      }

      toast({
        title: 'OS aceita!',
        description: 'Você aceitou a ordem de serviço. Agora pode iniciar a execução.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao aceitar OS',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const recusarOS = async (osId: string, motivo: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .update({
          aceite_tecnico: 'recusado',
          aceite_at: new Date().toISOString(),
          motivo_recusa: motivo,
        } as any)
        .eq('id', osId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Não foi possível atualizar. Verifique suas permissões.');

      const osData = data[0] as any;
      if (osData?.ticket_id) {
        await supabase
          .from('tickets')
          .update({ status: 'aprovado' as any, aceite_tecnico: 'nao_aplicavel' as any })
          .eq('id', osData.ticket_id);
      }

      const { data: staffUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'engenharia', 'supervisao']);

      const { data: os } = await supabase
        .from('ordens_servico')
        .select('numero_os')
        .eq('id', osId)
        .single();

      if (staffUsers && os) {
        const notifications = staffUsers.map((u) => ({
          user_id: u.user_id,
          tipo: 'os_recusada',
          titulo: 'OS Recusada pelo Técnico',
          mensagem: `O técnico recusou a OS ${os.numero_os}. Motivo: ${motivo}`,
          link: `/work-orders/${osId}`,
        }));
        await supabase.from('notificacoes').insert(notifications);
      }

      toast({
        title: 'OS recusada',
        description: 'Sua recusa foi registrada. A equipe de gestão será notificada.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao recusar OS',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { aceitarTicket, aceitarOS, recusarOS, loading };
};
