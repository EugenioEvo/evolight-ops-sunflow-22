import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';

export const createMyOrdersService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async loadOrdensServico(profileId: string | undefined, isTecnico: boolean) {
      let query = db
        .from("ordens_servico")
        .select(`*, data_programada, hora_inicio, hora_fim, equipe, servico_solicitado, inspetor_responsavel, tipo_trabalho,
          rme_relatorios (id, status),
          tickets!inner (id, numero_ticket, titulo, descricao, endereco_servico, prioridade, status, data_inicio_execucao, tecnico_responsavel_id,
            clientes (empresa, endereco, cidade, estado, profiles!clientes_profile_id_fkey(telefone)),
            prestadores:tecnico_responsavel_id (id, email))`)
        .order("data_emissao", { ascending: false });

      if (isTecnico) {
        const { data: tecnicoData, error: tecnicoError } = await db
          .from("tecnicos").select("id").eq("profile_id", profileId).single();
        if (tecnicoError) {
          throw new Error("Seu usuário não está vinculado a um perfil de técnico. Solicite à área técnica o cadastro do seu usuário como técnico ou ajuste o e-mail.");
        }
        query = query.eq("tecnico_id", tecnicoData.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Normalize rme_relatorios into an array (1-1 relation may come back as object)
      const normalized = (data || []).map((row: any) => ({
        ...row,
        rme_relatorios: Array.isArray(row.rme_relatorios)
          ? row.rme_relatorios
          : row.rme_relatorios
            ? [row.rme_relatorios]
            : [],
      }));

      // Sibling RME enrichment: surface the shared RME (filled by the responsible
      // technician on behalf of the team) on every OS of the same ticket so each
      // technician sees the current status of the team's report.
      const ticketIdsMissingRme = Array.from(new Set(
        normalized
          .filter((os: any) => !os.rme_relatorios.length && os.ticket_id)
          .map((os: any) => os.ticket_id)
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
        normalized.forEach((os: any) => {
          if (!os.rme_relatorios.length) {
            const shared = byTicket.get(os.ticket_id);
            if (shared) os.rme_relatorios = [shared];
          }
        });
      }

      return normalized;
    },

    async iniciarExecucao(ticketId: string) {
      // Technicians may start execution independently (they often work on different shifts/times).
      // The guard that prevents finalizing the RME while sibling OS are undecided lives in the
      // RME submission flow — see `checkRMESubmissionAllowed`.
      const { error } = await db.from("tickets").update({
        status: "em_execucao", data_inicio_execucao: new Date().toISOString()
      }).eq("id", ticketId);
      if (error) {
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          throw new Error("Você não tem permissão para alterar o status deste ticket. Fale com o administrador.");
        }
        throw error;
      }
    },

    /**
     * For each ticket_id, return how many OS are still 'pendente' for technician acceptance.
     * Used by the RME Wizard to block submission (rascunho → pendente) while sibling OS are undecided.
     */
    async loadPendingAcceptanceByTicket(ticketIds: string[]): Promise<Record<string, number>> {
      if (!ticketIds.length) return {};
      const { data, error } = await db
        .from("ordens_servico")
        .select("ticket_id, aceite_tecnico")
        .in("ticket_id", ticketIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const aceite = row.aceite_tecnico || 'pendente';
        if (aceite === 'pendente') {
          map[row.ticket_id] = (map[row.ticket_id] || 0) + 1;
        }
      });
      return map;
    },

    /**
     * Returns the list of sibling OS (numero_os) on the same ticket that are still awaiting
     * technician acceptance. The responsible technician can only submit the RME once this list is empty.
     */
    async getPendingAcceptanceSiblings(ticketId: string): Promise<{ id: string; numero_os: string }[]> {
      const { data, error } = await db
        .from("ordens_servico")
        .select("id, numero_os, aceite_tecnico")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return (data || [])
        .filter((r: any) => (r.aceite_tecnico || 'pendente') === 'pendente')
        .map((r: any) => ({ id: r.id, numero_os: r.numero_os }));
    }
  };
};

export const myOrdersService = createMyOrdersService();
