import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { WorkOrder, WOClienteOption, WOTecnicoOption, WorkOrderCreateData } from '../types';
import type { WorkOrderDetailData } from '../hooks/useWorkOrderDetail';

export const createWorkOrderService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadAll(): Promise<WorkOrder[]> {
      const { data, error } = await db
        .from("ordens_servico")
        .select(`*, tickets(id, titulo, status, prioridade, endereco_servico, clientes(empresa, ufv_solarz, prioridade)), rme_relatorios(id, status)`)
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return (data || []).map((os) => ({
        ...os,
        work_type: Array.isArray(os.work_type) ? os.work_type as string[] : [],
        rme_relatorios: Array.isArray(os.rme_relatorios) ? os.rme_relatorios : os.rme_relatorios ? [os.rme_relatorios] : [],
      })) as WorkOrder[];
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

    // --- Methods moved from useWorkOrderCreate (inline queries) ---

    async loadClientesForCreate(): Promise<WOClienteOption[]> {
      const { data } = await db.from('clientes').select('id, empresa, ufv_solarz').order('empresa');
      return (data || []).map(c => ({ id: c.id, empresa: c.empresa ?? '', ufv_solarz: c.ufv_solarz }));
    },

    async loadTecnicosForCreate(): Promise<WOTecnicoOption[]> {
      const { data } = await db.from('prestadores').select('id, nome').eq('categoria', 'tecnico').eq('ativo', true).order('nome');
      return (data || []) as WOTecnicoOption[];
    },

    async submitWorkOrder(woData: WorkOrderCreateData & { selectedWorkTypes: string[]; teamMembers: string[] }) {
      const { data: userData } = await db.auth.getUser();
      const { data: clienteData } = await db.from('clientes').select('endereco, cidade, estado').eq('id', woData.cliente_id).single();
      const endereco = clienteData ? `${clienteData.endereco || ''}, ${clienteData.cidade || ''} - ${clienteData.estado || ''}` : woData.site_name;

      const { data: ticketData, error: ticketError } = await db.from('tickets').insert([{
        numero_ticket: '', cliente_id: woData.cliente_id,
        titulo: `OS - ${woData.site_name} - ${woData.servico_solicitado}`,
        descricao: woData.descricao, endereco_servico: endereco,
        equipamento_tipo: 'outros' as const,
        prioridade: woData.servico_solicitado === 'emergencia' ? 'critica' as const : 'media' as const,
        status: 'ordem_servico_gerada' as const,
        created_by: userData.user?.id!,
        data_vencimento: woData.data_programada.toISOString(),
      }]).select().single();
      if (ticketError) throw ticketError;

      const { data: osData, error: osError } = await db.from('ordens_servico').insert([{
        ticket_id: ticketData.id, numero_os: `OS${Date.now()}`,
        data_programada: woData.data_programada.toISOString(),
        hora_inicio: woData.hora_inicio || null, hora_fim: woData.hora_fim || null,
        site_name: woData.site_name, servico_solicitado: woData.servico_solicitado,
        work_type: woData.selectedWorkTypes,
        equipe: woData.teamMembers.length > 0 ? woData.teamMembers : null,
        inspetor_responsavel: woData.inspetor_responsavel,
        notes: woData.notes || null,
      }]).select().single();
      if (osError) throw osError;

      return osData;
    },

    // --- Methods moved from useWorkOrderDetail (inline queries) ---

    async loadDetail(id: string): Promise<WorkOrderDetailData | null> {
      const { data, error } = await db
        .from('ordens_servico')
        .select(`*, tickets!inner(id, titulo, descricao, status, prioridade, endereco_servico, clientes(empresa, endereco, cidade, estado, ufv_solarz, prioridade)), rme_relatorios(id, status, created_at)`)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        work_type: Array.isArray(data.work_type) ? data.work_type as string[] : [],
        rme_relatorios: Array.isArray(data.rme_relatorios) ? data.rme_relatorios : data.rme_relatorios ? [data.rme_relatorios] : [],
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
