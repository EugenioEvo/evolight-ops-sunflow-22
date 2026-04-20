import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ticketService } from '../services/ticketService';
import { notifyReassignRemoved, notifyNewAssignment, notifyTicketAltered, notifyTicketDecision, notifyTicketCancelled } from '@/shared/services/notificationStrategies';
import type { TicketFormData, TicketWithRelations, TicketPrestador } from '../types';

export const useTicketMutations = (loadData: () => Promise<void>) => {
  const [loading, setLoading] = useState(false);
  const [generatingOsId, setGeneratingOsId] = useState<string | null>(null);
  const [reprocessingTicketId, setReprocessingTicketId] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const { handleError } = useErrorHandler();

  const createTicket = async (data: TicketFormData, technicianId: string | null, attachments: string[]) => {
    setLoading(true);
    try {
      if (data.data_servico && data.data_vencimento) {
        const servico = new Date(data.data_servico);
        const vencimento = new Date(data.data_vencimento);
        if (servico > vencimento) {
          toast.warning(`A data de serviço (${servico.toLocaleDateString('pt-BR')}) é posterior à data de vencimento limite (${vencimento.toLocaleDateString('pt-BR')}).`);
        }
      }

      await ticketService.create({
        titulo: data.titulo,
        descricao: data.descricao,
        cliente_id: data.cliente_id,
        equipamento_tipo: data.equipamento_tipo,
        prioridade: data.prioridade,
        endereco_servico: data.endereco_servico,
        numero_ticket: '',
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        horario_previsto_inicio: data.horario_previsto_inicio || null,
        observacoes: data.observacoes || null,
        created_by: user?.id || '',
        tecnico_responsavel_id: technicianId || null,
        anexos: attachments,
        status: 'aberto',
      });
      toast.success('Ticket criado aguardando aprovação!');
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (editingTicket: TicketWithRelations, data: TicketFormData, technicianId: string | null, attachments: string[]) => {
    setLoading(true);
    try {
      const addressChanged =
        (data.endereco_servico || '').trim() !== (editingTicket.endereco_servico || '').trim();

      const ticketData: any = {
        ...data,
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        tecnico_responsavel_id: technicianId || null,
        anexos: attachments,
        status: 'aberto' as const,
      };

      // Address changed → clear geolocation so it gets re-geocoded
      if (addressChanged) {
        ticketData.latitude = null;
        ticketData.longitude = null;
        ticketData.geocoded_at = null;
        ticketData.geocoding_status = 'pending';
      }

      const criticalChanged =
        (data.data_servico || null) !== (editingTicket.data_servico || null) ||
        (data.horario_previsto_inicio || null) !== (editingTicket.horario_previsto_inicio || null) ||
        data.equipamento_tipo !== editingTicket.equipamento_tipo;

      await ticketService.update(editingTicket.id, ticketData);

      if (criticalChanged) {
        const linkedOS = await ticketService.getLinkedOS(editingTicket.id);
        // Parallelize: reset aceite + notify for all linked OS
        await Promise.all(
          linkedOS.map(async (os) => {
            await ticketService.resetOSAceite(os.id);
            await notifyTicketAltered(os);
          })
        );
      }

      toast.success(addressChanged ? 'Ticket atualizado. Geolocalização será recalculada.' : 'Ticket atualizado com sucesso!');
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const approveTicket = async (ticketId: string, observacoes?: string) => {
    setLoading(true);
    try {
      await ticketService.approve(ticketId, profile?.id || '', observacoes);
      // Fire-and-forget creator notification (in-app + email)
      notifyTicketDecision(ticketId, 'aprovado', observacoes).catch((e) =>
        console.warn('notifyTicketDecision approved failed:', e)
      );
      toast.success('Ticket aprovado. Criador notificado.');
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao aprovar ticket' });
    } finally {
      setLoading(false);
    }
  };

  const rejectTicket = async (ticketId: string, observacoes?: string) => {
    setLoading(true);
    try {
      await ticketService.reject(ticketId, profile?.id || '', observacoes);
      notifyTicketDecision(ticketId, 'rejeitado', observacoes).catch((e) =>
        console.warn('notifyTicketDecision rejected failed:', e)
      );
      toast.success('Ticket rejeitado. Criador notificado.');
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao rejeitar ticket' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Tickets are the source of truth and can never be hard-deleted.
   * Cancelling a ticket cascades cancellation to every linked OS that is
   * not already concluded/cancelled. Blocked if any RME draft exists.
   */
  const cancelTicket = async (ticketId: string, motivo?: string) => {
    setLoading(true);
    try {
      const { cancelledOS } = await ticketService.cancel(ticketId);

      // Fire-and-forget cascade notifications: calendar CANCEL + cancellation emails per OS
      await Promise.all(
        cancelledOS.map(async (os) => {
          try {
            // Cancel calendar invite to assigned technician
            await import('@/shared/services/notificationService').then(({ notificationService }) =>
              notificationService.sendCalendarInvite(os.id, 'cancel')
            );
          } catch (e) {
            console.warn('cancelTicket calendar cancel failed:', e);
          }
          // Notify the OS/ticket creator (in-app + email) — generic OS cancellation
          const { notifyOSCancelled } = await import('@/shared/services/notificationStrategies');
          notifyOSCancelled(os.id, motivo).catch((e) =>
            console.warn('notifyOSCancelled failed (non-blocking):', e)
          );
          // Notify ticket cancellation specifically (in-app + email com texto de cancelamento de TICKET)
          notifyTicketCancelled(os).catch((e) =>
            console.warn('notifyTicketCancelled failed (non-blocking):', e)
          );
        })
      );

      const cascadedMsg =
        cancelledOS.length > 0
          ? ` ${cancelledOS.length} OS vinculada(s) também foram canceladas.`
          : '';
      toast.success(`Ticket cancelado com sucesso.${cascadedMsg}`);
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao cancelar ticket' });
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async (ticketId: string, technicianId: string, tickets: TicketWithRelations[], prestadores: TicketPrestador[]) => {
    try {
      if (!technicianId) {
        toast.error('Selecione um técnico');
        return;
      }

      const ticket = tickets.find(t => t.id === ticketId);
      const oldPrestadorId = ticket?.tecnico_responsavel_id;
      const isReassignment = oldPrestadorId && oldPrestadorId !== technicianId;

      // On reassignment, reset ticket acceptance to 'pendente' so new tech must accept
      if (isReassignment) {
        await ticketService.update(ticketId, {
          tecnico_responsavel_id: technicianId,
          aceite_tecnico: 'pendente',
        } as any);
      } else {
        await ticketService.assignTechnician(ticketId, technicianId);
      }

      const prestador = await ticketService.getPrestador(technicianId);
      if (prestador?.email) {
        const tecnico = await ticketService.findTecnicoByEmail(prestador.email);
        if (tecnico) {
          const linkedOS = await ticketService.getLinkedOS(ticketId);

          await Promise.all(
            linkedOS.map(async (os) => {
              const oldTecnicoId = os.tecnico_id;

              if (isReassignment && oldTecnicoId && oldTecnicoId !== tecnico.id) {
                await notifyReassignRemoved(os, oldTecnicoId);
              }

              await ticketService.updateOSTecnico(os.id, tecnico.id);
              await notifyNewAssignment(os, tecnico.profiles?.user_id);
            })
          );
        }
      }

      toast.success(isReassignment ? 'Técnico reatribuído. O novo técnico precisa aceitar o ticket e a OS.' : 'Técnico atribuído com sucesso.');

      const prestadorAssigned = prestadores.find(p => p.id === technicianId);
      if (prestadorAssigned && (!prestadorAssigned.email || prestadorAssigned.email.trim() === '')) {
        toast.warning('Este técnico não possui email cadastrado. Atualize o cadastro antes de gerar a OS.');
      }

      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao atribuir técnico' });
    }
  };

  const generateOS = async (ticketId: string, tickets: TicketWithRelations[], prestadores: TicketPrestador[]) => {
    setGeneratingOsId(ticketId);
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket?.tecnico_responsavel_id) {
        const prestador = prestadores.find(p => p.id === ticket.tecnico_responsavel_id);
        if (prestador && (!prestador.email || prestador.email.trim() === '')) {
          toast.error('Não é possível gerar a OS. Atualize o email do técnico na página de Prestadores.');
          return null;
        }
      }

      const data = await ticketService.generateOS(ticketId);
      const isExisting = data?.message === 'Ordem de serviço já existente';
      toast.success(isExisting ? 'Ordem de serviço já foi gerada anteriormente!' : 'Ordem de serviço gerada com sucesso!');

      if (data?.pdfUrl) window.open(data.pdfUrl, '_blank');
      await loadData();
      return data;
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao gerar ordem de serviço' });
      return null;
    } finally {
      setGeneratingOsId(null);
    }
  };

  return {
    loading, setLoading, generatingOsId, reprocessingTicketId, setReprocessingTicketId,
    createTicket, updateTicket, approveTicket, rejectTicket, cancelTicket, assignTechnician, generateOS,
  };
};
