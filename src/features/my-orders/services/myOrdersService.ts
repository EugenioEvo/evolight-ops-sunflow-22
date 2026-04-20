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
          tickets!inner (id, numero_ticket, titulo, descricao, endereco_servico, prioridade, status, data_inicio_execucao,
            clientes (empresa, endereco, cidade, estado, profiles!clientes_profile_id_fkey(telefone)))`)
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
     * Used by the UI to block "Iniciar Execução" while sibling OS are undecided.
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
    }
  };
};

export const myOrdersService = createMyOrdersService();
