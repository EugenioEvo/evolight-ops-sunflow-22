import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { notifyRMEDecision, notifyRMESubmitted } from '@/shared/services/notificationStrategies';

export const useRMEApprovals = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const approveRME = async (rmeId: string, observacoes?: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status: 'concluido',
          status_aprovacao: 'aprovado',
          aprovado_por: userData.user?.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: observacoes || null,
        })
        .eq('id', rmeId);

      if (error) throw error;

      // Fire-and-forget: notify everyone involved (#12)
      notifyRMEDecision(rmeId, 'aprovado', observacoes).catch((e) =>
        console.warn('notifyRMEDecision approved failed:', e)
      );

      toast({
        title: 'RME Aprovado',
        description: 'O relatório foi aprovado. Técnicos envolvidos foram notificados.',
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao aprovar RME:', error);
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rejectRME = async (rmeId: string, motivo: string) => {
    if (!motivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da rejeição',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Reject + revert to draft so technician can edit and resubmit (#13)
      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'pendente',
          status: 'rascunho',
          aprovado_por: userData.user?.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: motivo,
        })
        .eq('id', rmeId);

      if (error) throw error;

      // Fire-and-forget: notify everyone involved (#13)
      notifyRMEDecision(rmeId, 'rejeitado', motivo).catch((e) =>
        console.warn('notifyRMEDecision rejected failed:', e)
      );

      toast({
        title: 'RME Rejeitado',
        description: 'O relatório voltou para rascunho. O técnico foi notificado para revisar.',
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao rejeitar RME:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  /** Trigger staff notifications when an RME is submitted for approval (#14) */
  const submitRMEForApproval = async (rmeId: string) => {
    notifyRMESubmitted(rmeId).catch((e) =>
      console.warn('notifyRMESubmitted failed:', e)
    );
  };

  return { approveRME, rejectRME, submitRMEForApproval, loading };
};
