import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalRealtime } from "@/hooks/useRealtimeProvider";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { myOrdersService } from "../services/myOrdersService";
import type { OrdemServico } from "../types";

export function useMyOrdersData() {
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>('todas');
  const [activeTab, setActiveTab] = useState<string>('todas');
  const { profile } = useAuth();
  const { handleAsyncError } = useErrorHandler();

  const isTecnico = profile?.role === "tecnico_campo";
  const isAreaTecnica = profile?.role === "engenharia" || profile?.role === "supervisao" || profile?.role === "admin";
  const canViewOS = isTecnico || isAreaTecnica;

  const loadOrdensServico = useCallback(async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () => myOrdersService.loadOrdensServico(profile?.id, isTecnico),
      { fallbackMessage: 'Erro ao carregar ordens de serviço' }
    );
    if (data) setOrdensServico(data as any);
    setLoading(false);
  }, [profile?.id, isTecnico]);
...
  return {
    ordensServico, loading, prioridadeFiltro, setPrioridadeFiltro,
    activeTab, setActiveTab, isTecnico, canViewOS, loadOrdensServico,
    todas, pendentes, aguardandoGestaoCount, emExecucao, concluidas, recusadas,
  };
}
