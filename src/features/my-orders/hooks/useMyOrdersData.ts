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
  const [activeTab, setActiveTab] = useState<string>('pendentes');
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

  // Classificação unificada (alinhada ao Dashboard do técnico):
  // - Pendentes: aguardando aceite OU aceitas porém ainda não iniciadas (ordem_servico_gerada)
  //   Inclui também as recusadas, para o técnico ter visibilidade do retorno da gestão.
  // - Em Execução: ticket.status === 'em_execucao'
  // - Concluídas: ticket.status === 'concluido' OU 'aguardando_rme' (parte final do ciclo)
  const pendentes = osFiltradas.filter(os => {
    const ticketStatus = os.tickets.status;
    const osAceite = (os as any).aceite_tecnico || 'pendente';
    if (['concluido', 'cancelado', 'em_execucao', 'aguardando_rme'].includes(ticketStatus)) return false;
    if (osAceite === 'recusado') return true;
    if (osAceite === 'pendente') return true;
    if (osAceite === 'aceito' && ticketStatus === 'ordem_servico_gerada') return true;
    return false;
  });
  const aguardandoGestaoCount = pendentes.filter(os => (os as any).aceite_tecnico === 'recusado').length;
  const emExecucao = osFiltradas.filter(os => os.tickets.status === 'em_execucao');
  const concluidas = osFiltradas.filter(os =>
    os.tickets.status === 'concluido' || os.tickets.status === 'aguardando_rme'
  );

  return {
    ordensServico, loading, prioridadeFiltro, setPrioridadeFiltro,
    activeTab, setActiveTab, isTecnico, canViewOS, loadOrdensServico,
    pendentes, aguardandoGestaoCount, emExecucao, concluidas,
  };
}
