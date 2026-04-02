import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ticketService } from '../services/ticketService';
import { notifyReassignRemoved, notifyNewAssignment, notifyTicketAltered, notifyTicketDeleted } from '@/shared/services/notificationStrategies';
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
        tempo_estimado: data.tempo_estimado || null,
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
      const ticketData = {
        ...data,
        tempo_estimado: data.tempo_estimado || null,
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        tecnico_responsavel_id: technicianId || null,
        anexos: attachments,
        status: 'aberto' as const,
      };

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

      toast.success('Ticket atualizado com sucesso!');
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const approveTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      await ticketService.approve(ticketId, profile?.id || '');
      toast.success('Ticket aprovado. Agora pode atribuir um técnico.');
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao aprovar ticket' });
    } finally {
      setLoading(false);
    }
  };

  const rejectTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      await ticketService.reject(ticketId, profile?.id || '');
      toast.success('Ticket rejeitado');
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao rejeitar ticket' });
    } finally {
      setLoading(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      const [osData, rmeData] = await Promise.all([
        ticketService.getLinkedOS(ticketId),
        ticketService.getLinkedRME(ticketId),
      ]);

      if (osData.length > 0 || rmeData.length > 0) {
        const parts: string[] = [];
        if (osData.length > 0) parts.push(`${osData.length} OS`);
        if (rmeData.length > 0) parts.push(`${rmeData.length} RME`);

        // Parallelize all deletion notifications
        await Promise.all(osData.map(os => notifyTicketDeleted(os)));

        toast.error(`Este ticket possui ${parts.join(' e ')} vinculado(s). Remova-os antes de excluir o ticket.`);
        return;
      }

      await ticketService.delete(ticketId);
      toast.success('Ticket excluído com sucesso');
      await loadData();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao excluir ticket' });
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
    createTicket, updateTicket, approveTicket, rejectTicket, deleteTicket, assignTechnician, generateOS,
  };
};
