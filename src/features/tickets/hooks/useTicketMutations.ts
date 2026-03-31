import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ticketService } from '../services/ticketService';
import type { TicketFormData } from '../types';

export const useTicketMutations = (loadData: () => Promise<void>) => {
  const [loading, setLoading] = useState(false);
  const [generatingOsId, setGeneratingOsId] = useState<string | null>(null);
  const [reprocessingTicketId, setReprocessingTicketId] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const createTicket = async (data: TicketFormData, technicianId: string | null, attachments: string[]) => {
    setLoading(true);
    try {
      if (data.data_servico && data.data_vencimento) {
        const servico = new Date(data.data_servico);
        const vencimento = new Date(data.data_vencimento);
        if (servico > vencimento) {
          toast({
            title: '⚠️ Atenção: Data de serviço após o vencimento',
            description: `A data de serviço (${servico.toLocaleDateString('pt-BR')}) é posterior à data de vencimento limite (${vencimento.toLocaleDateString('pt-BR')}).`,
            variant: 'destructive',
          });
        }
      }

      const ticketData = {
        ...data,
        tempo_estimado: data.tempo_estimado || null,
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        created_by: user?.id,
        tecnico_responsavel_id: technicianId || null,
        anexos: attachments,
        status: 'aberto',
      };

      await ticketService.create(ticketData);
      toast({ title: 'Sucesso', description: 'Ticket criado aguardando aprovação!' });
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (editingTicket: any, data: TicketFormData, technicianId: string | null, attachments: string[]) => {
    setLoading(true);
    try {
      const ticketData = {
        ...data,
        tempo_estimado: data.tempo_estimado || null,
        data_servico: data.data_servico || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        created_by: user?.id,
        tecnico_responsavel_id: technicianId || null,
        anexos: attachments,
        status: 'aberto',
      };

      const criticalChanged =
        (data.data_servico || null) !== (editingTicket.data_servico || null) ||
        (data.horario_previsto_inicio || null) !== (editingTicket.horario_previsto_inicio || null) ||
        data.equipamento_tipo !== editingTicket.equipamento_tipo;

      await ticketService.update(editingTicket.id, ticketData);

      if (criticalChanged) {
        const linkedOS = await ticketService.getLinkedOS(editingTicket.id);
        for (const os of linkedOS) {
          await ticketService.resetOSAceite(os.id);
          if (os.tecnico_id) {
            const tecUserId = await ticketService.getTecnicoUserId(os.tecnico_id);
            if (tecUserId) {
              await ticketService.sendNotification(
                tecUserId,
                'os_alterada',
                'Ticket Alterado — Aceite Necessário',
                `O ticket vinculado à OS ${os.numero_os} foi alterado (data, horário ou tipo de serviço). Você precisa aceitar novamente.`,
                '/minhas-os'
              );
            }
          }
        }
      }

      toast({ title: 'Sucesso', description: 'Ticket atualizado com sucesso!' });
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const approveTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      await ticketService.approve(ticketId, profile?.id || '');
      toast({ title: 'Sucesso', description: 'Ticket aprovado. Agora pode atribuir um técnico.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao aprovar ticket', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const rejectTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      await ticketService.reject(ticketId, profile?.id || '');
      toast({ title: 'Sucesso', description: 'Ticket rejeitado' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao rejeitar ticket', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteTicket = async (ticketId: string, tickets: any[]) => {
    setLoading(true);
    try {
      const [osData, rmeData] = await Promise.all([
        ticketService.getLinkedOS(ticketId),
        ticketService.getLinkedRME(ticketId),
      ]);

      if (osData.length > 0 || rmeData.length > 0) {
        const parts = [];
        if (osData.length > 0) parts.push(`${osData.length} OS`);
        if (rmeData.length > 0) parts.push(`${rmeData.length} RME`);

        for (const os of osData) {
          if (os.tecnico_id) {
            const tecUserId = await ticketService.getTecnicoUserId(os.tecnico_id);
            if (tecUserId) {
              await ticketService.sendNotification(
                tecUserId, 'ticket_excluido', 'Ticket Excluído',
                `O ticket vinculado à OS ${os.numero_os} foi excluído pelo gestor. A OS será removida.`,
                '/minhas-os'
              );
            }
          }
        }

        toast({
          title: 'Não é possível excluir',
          description: `Este ticket possui ${parts.join(' e ')} vinculado(s). Remova-os antes de excluir o ticket.`,
          variant: 'destructive',
        });
        return;
      }

      await ticketService.delete(ticketId);
      toast({ title: 'Sucesso', description: 'Ticket excluído com sucesso' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir ticket', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async (ticketId: string, technicianId: string, tickets: any[], prestadores: any[]) => {
    try {
      if (!technicianId) {
        toast({ title: 'Erro', description: 'Selecione um técnico', variant: 'destructive' });
        return;
      }

      const ticket = tickets.find((t: any) => t.id === ticketId);
      const oldPrestadorId = ticket?.tecnico_responsavel_id;
      const isReassignment = oldPrestadorId && oldPrestadorId !== technicianId;

      await ticketService.assignTechnician(ticketId, technicianId);

      const prestador = await ticketService.getPrestador(technicianId);
      if (prestador?.email) {
        const tecnico = await ticketService.findTecnicoByEmail(prestador.email);
        if (tecnico) {
          const linkedOS = await ticketService.getLinkedOS(ticketId);
          for (const os of linkedOS) {
            const oldTecnicoId = os.tecnico_id;

            if (isReassignment && oldTecnicoId && oldTecnicoId !== tecnico.id) {
              try {
                await ticketService.sendCalendarInvite(os.id, 'reassign_removed');
              } catch (e) {
                console.error('Erro ao enviar email de reatribuição:', e);
              }

              const oldTecUserId = await ticketService.getTecnicoUserId(oldTecnicoId);
              if (oldTecUserId) {
                await ticketService.sendNotification(
                  oldTecUserId, 'os_reatribuida', 'OS Reatribuída',
                  `A OS ${os.numero_os} foi reatribuída a outro técnico.`,
                  '/minhas-os'
                );
              }
            }

            await ticketService.updateOSTecnico(os.id, tecnico.id);

            if (isReassignment) {
              try {
                await ticketService.sendCalendarInvite(os.id, 'create');
              } catch (e) {
                console.error('Erro ao enviar email ao novo técnico:', e);
              }

              const newTecUserId = (tecnico as any)?.profiles?.user_id;
              if (newTecUserId) {
                await ticketService.sendNotification(
                  newTecUserId, 'os_atribuida', 'Nova OS Atribuída',
                  `A OS ${os.numero_os} foi atribuída a você.`,
                  '/minhas-os'
                );
              }
            }
          }
        }
      }

      toast({
        title: 'Sucesso',
        description: isReassignment
          ? 'Técnico reatribuído. Ambos os técnicos foram notificados.'
          : 'Técnico atribuído com sucesso.',
      });

      const prestadorAssigned = prestadores.find((p: any) => p.id === technicianId);
      if (prestadorAssigned && (!prestadorAssigned.email || prestadorAssigned.email.trim() === '')) {
        toast({
          title: '⚠️ Atenção: Técnico sem email',
          description: 'Este técnico não possui email cadastrado. Atualize o cadastro do prestador antes de gerar a OS.',
          variant: 'destructive',
        });
      }

      await loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao atribuir técnico', variant: 'destructive' });
    }
  };

  const generateOS = async (ticketId: string, tickets: any[], prestadores: any[]) => {
    setGeneratingOsId(ticketId);
    try {
      const ticket = tickets.find((t: any) => t.id === ticketId);
      if (ticket?.tecnico_responsavel_id) {
        const prestador = prestadores.find((p: any) => p.id === ticket.tecnico_responsavel_id);
        if (prestador && (!prestador.email || prestador.email.trim() === '')) {
          toast({
            title: '❌ Técnico sem email cadastrado',
            description: 'Não é possível gerar a OS. Atualize o email do técnico na página de Prestadores antes de continuar.',
            variant: 'destructive',
          });
          return null;
        }
      }

      const data = await ticketService.generateOS(ticketId);
      const isExisting = data?.message === 'Ordem de serviço já existente';

      toast({
        title: 'Sucesso',
        description: isExisting
          ? 'Ordem de serviço já foi gerada anteriormente!'
          : 'Ordem de serviço gerada com sucesso!',
      });

      if (data?.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }

      await loadData();
      return data;
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar ordem de serviço', variant: 'destructive' });
      return null;
    } finally {
      setGeneratingOsId(null);
    }
  };

  return {
    loading,
    setLoading,
    generatingOsId,
    reprocessingTicketId,
    setReprocessingTicketId,
    createTicket,
    updateTicket,
    approveTicket,
    rejectTicket,
    deleteTicket,
    assignTechnician,
    generateOS,
  };
};
