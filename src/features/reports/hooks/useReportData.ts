import { useState, useEffect } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { reportService } from '../services/reportService';
import type { ReportTicket, ReportRME, ReportOS, ReportTecnico, ReportCliente } from '../types';

export const useReportData = () => {
  const [tickets, setTickets] = useState<ReportTicket[]>([]);
  const [rmes, setRmes] = useState<ReportRME[]>([]);
  const [ordensServico, setOrdensServico] = useState<ReportOS[]>([]);
  const [tecnicos, setTecnicos] = useState<ReportTecnico[]>([]);
  const [clientes, setClientes] = useState<ReportCliente[]>([]);
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
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      status: status.replace('_', ' ').toUpperCase(),
      count,
    }));
  };

  const getTicketsByPriority = () => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.prioridade] = (counts[t.prioridade] || 0) + 1; });
    const colors: Record<string, string> = { baixa: '#10B981', media: '#F59E0B', alta: '#F97316', critica: '#EF4444' };
    return Object.entries(counts).map(([p, count]) => ({
      name: p.toUpperCase(), value: count, color: colors[p] || '#6B7280',
    }));
  };

  const getTicketsByMonth = () => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const month = new Date(t.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts).map(([month, count]) => ({ month, tickets: count }));
  };

  const getTechnicianPerformance = () => {
    return tecnicos
      .map(t => {
        const techRMEs = rmes.filter(r => r.tecnico_id === t.id);
        const techTickets = tickets.filter(tk => tk.tecnico_responsavel_id === t.id);
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
