import { useState } from "react";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useCancelOS } from "@/hooks/useCancelOS";
import { scheduleService } from "../services/scheduleService";

export function useScheduleActions(loadOrdensServico: () => Promise<void>) {
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const { cancelOS, loading: cancelLoading } = useCancelOS();
  const { handleError } = useErrorHandler();

  const resendCalendarInvite = async (osId: string, numeroOS: string) => {
    setResendingInvite(osId);
    try {
      await scheduleService.resendCalendarInvite(osId);
      toast.success(`Convite de calendário reenviado para OS ${numeroOS}`);
      loadOrdensServico();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Não foi possível reenviar o convite' });
    } finally {
      setResendingInvite(null);
    }
  };

  const generatePresenceQR = async (osId: string) => {
    try {
      await scheduleService.generatePresenceQR(osId);
      toast.success('Token de confirmação de presença criado com sucesso');
      loadOrdensServico();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao gerar QR Code' });
    }
  };

  return { resendingInvite, cancelOS, cancelLoading, resendCalendarInvite, generatePresenceQR };
}
