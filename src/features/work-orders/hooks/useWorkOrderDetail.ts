import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { notificationService } from '@/shared/services/notificationService';
import { generateOSPDF } from '@/utils/generateOSPDF';

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
    clientes: {
      empresa: string;
      endereco: string;
      cidade: string;
      estado: string;
      ufv_solarz: string | null;
      prioridade?: number | null;
    };
  };
  rme_relatorios: Array<{ id: string; status: string; created_at: string }>;
}

export const useWorkOrderDetail = () => {
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
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`*, tickets!inner(id, titulo, descricao, status, prioridade, endereco_servico, clientes(empresa, endereco, cidade, estado, ufv_solarz, prioridade)), rme_relatorios(id, status, created_at)`)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) { toast.error('OS não encontrada'); navigate('/work-orders'); return; }

      setWorkOrder({
        ...data,
        work_type: Array.isArray(data.work_type) ? data.work_type as string[] : [],
        rme_relatorios: Array.isArray(data.rme_relatorios) ? data.rme_relatorios : data.rme_relatorios ? [data.rme_relatorios] : [],
      } as WorkOrderDetailData);
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
    if (s === 'em_execucao') return workOrder.rme_relatorios.some(r => r.status === 'rascunho') ? 'aguardando_rme' : 'em_execucao';
    if (s === 'cancelado') return 'cancelada';
    return 'aberta';
  };

  const hasRME = workOrder?.rme_relatorios && workOrder.rme_relatorios.length > 0;
  const isRMECompleted = workOrder?.rme_relatorios?.some(r => r.status === 'concluido');

  const handleStartExecution = async () => {
    if (!workOrder) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('tickets').update({ status: 'em_execucao', data_inicio_execucao: new Date().toISOString() }).eq('id', workOrder.tickets.id);
      if (error) throw error;
      toast.success('Execução iniciada!');
      loadWorkOrder();
    } catch (error) {
      handleError(error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOS = async () => {
    if (!workOrder || !isRMECompleted) {
      toast.error('RME concluído necessário para finalizar a OS.');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase.from('tickets').update({ status: 'concluido', data_conclusao: new Date().toISOString() }).eq('id', workOrder.tickets.id);
      if (error) throw error;
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
      const pdfBlob = await generateOSPDF({
        numero_os: workOrder.numero_os,
        data_programada: workOrder.data_programada || new Date().toISOString(),
        equipe: workOrder.equipe || ['Não informado'],
        cliente: workOrder.tickets.clientes?.empresa || 'Não informado',
        endereco: `${workOrder.tickets.clientes?.endereco || ''}, ${workOrder.tickets.clientes?.cidade || ''} - ${workOrder.tickets.clientes?.estado || ''}`,
        servico_solicitado: workOrder.servico_solicitado || 'MANUTENÇÃO',
        hora_marcada: workOrder.hora_inicio || '00:00',
        descricao: workOrder.tickets.descricao || workOrder.tickets.titulo,
        inspetor_responsavel: workOrder.inspetor_responsavel || 'TODOS',
        tipo_trabalho: workOrder.work_type || [],
        ufv_solarz: workOrder.tickets.clientes?.ufv_solarz || undefined,
      });
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
    hasRME, isRMECompleted, currentStatus: getCurrentStatus(),
    handleStartExecution, handleCompleteOS, handleSendEmail, handleDownloadPDF, handleCreateRME,
    navigate,
  };
};
