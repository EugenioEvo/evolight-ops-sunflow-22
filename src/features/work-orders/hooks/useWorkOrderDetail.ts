import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { notificationService } from '@/shared/services/notificationService';
import { workOrderService as defaultService } from '../services/workOrderService';
import { generateOSPDF } from '@/utils/generateOSPDF';
import { buildOSPDFData } from '@/utils/buildOSPDFData';

export interface WorkOrderDetailData {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  site_name: string | null;
  work_type: string[];
  servico_solicitado: string | null;
  inspetor_responsavel: string | null;
  equipe: string[] | null;
  notes: string | null;
  aceite_tecnico?: string;
  motivo_recusa?: string;
  tickets: {
    id: string;
    titulo: string;
    descricao: string;
    status: string;
    prioridade: string;
    endereco_servico: string;
    data_inicio_execucao: string | null;
    data_conclusao: string | null;
    prestadores?: { id: string; nome: string } | null;
    clientes: {
      empresa: string;
      endereco: string;
      cidade: string;
      estado: string;
      ufv_solarz: string | null;
      prioridade?: number | null;
    };
  };
  rme_relatorios: Array<{ id: string; status: string; created_at: string; data_execucao?: string | null; start_time?: string | null; end_time?: string | null }>;
}

export const useWorkOrderDetail = (service = defaultService) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { handleError } = useErrorHandler();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailData | null>(null);

  const canManageOS = profile?.role === 'admin' || profile?.role === 'engenharia' || profile?.role === 'supervisao';
  const canCreateRME = profile?.role === 'tecnico_campo' || canManageOS;

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const data = await service.loadDetail(id!);
      if (!data) { toast.error('OS não encontrada'); navigate('/work-orders'); return; }
      setWorkOrder(data);
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao carregar OS' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) loadWorkOrder(); }, [id]);

  const getCurrentStatus = (): string => {
    if (!workOrder) return 'aberta';
    const s = workOrder.tickets.status;
    if (s === 'concluido') return 'concluida';
    if (s === 'em_execucao') {
      // Qualquer estado do RME que não seja "aprovado" mantém a OS como Aguardando RME.
      // Só volta para "em_execucao" puro se ainda não houver RME criado.
      const rmeStatus = workOrder.rme_relatorios[0]?.status;
      if (!rmeStatus) return 'em_execucao';
      return rmeStatus === 'aprovado' ? 'em_execucao' : 'aguardando_rme';
    }
    if (s === 'cancelado') return 'cancelada';
    return 'aberta';
  };

  const rmeStatus = workOrder?.rme_relatorios?.[0]?.status as
    | 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | undefined;
  const hasRME = !!rmeStatus;
  // Approved RME unlocks OS completion. Pendente/rejeitado are NOT enough.
  const isRMEApproved = rmeStatus === 'aprovado';
  // True whenever the technician is no longer allowed to edit the RME.
  const isRMELocked = rmeStatus === 'pendente' || rmeStatus === 'aprovado';
  // Backwards-compat: legacy callers used `isRMECompleted` to mean "ready to finish OS".
  const isRMECompleted = isRMEApproved;

  const handleStartExecution = async () => {
    if (!workOrder) return;
    setActionLoading(true);
    try {
      await service.startExecution(workOrder.tickets.id);
      toast.success('Execução iniciada!');
      loadWorkOrder();
    } catch (error) {
      handleError(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOS = async () => {
    if (!workOrder || !isRMEApproved) {
      toast.error('A OS só pode ser concluída após aprovação do RME pelo avaliador.');
      return;
    }
    setActionLoading(true);
    try {
      await service.completeOS(workOrder.tickets.id);
      toast.success('OS concluída!');
      loadWorkOrder();
    } catch (error) {
      handleError(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!workOrder) return;
    setSendingEmail(true);
    try {
      await notificationService.sendCalendarInvite(workOrder.id, 'create');
      toast.success('Email enviado com sucesso!');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao enviar email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!workOrder) return;
    try {
      const pdfData = await buildOSPDFData({
        os_id: workOrder.id,
        numero_os: workOrder.numero_os,
        data_programada: workOrder.data_programada,
        hora_inicio: workOrder.hora_inicio,
        servico_solicitado: workOrder.servico_solicitado,
        tipo_trabalho: (workOrder.work_type as string[]) || [],
        ticket_id: workOrder.tickets.id,
        cliente: {
          empresa: workOrder.tickets.clientes?.empresa,
          endereco: workOrder.tickets.clientes?.endereco,
          cidade: workOrder.tickets.clientes?.cidade,
          estado: workOrder.tickets.clientes?.estado,
          ufv_solarz: workOrder.tickets.clientes?.ufv_solarz,
        },
        ticket: {
          titulo: workOrder.tickets.titulo,
          descricao: workOrder.tickets.descricao,
          endereco_servico: workOrder.tickets.endereco_servico,
          tecnico_responsavel_id: (workOrder.tickets as any).tecnico_responsavel_id,
        },
      });
      const pdfBlob = await generateOSPDF(pdfData);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `OS_${workOrder.numero_os}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF baixado!');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao gerar PDF' });
    }
  };

  const handleCreateRME = () => {
    if (!workOrder) return;
    if (hasRME) navigate(`/rme-wizard/${workOrder.rme_relatorios[0].id}`);
    else navigate(`/rme-wizard/new?os=${workOrder.id}`);
  };

  return {
    workOrder, loading, actionLoading, sendingEmail, canManageOS, canCreateRME,
    hasRME, isRMECompleted, isRMEApproved, isRMELocked, rmeStatus,
    currentStatus: getCurrentStatus(),
    handleStartExecution, handleCompleteOS, handleSendEmail, handleDownloadPDF, handleCreateRME,
    navigate,
  };
};
