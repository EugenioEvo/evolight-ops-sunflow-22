import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalRealtime } from "@/hooks/useRealtimeProvider";
import { useToast } from "@/hooks/use-toast";
import { myOrdersService } from "../services/myOrdersService";
import type { OrdemServico } from "../types";

export function useMyOrdersData() {
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>('todas');
  const [activeTab, setActiveTab] = useState<string>('pendentes');
  const { profile } = useAuth();
  const { toast } = useToast();

  const isTecnico = profile?.role === "tecnico_campo";
  const isAreaTecnica = profile?.role === "engenharia" || profile?.role === "supervisao" || profile?.role === "admin";
  const canViewOS = isTecnico || isAreaTecnica;

  const loadOrdensServico = useCallback(async () => {
    try {
      setLoading(true);
      const data = await myOrdersService.loadOrdensServico(profile?.id, isTecnico);
      setOrdensServico(data as any);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ordens de serviço",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isTecnico, toast]);

  const realtimeCallback = useCallback(() => {
    if (canViewOS) loadOrdensServico();
  }, [canViewOS, loadOrdensServico]);
  useGlobalRealtime(realtimeCallback);

  useEffect(() => {
    if (canViewOS) loadOrdensServico();
  }, [canViewOS, loadOrdensServico]);

  // Derived filtered data
  let osFiltradas = ordensServico;
  if (prioridadeFiltro !== 'todas') {
    osFiltradas = osFiltradas.filter(os => os.tickets.prioridade === prioridadeFiltro);
  }

  const pendentes = osFiltradas.filter(os => os.tickets.status === 'ordem_servico_gerada');
  const aguardandoGestaoCount = pendentes.filter(os => (os as any).aceite_tecnico === 'recusado').length;
  const emExecucao = osFiltradas.filter(os => os.tickets.status === 'em_execucao');
  const concluidas = osFiltradas.filter(os => os.tickets.status === 'concluido');

  return {
    ordensServico,
    loading,
    prioridadeFiltro,
    setPrioridadeFiltro,
    activeTab,
    setActiveTab,
    isTecnico,
    canViewOS,
    loadOrdensServico,
    pendentes,
    aguardandoGestaoCount,
    emExecucao,
    concluidas,
  };
}
