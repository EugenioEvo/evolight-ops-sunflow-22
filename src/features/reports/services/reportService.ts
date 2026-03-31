import { supabase } from '@/integrations/supabase/client';
import type { ReportTicket, ReportRME, ReportOS, ReportTecnico, ReportCliente } from '../types';

export interface ReportFetchResult {
  tickets: ReportTicket[];
  rmes: ReportRME[];
  ordensServico: ReportOS[];
  tecnicos: ReportTecnico[];
  clientes: ReportCliente[];
}

export const reportService = {
  async fetchAll(dateRange: { start: string; end: string }): Promise<ReportFetchResult> {
    const [ticketsRes, rmesRes, osRes, tecnicosRes, clientesRes] = await Promise.all([
      supabase
        .from('tickets')
        .select(`*, clientes!inner(empresa, profiles!inner(nome)), tecnicos(profiles!inner(nome))`)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase
        .from('rme_relatorios')
        .select(`*, status_aprovacao, data_aprovacao, tickets!inner(titulo, numero_ticket), tecnicos!inner(profiles!inner(nome))`)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase
        .from('ordens_servico')
        .select(`*, tickets!inner(titulo), tecnicos!inner(profiles!inner(nome))`)
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase.from('tecnicos').select('*, profiles!inner(nome, email)'),
      supabase.from('clientes').select('*, profiles!inner(nome, email)'),
    ]);

    return {
      tickets: (ticketsRes.data || []) as unknown as ReportTicket[],
      rmes: (rmesRes.data || []) as unknown as ReportRME[],
      ordensServico: (osRes.data || []) as unknown as ReportOS[],
      tecnicos: (tecnicosRes.data || []) as unknown as ReportTecnico[],
      clientes: (clientesRes.data || []) as unknown as ReportCliente[],
    };
  },
};
