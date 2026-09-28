import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { WorkOrder } from '../types';
import type { WorkOrderDetailData } from '../hooks/useWorkOrderDetail';

export interface WorkOrderPageParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  aceite?: string;
  clienteEmpresa?: string;
  ufv?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const createWorkOrderService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    /** Server-side paginated listing with all filters applied in the database. */
    async loadPage(p: WorkOrderPageParams): Promise<{ rows: WorkOrder[]; total: number }> {
      const NONE = '00000000-0000-0000-0000-000000000000';
      let ufvClienteIds: string[] | null = null;
      if (p.ufv && p.ufv !== 'all') {
        const { data } = await db.from('cliente_ufvs').select('cliente_id').eq('nome', p.ufv);
        ufvClienteIds = Array.from(new Set((data || []).map((r: any) => r.cliente_id)));
      }

      // Search: resolve to matching OS ids (own fields + ticket title/address + client name)
      let searchOsIds: string[] | null = null;
      const term = (p.search || '').trim().replace(/[,()%*]/g, ' ').trim();
      if (term) {
        const like = `%${term}%`;
        const { data: cli } = await db.from('clientes').select('id').ilike('empresa', like).limit(300);
        const cliIds = (cli || []).map((c: any) => c.id);
        const tParts = [`titulo.ilike.${like}`, `endereco_servico.ilike.${like}`, `numero_ticket.ilike.${like}`];
        if (cliIds.length) tParts.push(`cliente_id.in.(${cliIds.join(',')})`);
        const { data: tk } = await db.from('tickets').select('id').or(tParts.join(',')).limit(1000);
        const tkIds = (tk || []).map((t: any) => t.id);
        const oParts = [`numero_os.ilike.${like}`, `site_name.ilike.${like}`, `servico_solicitado.ilike.${like}`, `inspetor_responsavel.ilike.${like}`, `notes.ilike.${like}`, `motivo_recusa.ilike.${like}`];
        if (tkIds.length) oParts.push(`ticket_id.in.(${tkIds.join(',')})`);
        const { data: os } = await db.from('ordens_servico').select('id').or(oParts.join(',')).limit(1000);
        searchOsIds = (os || []).map((o: any) => o.id);
      }

      const from = (p.page - 1) * p.pageSize;
      let q: any = db
        .from("ordens_servico")
        .select(`*, tickets!inner(id, titulo, status, prioridade, endereco_servico, cliente_id, clientes!inner(empresa, prioridade, cliente_ufvs(nome))), rme_relatorios(id, status)`, { count: 'exact' });

      if (p.status && p.status !== 'all') {
        if (p.status === 'concluida') q = q.eq('tickets.status', 'concluido');
        else if (p.status === 'em_execucao') q = q.eq('tickets.status', 'em_execucao');
        else if (p.status === 'cancelada') q = q.eq('tickets.status', 'cancelado');
        else q = q.not('tickets.status', 'in', '(concluido,em_execucao,cancelado)');
      }
      if (p.aceite && p.aceite !== 'all') q = q.eq('aceite_tecnico', p.aceite);
      if (p.clienteEmpresa && p.clienteEmpresa !== 'all') q = q.eq('tickets.clientes.empresa', p.clienteEmpresa);
      if (ufvClienteIds) q = q.in('tickets.cliente_id', ufvClienteIds.length ? ufvClienteIds : [NONE]);
      if (searchOsIds) q = q.in('id', searchOsIds.length ? searchOsIds : [NONE]);
      if (p.dateFrom || p.dateTo) {
        const a = (col: string) => [p.dateFrom && `${col}.gte.${p.dateFrom.toISOString()}`, p.dateTo && `${col}.lte.${p.dateTo.toISOString()}`].filter(Boolean).join(',');
        q = q.or(`and(${a('data_programada')}),and(data_programada.is.null,${a('data_emissao')})`);
      }

      const { data, error, count } = await q.order("data_emissao", { ascending: false }).range(from, from + p.pageSize - 1);
      if (error) throw error;
      const rows = await this.enrich(data || []);
      return { rows, total: count || 0 };
    },

    /** Dashboard counters for the whole OS base (head-only count queries). */
    async loadStats() {
      const base = () => db.from('ordens_servico').select('id, tickets!inner(status)', { count: 'exact', head: true }) as any;
      const [total, abertas, emExecucao, atrasadas, concluidas, recusadas] = await Promise.all([
        base(),
        base().not('tickets.status', 'in', '(concluido,em_execucao,cancelado)'),
        base().eq('tickets.status', 'em_execucao'),
        base().lt('data_programada', new Date().toISOString()).not('tickets.status', 'in', '(concluido,cancelado)'),
        base().eq('tickets.status', 'concluido'),
        base().eq('aceite_tecnico', 'recusado'),
      ]);
      return {
        total: total.count || 0, abertas: abertas.count || 0, emExecucao: emExecucao.count || 0,
        atrasadas: atrasadas.count || 0, concluidas: concluidas.count || 0, recusadas: recusadas.count || 0,
      };
    },

    async loadUfvNames(): Promise<string[]> {
      const { data } = await db.from('cliente_ufvs').select('nome').not('nome', 'is', null);
      return Array.from(new Set((data || []).map((r: any) => r.nome).filter(Boolean))).sort((a: string, b: string) => a.localeCompare(b));
    },

    async loadAll(): Promise<WorkOrder[]> {
      const { data, error } = await db
        .from("ordens_servico")
        .select(`*, tickets(id, titulo, status, prioridade, endereco_servico, clientes(empresa, prioridade, cliente_ufvs(nome))), rme_relatorios(id, status)`)
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return this.enrich(data || []);
    },

    async enrich(data: any[]): Promise<WorkOrder[]> {

      const rows = (data || []).map((os: any) => {
        if (os.tickets?.clientes) {
          const ufvs = Array.isArray(os.tickets.clientes.cliente_ufvs) ? os.tickets.clientes.cliente_ufvs : [];
          const names = ufvs.map((u: any) => u?.nome).filter(Boolean);
          os.tickets.clientes.ufv_solarz = names.length ? names.join(', ') : null;
        }
        return {
          ...os,
          work_type: Array.isArray(os.work_type) ? os.work_type as string[] : [],
          rme_relatorios: Array.isArray(os.rme_relatorios) ? os.rme_relatorios : os.rme_relatorios ? [os.rme_relatorios] : [],
        };
      }) as WorkOrder[];

      // Sibling RME enrichment: when an OS has no RME of its own but a sibling OS
      // (same ticket_id) has one, surface that RME so the status badge reflects the
      // shared report. The technician filling the RME does it on behalf of the team.
      const ticketIdsMissingRme = Array.from(new Set(
        rows.filter(os => !os.rme_relatorios.length && os.tickets?.id).map(os => os.tickets!.id)
      ));
      if (ticketIdsMissingRme.length) {
        const { data: ticketRmes } = await db
          .from("rme_relatorios")
          .select("id, status, ticket_id, created_at")
          .in("ticket_id", ticketIdsMissingRme)
          .order("created_at", { ascending: false });
        const byTicket = new Map<string, { id: string; status: string }>();
        (ticketRmes || []).forEach((r: any) => {
          if (!byTicket.has(r.ticket_id)) byTicket.set(r.ticket_id, { id: r.id, status: r.status });
        });
        rows.forEach(os => {
          if (!os.rme_relatorios.length) {
            const shared = byTicket.get(os.tickets?.id || "");
            if (shared) os.rme_relatorios = [shared];
          }
        });
      }

      return rows;
    },

    async loadClientes(): Promise<Array<{ id: string; empresa: string }>> {
      const { data } = await db.from("clientes").select("id, empresa").order("empresa");
      return (data || []).map(c => ({ id: c.id, empresa: c.empresa ?? '' }));
    },

    async deleteOS(osId: string) {
      const { error } = await db.from("ordens_servico").delete().eq("id", osId);
      if (error) throw error;
    },

    async revertTicketToApproved(ticketId: string) {
      const { error } = await db.from("tickets").update({ status: "aprovado" }).eq("id", ticketId);
      if (error) throw error;
    },

    async getOSWithDetails(osId: string) {
      const { data, error } = await db
        .from("ordens_servico")
        .select(`id, numero_os, data_programada, calendar_invite_sent_at, tecnico_id, tickets(id, titulo, status), tecnicos:tecnico_id(id, profile:profiles(user_id, nome))`)
        .eq("id", osId)
        .single();
      if (error) throw error;
      return data;
    },

    // --- Methods moved from useWorkOrderDetail (inline queries) ---

    async loadDetail(id: string): Promise<WorkOrderDetailData | null> {
      const { data, error } = await db
        .from('ordens_servico')
        .select(`*, tickets!inner(id, titulo, descricao, status, prioridade, endereco_servico, data_servico, horario_previsto_inicio, data_inicio_execucao, data_conclusao, tecnico_responsavel_id, prestadores:tecnico_responsavel_id(id, nome), clientes(empresa, endereco, cidade, estado, prioridade, cliente_ufvs(nome))), rme_relatorios(id, status, created_at, data_execucao, start_time, end_time)`)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const anyData: any = data;
      if (anyData.tickets?.clientes) {
        const ufvs = Array.isArray(anyData.tickets.clientes.cliente_ufvs) ? anyData.tickets.clientes.cliente_ufvs : [];
        const names = ufvs.map((u: any) => u?.nome).filter(Boolean);
        anyData.tickets.clientes.ufv_solarz = names.length ? names.join(', ') : null;
      }
      return {
        ...anyData,
        work_type: Array.isArray(anyData.work_type) ? anyData.work_type as string[] : [],
        rme_relatorios: Array.isArray(anyData.rme_relatorios) ? anyData.rme_relatorios : anyData.rme_relatorios ? [anyData.rme_relatorios] : [],
      } as WorkOrderDetailData;
    },

    async startExecution(ticketId: string) {
      const { error } = await db.from('tickets').update({ status: 'em_execucao', data_inicio_execucao: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;
    },

    async completeOS(ticketId: string) {
      const { error } = await db.from('tickets').update({ status: 'concluido', data_conclusao: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;
    },
  };
};

export const workOrderService = createWorkOrderService();
