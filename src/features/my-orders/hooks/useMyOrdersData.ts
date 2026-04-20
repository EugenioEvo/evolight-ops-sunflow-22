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
  const [pendingAcceptanceByTicket, setPendingAcceptanceByTicket] = useState<Record<string, number>>({});
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
    if (data) {
      setOrdensServico(data as any);
      const ticketIds = Array.from(new Set((data as any[]).map((os) => os.ticket_id).filter(Boolean)));
      const pendingMap = await handleAsyncError(
        () => myOrdersService.loadPendingAcceptanceByTicket(ticketIds),
        { fallbackMessage: 'Erro ao verificar aceites pendentes' }
      );
      setPendingAcceptanceByTicket(pendingMap || {});
    }
    setLoading(false);
  }, [profile?.id, isTecnico]);

  const realtimeCallback = useCallback(() => {
    if (canViewOS) loadOrdensServico();
  }, [canViewOS, loadOrdensServico]);
  useGlobalRealtime(realtimeCallback);

  useEffect(() => {
    if (canViewOS) loadOrdensServico();
  }, [canViewOS, loadOrdensServico]);

  let osFiltradas = ordensServico;
  if (prioridadeFiltro !== 'todas') {
    osFiltradas = osFiltradas.filter(os => os.tickets.prioridade === prioridadeFiltro);
  }

  // Classificação por aba (alinhada ao Dashboard do técnico):
  // - Pendentes: aguardando aceite OU aceitas mas ainda 'ordem_servico_gerada' (NÃO inclui recusadas)
  // - Em Execução: ticket 'em_execucao' OU 'aguardando_rme' (técnico ainda tem ação no RME)
  // - Concluídas: ticket 'concluido'
  // - Recusadas: aceite_tecnico === 'recusado'
  // - Todas: ativas (tudo acima exceto Concluídas e Canceladas)
  const recusadas = osFiltradas.filter(os => (os as any).aceite_tecnico === 'recusado');
  const pendentes = osFiltradas.filter(os => {
    const ticketStatus = os.tickets.status;
    const osAceite = (os as any).aceite_tecnico || 'pendente';
    if (osAceite === 'recusado') return false;
    if (['concluido', 'cancelado', 'em_execucao', 'aguardando_rme'].includes(ticketStatus)) return false;
    if (osAceite === 'pendente') return true;
    if (osAceite === 'aceito' && ticketStatus === 'ordem_servico_gerada') return true;
    return false;
  });
  const emExecucao = osFiltradas.filter(os =>
    (os.tickets.status === 'em_execucao' || os.tickets.status === 'aguardando_rme') &&
    (os as any).aceite_tecnico !== 'recusado'
  );
  const concluidas = osFiltradas.filter(os => os.tickets.status === 'concluido');
  const aguardandoGestaoCount = recusadas.length;
  // 'Todas' = ativas, exclui concluídas, canceladas e recusadas (recusadas têm aba própria)
  const todas = osFiltradas.filter(os =>
    !['concluido', 'cancelado'].includes(os.tickets.status) &&
    (os as any).aceite_tecnico !== 'recusado'
  );

  return {
    ordensServico, loading, prioridadeFiltro, setPrioridadeFiltro,
    activeTab, setActiveTab, isTecnico, canViewOS, loadOrdensServico,
    todas, pendentes, aguardandoGestaoCount, emExecucao, concluidas, recusadas,
  };
}
