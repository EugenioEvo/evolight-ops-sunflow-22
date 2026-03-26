import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAceiteOS = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

      // Notificar gestores
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
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          aceite_tecnico: 'recusado',
          aceite_at: new Date().toISOString(),
          motivo_recusa: motivo,
        } as any)
        .eq('id', osId);

      if (error) throw error;

      // Notificar gestores
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

  return { aceitarOS, recusarOS, loading };
};
