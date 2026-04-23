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
        .select(`*, ordens_servico(numero_os, id, pdf_url, aceite_tecnico, motivo_recusa, tecnico_id, data_programada, tecnicos:tecnico_id(profiles(nome, email)), rme_relatorios(id, status)), clientes(empresa, endereco, cidade, estado, cep, prioridade, cliente_ufvs(nome), profiles(nome, email)), prestadores:tecnico_responsavel_id(id, nome, email)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Derive ufv_solarz (legacy field name) from related cliente_ufvs.nome list
      (data || []).forEach((t: any) => {
        if (t.clientes) {
          const ufvs = Array.isArray(t.clientes.cliente_ufvs) ? t.clientes.cliente_ufvs : [];
          const names = ufvs.map((u: any) => u?.nome).filter(Boolean);
          t.clientes.ufv_solarz = names.length ? names.join(', ') : null;
        }
      });
      return (data || []) as unknown as TicketWithRelations[];
    },

    async loadClientes(): Promise<TicketCliente[]> {
      const { data, error } = await db
        .from('clientes')
        .select(`id, empresa, endereco, cidade, estado, cep, cnpj_cpf, prioridade, cliente_ufvs(nome), profiles(nome, email, telefone)`);
      if (error) throw error;
      // Derive ufv_solarz from related cliente_ufvs.nome list
      const rows = (data || []).map((c: any) => {
        const ufvs = Array.isArray(c.cliente_ufvs) ? c.cliente_ufvs : [];
        const names = ufvs.map((u: any) => u?.nome).filter(Boolean);
        return { ...c, ufv_solarz: names.length ? names.join(', ') : null };
      });
      return rows as unknown as TicketCliente[];
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

    /**
     * Tickets are the source of truth for OS/RME and must NEVER be hard-deleted.
     * Use `cancel` instead — it sets status='cancelado' and cascades to linked OS.
     * Kept here only as a guarded fallback (will throw to surface accidental usage).
     */
    async delete(_id: string) {
      throw new Error('Tickets não podem ser excluídos. Use cancelTicket.');
    },

    /**
     * Cancel a ticket and cascade-cancel all linked OS that are not already
     * concluded/cancelled. Blocks if there is at least one RME in 'rascunho'
     * for this ticket (the report is mid-edit and would lose context).
     * Returns the list of cancelled OS so the caller can fan out notifications.
     */
    async cancel(ticketId: string): Promise<{ cancelledOS: LinkedOS[] }> {
      // 1) Block if any RME draft exists for this ticket
      const { data: drafts, error: rmeErr } = await db
        .from('rme_relatorios')
        .select('id, status')
        .eq('ticket_id', ticketId)
        .eq('status', 'rascunho');
      if (rmeErr) throw rmeErr;
      if ((drafts || []).length > 0) {
        throw new Error(
          'Existe pelo menos 1 RME em rascunho para este ticket. Conclua ou exclua o RME antes de cancelar o ticket.'
        );
      }

      // 2) Fetch linked OS (with current ticket status semantics) to cascade
      const { data: linked, error: osErr } = await db
        .from('ordens_servico')
        .select('id, numero_os, tecnico_id, tickets:ticket_id(status)')
        .eq('ticket_id', ticketId);
      if (osErr) throw osErr;

      const cancellable = (linked || []).filter((os: any) => {
        const tStatus = os?.tickets?.status;
        return tStatus !== 'concluido' && tStatus !== 'cancelado';
      });

      // 3) Clear scheduling fields on each cancellable OS so the slot is freed
      if (cancellable.length > 0) {
        await db
          .from('ordens_servico')
          .update({
            data_programada: null,
            hora_inicio: null,
            hora_fim: null,
            duracao_estimada_min: null,
          })
          .in('id', cancellable.map((os: any) => os.id));
      }

      // 4) Flip ticket → cancelado (cascades visually to all OS via getOSStatus)
      const { error: updErr } = await db
        .from('tickets')
        .update({ status: 'cancelado', data_conclusao: null })
        .eq('id', ticketId);
      if (updErr) throw updErr;

      return {
        cancelledOS: cancellable.map((os: any) => ({
          id: os.id,
          numero_os: os.numero_os,
          tecnico_id: os.tecnico_id,
        })),
      };
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
