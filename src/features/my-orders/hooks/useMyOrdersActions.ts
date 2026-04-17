import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAceiteOS } from "@/hooks/useAceiteOS";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { generateOSPDF } from "@/utils/generateOSPDF";
import { myOrdersService } from "../services/myOrdersService";
import type { OrdemServico } from "../types";

export function useMyOrdersActions(loadOrdensServico: () => Promise<void>, setActiveTab: (tab: string) => void) {
  const [startingId, setStartingId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [recusaDialogOS, setRecusaDialogOS] = useState<OrdemServico | null>(null);
  const navigate = useNavigate();
  const { acceptOS, rejectOS, loading: aceiteLoading } = useAceiteOS();
  const { handleError } = useErrorHandler();

  const handleIniciarExecucao = async (os: OrdemServico) => {
    setStartingId(os.id);
    try {
      await myOrdersService.iniciarExecucao(os.ticket_id);
      await loadOrdensServico();
      toast.success("A OS foi movida para a aba 'Em Execução'. Agora você pode preencher o RME.");
      setActiveTab('execucao');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao iniciar execução' });
    } finally {
      setStartingId(null);
    }
  };

  const handlePreencherRME = async (os: OrdemServico) => {
    setNavigating(os.id);
    await new Promise(resolve => setTimeout(resolve, 300));
    const rme = os.rme_relatorios?.[0];
    // RME já submetido (pendente/aprovado/rejeitado) -> apenas visualização via detalhe da OS
    if (rme && rme.status !== 'rascunho') {
      navigate(`/work-orders/${os.id}`);
    } else if (rme) {
      // rascunho -> continuar edição
      navigate(`/rme-wizard/${rme.id}?os=${os.id}`);
    } else {
      navigate(`/rme-wizard/new?os=${os.id}`);
    }
  };

  const handleVerOS = async (os: OrdemServico) => {
    try {
      const pdfData = {
        numero_os: os.numero_os,
        data_programada: os.data_programada || new Date().toISOString(),
        equipe: os.equipe || ['Não informado'],
        cliente: os.tickets.clientes?.empresa || 'Não informado',
        endereco: `${os.tickets.clientes?.endereco || os.tickets.endereco_servico}, ${os.tickets.clientes?.cidade || ''} - ${os.tickets.clientes?.estado || ''}`,
        servico_solicitado: os.servico_solicitado || 'MANUTENÇÃO',
        hora_marcada: os.hora_inicio || '00:00',
        descricao: os.tickets.descricao || os.tickets.titulo || '',
        inspetor_responsavel: os.inspetor_responsavel || 'TODOS',
        tipo_trabalho: os.tipo_trabalho || []
      };
      const pdfBlob = await generateOSPDF(pdfData);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `OS_${os.numero_os}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success(`Ordem de serviço ${os.numero_os} baixada com sucesso.`);
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao gerar PDF' });
    }
  };

  const handleLigarCliente = (telefone?: string) => {
    if (!telefone) {
      toast.error("Este cliente não possui telefone cadastrado.");
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  const handleAbrirMapa = (endereco: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, "_blank");
  };

  // Aceite agora é direto na OS (1-step). aceitarTicket mantido como passthrough p/ acceptOS.
  const handleAceitarTicket = async (os: OrdemServico) => {
    const success = await acceptOS(os.id);
    if (success) await loadOrdensServico();
  };

  const handleAceitarOS = async (os: OrdemServico) => {
    const success = await acceptOS(os.id);
    if (success) await loadOrdensServico();
  };

  const handleRecusarOS = async (motivo: string) => {
    if (!recusaDialogOS) return;
    const success = await rejectOS(recusaDialogOS.id, motivo);
    if (success) { setRecusaDialogOS(null); await loadOrdensServico(); }
  };

  return {
    startingId, navigating, recusaDialogOS, setRecusaDialogOS, aceiteLoading,
    handleIniciarExecucao, handlePreencherRME, handleVerOS, handleLigarCliente,
    handleAbrirMapa, handleAceitarTicket, handleAceitarOS, handleRecusarOS,
  };
}
