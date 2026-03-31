import { supabase } from '@/integrations/supabase/client';

export const ticketService = {
  async loadAll() {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        ordens_servico(numero_os, id, pdf_url, aceite_tecnico, motivo_recusa),
        clientes(
          empresa,
          endereco,
          cidade,
          estado,
          cep,
          ufv_solarz,
          prioridade,
          profiles(nome, email)
        ),
        prestadores:tecnico_responsavel_id(
          id,
          nome,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async loadClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        id,
        empresa,
        endereco,
        cidade,
        estado,
        cep,
        cnpj_cpf,
        ufv_solarz,
        prioridade,
        profiles(nome, email, telefone)
      `);
    if (error) throw error;
    return data || [];
  },

  async loadPrestadores() {
    const { data, error } = await supabase
      .from('prestadores')
      .select('*')
      .eq('categoria', 'tecnico')
      .eq('ativo', true);
    if (error) throw error;
    return data || [];
  },

  async create(ticketData: any) {
    const { error } = await supabase
      .from('tickets')
      .insert([ticketData]);
    if (error) throw error;
  },

  async update(id: string, ticketData: any) {
    const { error } = await supabase
      .from('tickets')
      .update(ticketData)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async approve(ticketId: string, profileId: string) {
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'aprovado' })
      .eq('id', ticketId);
    if (updateError) throw updateError;

    const { error: approvalError } = await supabase
      .from('aprovacoes')
      .insert({
        ticket_id: ticketId,
        aprovador_id: profileId,
        status: 'aprovado',
        observacoes: 'Aprovado automaticamente',
      });
    if (approvalError) throw approvalError;
  },

  async reject(ticketId: string, profileId: string) {
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'rejeitado' })
      .eq('id', ticketId);
    if (updateError) throw updateError;

    const { error: approvalError } = await supabase
      .from('aprovacoes')
      .insert({
        ticket_id: ticketId,
        aprovador_id: profileId,
        status: 'rejeitado',
        observacoes: 'Rejeitado',
      });
    if (approvalError) throw approvalError;
  },

  async assignTechnician(ticketId: string, technicianId: string) {
    const { error } = await supabase
      .from('tickets')
      .update({ tecnico_responsavel_id: technicianId })
      .eq('id', ticketId);
    if (error) throw error;
  },

  async getLinkedOS(ticketId: string) {
    const { data } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, tecnico_id')
      .eq('ticket_id', ticketId);
    return data || [];
  },

  async resetOSAceite(osId: string) {
    await supabase
      .from('ordens_servico')
      .update({
        aceite_tecnico: 'pendente',
        aceite_at: null,
        motivo_recusa: null,
      } as any)
      .eq('id', osId);
  },

  async updateOSTecnico(osId: string, tecnicoId: string) {
    await supabase
      .from('ordens_servico')
      .update({
        tecnico_id: tecnicoId,
        aceite_tecnico: 'pendente',
        aceite_at: null,
        motivo_recusa: null,
      } as any)
      .eq('id', osId);
  },

  async getTecnicoUserId(tecnicoId: string): Promise<string | null> {
    const { data } = await supabase
      .from('tecnicos')
      .select('profiles!inner(user_id)')
      .eq('id', tecnicoId)
      .single();
    return (data as any)?.profiles?.user_id || null;
  },

  async findTecnicoByEmail(email: string) {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(email, user_id)')
      .ilike('profiles.email', email)
      .maybeSingle();
    return data;
  },

  async getPrestador(id: string) {
    const { data } = await supabase
      .from('prestadores')
      .select('email, nome')
      .eq('id', id)
      .single();
    return data;
  },

  async sendNotification(userId: string, tipo: string, titulo: string, mensagem: string, link: string) {
    await supabase.from('notificacoes').insert({
      user_id: userId,
      tipo,
      titulo,
      mensagem,
      link,
    });
  },

  async sendCalendarInvite(osId: string, action: string) {
    await supabase.functions.invoke('send-calendar-invite', {
      body: { os_id: osId, action },
    });
  },

  async generateOS(ticketId: string) {
    const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
      body: { ticketId },
    });
    if (error) throw error;
    return data;
  },

  async getLinkedRME(ticketId: string) {
    const { data } = await supabase
      .from('rme_relatorios')
      .select('id')
      .eq('ticket_id', ticketId);
    return data || [];
  },

  async getSignedPdfUrl(pdfPath: string) {
    const filePath = pdfPath.replace('ordens-servico/', '');
    const { data, error } = await supabase.storage
      .from('ordens-servico')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    if (error) throw error;
    return data?.signedUrl || null;
  },
};
