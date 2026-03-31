import { supabase } from '@/integrations/supabase/client';

export const reportService = {
  async fetchAll(dateRange: { start: string; end: string }) {
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
      tickets: ticketsRes.data || [],
      rmes: rmesRes.data || [],
      ordensServico: osRes.data || [],
      tecnicos: tecnicosRes.data || [],
      clientes: clientesRes.data || [],
    };
  },
};
