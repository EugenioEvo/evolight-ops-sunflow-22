import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCancelOS } from "@/hooks/useCancelOS";
import { scheduleService } from "../services/scheduleService";

export function useScheduleActions(loadOrdensServico: () => Promise<void>) {
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const { cancelOS, loading: cancelLoading } = useCancelOS();
  const { toast } = useToast();

  const resendCalendarInvite = async (osId: string, numeroOS: string) => {
    setResendingInvite(osId);
    try {
      await scheduleService.resendCalendarInvite(osId);
      toast({ title: 'Convite reenviado', description: `Convite de calendário reenviado para OS ${numeroOS}` });
      loadOrdensServico();
    } catch (error: any) {
      toast({ title: 'Erro ao reenviar', description: error.message || 'Não foi possível reenviar o convite', variant: 'destructive' });
    } finally {
      setResendingInvite(null);
    }
  };

  const generatePresenceQR = async (osId: string) => {
    try {
      await scheduleService.generatePresenceQR(osId);
      toast({ title: 'QR Code gerado', description: 'Token de confirmação de presença criado com sucesso' });
      loadOrdensServico();
    } catch (error: any) {
      toast({ title: 'Erro ao gerar QR Code', description: error.message, variant: 'destructive' });
    }
  };

  return { resendingInvite, cancelOS, cancelLoading, resendCalendarInvite, generatePresenceQR };
}
