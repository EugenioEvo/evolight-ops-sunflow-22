import { supabase } from '@/integrations/supabase/client';

export const workOrderService = {
  async loadAll() {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        tickets(
          id, titulo, status, prioridade, endereco_servico,
          clientes(empresa, ufv_solarz, prioridade)
        ),
        rme_relatorios(id, status)
      `)
      .order("data_emissao", { ascending: false });

    if (error) throw error;
    return (data || []).map((os: any) => ({
      ...os,
      work_type: os.work_type || [],
      rme_relatorios: os.rme_relatorios || [],
    }));
  },

  async loadClientes() {
    const { data } = await supabase
      .from("clientes")
      .select("id, empresa")
      .order("empresa");
    return data || [];
  },

  async deleteOS(osId: string) {
    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("id", osId);
    if (error) throw error;
  },

  async revertTicketToApproved(ticketId: string) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "aprovado" })
      .eq("id", ticketId);
    if (error) throw error;
  },

  async getOSWithDetails(osId: string) {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        id, numero_os, data_programada, calendar_invite_sent_at, tecnico_id,
        tickets(id, titulo, status),
        tecnicos:tecnico_id(
          id,
          profile:profiles(user_id, nome)
        )
      `)
      .eq("id", osId)
      .single();

    if (error) throw error;
    return data;
  },

  // sendCalendarInvite and sendNotification moved to shared/services/notificationService.ts
};
