import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { ReportTicket, ReportRME, ReportOS, ReportTecnico, ReportCliente } from '../types';

export interface ReportFetchResult {
  tickets: ReportTicket[];
  rmes: ReportRME[];
  ordensServico: ReportOS[];
  tecnicos: ReportTecnico[];
  clientes: ReportCliente[];
}

export const createReportService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchAll(dateRange: { start: string; end: string }): Promise<ReportFetchResult> {
      const [ticketsRes, rmesRes, osRes, tecnicosRes, clientesRes] = await Promise.all([
        db.from('tickets').select(`*, clientes!inner(empresa, profiles!inner(nome)), tecnicos(profiles!inner(nome))`)
          .gte('created_at', `${dateRange.start}T00:00:00`).lte('created_at', `${dateRange.end}T23:59:59`).order('created_at', { ascending: false }),
        db.from('rme_relatorios').select(`*, status, data_aprovacao, tickets!inner(titulo, numero_ticket), tecnicos!inner(profiles!inner(nome))`)
          .gte('created_at', `${dateRange.start}T00:00:00`).lte('created_at', `${dateRange.end}T23:59:59`).order('created_at', { ascending: false }),
        db.from('ordens_servico').select(`*, tickets!inner(titulo), tecnicos!inner(profiles!inner(nome))`)
          .gte('created_at', `${dateRange.start}T00:00:00`).lte('created_at', `${dateRange.end}T23:59:59`).order('created_at', { ascending: false }),
        db.from('tecnicos').select('*, profiles!inner(nome, email)'),
        db.from('clientes').select('*, profiles!inner(nome, email)'),
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
};

export const reportService = createReportService();
