import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { TicketWithRelations, TicketCliente, TicketPrestador, LinkedOS } from '../types';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export const createTicketService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadAll(): Promise<TicketWithRelations[]> {
      const { data, error } = await db
        .from('tickets')
        .select(`*, ordens_servico(numero_os, id, pdf_url, aceite_tecnico, motivo_recusa, tecnico_id, data_programada, tecnicos:tecnico_id(profiles(nome, email)), rme_relatorios(id, status, status_aprovacao)), clientes(empresa, endereco, cidade, estado, cep, ufv_solarz, prioridade, profiles(nome, email)), prestadores:tecnico_responsavel_id(id, nome, email)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TicketWithRelations[];
    },

    async loadClientes(): Promise<TicketCliente[]> {
      const { data, error } = await db
        .from('clientes')
        .select(`id, empresa, endereco, cidade, estado, cep, cnpj_cpf, ufv_solarz, prioridade, profiles(nome, email, telefone)`);
      if (error) throw error;
      return (data || []) as unknown as TicketCliente[];
    },

    async loadPrestadores(): Promise<TicketPrestador[]> {
      const { data, error } = await db.from('prestadores').select('*').eq('categoria', 'tecnico').eq('ativo', true);
      if (error) throw error;
      return (data || []) as TicketPrestador[];
    },

    async create(ticketData: TablesInsert<'tickets'>) {
      const { error } = await db.from('tickets').insert([ticketData]);
      if (error) throw error;
    },

    async update(id: string, ticketData: TablesUpdate<'tickets'>) {
      const { error } = await db.from('tickets').update(ticketData).eq('id', id);
      if (error) throw error;
    },

    async delete(id: string) {
      const { error } = await db.from('tickets').delete().eq('id', id);
      if (error) throw error;
    },

    async approve(ticketId: string, profileId: string, observacoes?: string) {
      const { error: updateError } = await db.from('tickets').update({ status: 'aprovado' }).eq('id', ticketId);
      if (updateError) throw updateError;
      const { error: approvalError } = await db.from('aprovacoes').insert({
        ticket_id: ticketId,
        aprovador_id: profileId,
        status: 'aprovado',
        observacoes: observacoes?.trim() || 'Aprovado',
      });
      if (approvalError) throw approvalError;
    },

    async reject(ticketId: string, profileId: string, observacoes?: string) {
      const { error: updateError } = await db.from('tickets').update({ status: 'rejeitado' }).eq('id', ticketId);
      if (updateError) throw updateError;
      const { error: approvalError } = await db.from('aprovacoes').insert({
        ticket_id: ticketId,
        aprovador_id: profileId,
        status: 'rejeitado',
        observacoes: observacoes?.trim() || 'Rejeitado',
      });
      if (approvalError) throw approvalError;
    },

    async assignTechnician(ticketId: string, technicianId: string) {
      const { error } = await db.from('tickets').update({ tecnico_responsavel_id: technicianId }).eq('id', ticketId);
      if (error) throw error;
    },

    async getLinkedOS(ticketId: string): Promise<LinkedOS[]> {
      const { data } = await db.from('ordens_servico').select('id, numero_os, tecnico_id').eq('ticket_id', ticketId);
      return (data || []) as LinkedOS[];
    },

    async resetOSAceite(osId: string) {
      await db.from('ordens_servico').update({ aceite_tecnico: 'pendente', aceite_at: null, motivo_recusa: null }).eq('id', osId);
    },

    async updateOSTecnico(osId: string, tecnicoId: string) {
      await db.from('ordens_servico').update({ tecnico_id: tecnicoId, aceite_tecnico: 'pendente', aceite_at: null, motivo_recusa: null }).eq('id', osId);
    },

    async getTecnicoUserId(tecnicoId: string): Promise<string | null> {
      const { data } = await db.from('tecnicos').select('profiles!inner(user_id)').eq('id', tecnicoId).single();
      return (data as Record<string, Record<string, string>> | null)?.profiles?.user_id || null;
    },

    async findTecnicoByEmail(email: string): Promise<{ id: string; profiles: { email: string; user_id: string } } | null> {
      const { data } = await db.from('tecnicos').select('id, profiles!inner(email, user_id)').ilike('profiles.email', email).maybeSingle();
      return data as { id: string; profiles: { email: string; user_id: string } } | null;
    },

    async getPrestador(id: string): Promise<{ email: string; nome: string } | null> {
      const { data } = await db.from('prestadores').select('email, nome').eq('id', id).single();
      return data;
    },

    async generateOS(ticketId: string) {
      const { data, error } = await db.functions.invoke('gerar-ordem-servico', { body: { ticketId } });
      if (error) throw error;
      return data as { message?: string; pdfUrl?: string } | null;
    },

    async getLinkedRME(ticketId: string): Promise<Array<{ id: string }>> {
      const { data } = await db.from('rme_relatorios').select('id').eq('ticket_id', ticketId);
      return data || [];
    },

    async getSignedPdfUrl(pdfPath: string): Promise<string | null> {
      const filePath = pdfPath.replace('ordens-servico/', '');
      const { data, error } = await db.storage.from('ordens-servico').createSignedUrl(filePath, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data?.signedUrl || null;
    },
  };
};

export const ticketService = createTicketService();
