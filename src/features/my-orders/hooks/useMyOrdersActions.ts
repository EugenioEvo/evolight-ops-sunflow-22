import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAceiteOS } from "@/hooks/useAceiteOS";
import { generateOSPDF } from "@/utils/generateOSPDF";
import { myOrdersService } from "../services/myOrdersService";
import type { OrdemServico } from "../types";

export function useMyOrdersActions(loadOrdensServico: () => Promise<void>, setActiveTab: (tab: string) => void) {
  const [startingId, setStartingId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [recusaDialogOS, setRecusaDialogOS] = useState<OrdemServico | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { aceitarOS, recusarOS, loading: aceiteLoading } = useAceiteOS();

  const handleIniciarExecucao = async (os: OrdemServico) => {
    setStartingId(os.id);
    try {
      await myOrdersService.iniciarExecucao(os.ticket_id);
      await loadOrdensServico();
      toast({
        title: "Execução iniciada!",
        description: "A OS foi movida para a aba 'Em Execução'. Agora você pode preencher o RME.",
      });
      setActiveTab('execucao');
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar execução",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStartingId(null);
    }
  };

  const handlePreencherRME = async (os: OrdemServico) => {
    setNavigating(os.id);
    await new Promise(resolve => setTimeout(resolve, 300));
    navigate(`/rme?os=${os.id}`);
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
      a.href = url;
      a.download = `OS_${os.numero_os}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "PDF baixado", description: `Ordem de serviço ${os.numero_os} baixada com sucesso.` });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({ title: "Erro ao abrir PDF", description: error.message, variant: "destructive" });
    }
  };

  const handleLigarCliente = (telefone?: string) => {
    if (!telefone) {
      toast({ title: "Telefone não disponível", description: "Este cliente não possui telefone cadastrado.", variant: "destructive" });
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  const handleAbrirMapa = (endereco: string) => {
    const encodedAddress = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const handleAceitarOS = async (os: OrdemServico) => {
    const success = await aceitarOS(os.id);
    if (success) await loadOrdensServico();
  };

  const handleRecusarOS = async (motivo: string) => {
    if (!recusaDialogOS) return;
    const success = await recusarOS(recusaDialogOS.id, motivo);
    if (success) {
      setRecusaDialogOS(null);
      await loadOrdensServico();
    }
  };

  return {
    startingId,
    navigating,
    recusaDialogOS,
    setRecusaDialogOS,
    aceiteLoading,
    handleIniciarExecucao,
    handlePreencherRME,
    handleVerOS,
    handleLigarCliente,
    handleAbrirMapa,
    handleAceitarOS,
    handleRecusarOS,
  };
}
