import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { reportService } from '../services/reportService';

export const useReportData = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [rmes, setRmes] = useState<any[]>([]);
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const { handleAsyncError } = useErrorHandler();

  const loadData = async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () => reportService.fetchAll(dateRange),
      { fallbackMessage: 'Erro ao carregar dados dos relatórios' }
    );
    if (data) {
      setTickets(data.tickets);
      setRmes(data.rmes);
      setOrdensServico(data.ordensServico);
      setTecnicos(data.tecnicos);
      setClientes(data.clientes);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [dateRange]);

  const getTicketsByStatus = () => {
    const counts = tickets.reduce((acc: any, t: any) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([status, count]) => ({
      status: status.replace('_', ' ').toUpperCase(),
      count: count as number,
    }));
  };

  const getTicketsByPriority = () => {
    const counts = tickets.reduce((acc: any, t: any) => {
      acc[t.prioridade] = (acc[t.prioridade] || 0) + 1;
      return acc;
    }, {});
    const colors: Record<string, string> = { baixa: '#10B981', media: '#F59E0B', alta: '#F97316', critica: '#EF4444' };
    return Object.entries(counts).map(([p, count]) => ({
      name: p.toUpperCase(), value: count as number, color: colors[p] || '#6B7280',
    }));
  };

  const getTicketsByMonth = () => {
    const counts = tickets.reduce((acc: any, t: any) => {
      const month = new Date(t.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([month, count]) => ({ month, tickets: count as number }));
  };

  const getTechnicianPerformance = () => {
    return tecnicos
      .map((t: any) => {
        const techRMEs = rmes.filter((r: any) => r.tecnico_id === t.id);
        const techTickets = tickets.filter((tk: any) => tk.tecnico_responsavel_id === t.id);
        return {
          nome: t.profiles.nome,
          tickets_atribuidos: techTickets.length,
          rmes_completados: techRMEs.length,
          taxa_conclusao: techTickets.length > 0 ? Math.round((techRMEs.length / techTickets.length) * 100) : 0,
        };
      })
      .filter(s => s.tickets_atribuidos > 0 || s.rmes_completados > 0);
  };

  return {
    tickets, rmes, ordensServico, tecnicos, clientes, loading,
    dateRange, setDateRange,
    getTicketsByStatus, getTicketsByPriority, getTicketsByMonth, getTechnicianPerformance,
  };
};
