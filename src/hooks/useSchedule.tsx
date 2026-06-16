import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ScheduleParams {
  osId: string;
  tecnicoId: string;
  data: Date;
  horaInicio: string;
  horaFim: string;
  duracaoMin?: number;
}

export const useSchedule = () => {
  const [loading, setLoading] = useState(false);

  const checkConflict = async (
    tecnicoId: string,
    data: Date,
    horaInicio: string,
    horaFim: string,
    osId?: string
  ): Promise<boolean> => {
    try {
      const { data: result, error } = await supabase.rpc('check_schedule_conflict', {
        p_tecnico_id: tecnicoId,
        p_data: format(data, 'yyyy-MM-dd'),
        p_hora_inicio: horaInicio,
        p_hora_fim: horaFim,
        p_os_id: osId || null
      });

      if (error) throw error;
      return result as boolean;
    } catch (error) {
      console.error('Erro ao verificar conflito:', error);
      return false;
    }
  };

  const scheduleOS = async (params: ScheduleParams): Promise<boolean> => {
    setLoading(true);
    try {
      // ===== VALIDAÇÕES PRÉ-AGENDAMENTO =====

      // 1. Buscar dados atuais da OS
      const { data: currentOS, error: fetchError } = await supabase
        .from('ordens_servico')
        .select(`
          id,
          data_programada, 
          hora_inicio, 
          hora_fim,
          aceite_tecnico,
          tickets!inner(status)
        `)
        .eq('id', params.osId)
        .single();

      if (fetchError) throw fetchError;

      const isUpdate = currentOS?.data_programada && currentOS?.hora_inicio && currentOS?.hora_fim;
      const wasRejected = (currentOS as any)?.aceite_tecnico === 'recusado';

      // 2. Validar data futura apenas para novo agendamento.
      // Reagendamentos/ajustes históricos precisam permitir corrigir OS já criada.
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataAgendamento = new Date(params.data);
      dataAgendamento.setHours(0, 0, 0, 0);
      if (!isUpdate && dataAgendamento < hoje) {
        toast.error('Data inválida', {
          description: 'Não é possível agendar para uma data passada'
        });
        return false;
      }

      // 3. Validar se OS não está concluída
      if (currentOS.tickets.status === 'concluido') {
        toast.error('OS já concluída', {
          description: 'Não é possível agendar uma OS já concluída'
        });
        return false;
      }

      // 4. Buscar email do técnico
      const { data: tecnicoData, error: tecnicoError } = await supabase
        .from('tecnicos')
        .select('profiles!inner(email)')
        .eq('id', params.tecnicoId)
        .single();

      if (tecnicoError) throw tecnicoError;

      const tecnicoEmail = tecnicoData?.profiles?.email;
      const hasEmail = !!tecnicoEmail;

      // ===== VERIFICAR CONFLITO =====
      const hasConflict = await checkConflict(
        params.tecnicoId,
        params.data,
        params.horaInicio,
        params.horaFim,
        params.osId
      );

      if (hasConflict) {
        toast.error('Conflito de agenda', {
          description: 'Já existe uma OS agendada para este técnico neste horário'
        });
        return false;
      }

      // ===== SALVAR AGENDAMENTO =====
      const { data: updatedOS, error: updateError } = await supabase
        .from('ordens_servico')
        .update({
          data_programada: params.data.toISOString(),
          hora_inicio: params.horaInicio,
          hora_fim: params.horaFim,
          duracao_estimada_min: params.duracaoMin,
          // Resetar calendar_invite_sent_at para indicar que precisa enviar novo
          calendar_invite_sent_at: null,
          // Resetar aceite para que o técnico precise aceitar novamente
          aceite_tecnico: 'pendente',
          aceite_at: null,
          motivo_recusa: null,
        } as any)
        .eq('id', params.osId)
        .select('id')
        .single();

      if (updateError) throw updateError;
      if (!updatedOS?.id) throw new Error('Nenhuma OS foi atualizada. Verifique suas permissões e tente novamente.');

      // ===== ENVIAR CONVITE (SE TÉCNICO TEM EMAIL) =====
      if (hasEmail) {
        try {
          const inviteAction = wasRejected ? 'rejection_reschedule' : isUpdate ? 'update' : 'create';
          const { error: inviteError } = await supabase.functions.invoke('send-calendar-invite', {
            body: {
              os_id: params.osId,
              action: inviteAction
            }
          });

          if (inviteError) throw inviteError;
          
          toast.success(isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado', {
            description: `OS ${isUpdate ? 'reagendada' : 'agendada'} para ${format(params.data, 'dd/MM/yyyy')} às ${params.horaInicio}. Convites enviados!`
          });
        } catch (emailError: any) {
          console.error('Erro ao enviar convite:', emailError);
          // Registrar erro no log da OS
          try {
            const { data: currentOS } = await supabase
              .from('ordens_servico')
              .select('email_error_log')
              .eq('id', params.osId)
              .single();

            const errorLog: any[] = Array.isArray(currentOS?.email_error_log) 
              ? currentOS.email_error_log 
              : [];
            
            errorLog.push({
              timestamp: new Date().toISOString(),
              type: 'calendar_invite',
              action: isUpdate ? 'update' : 'create',
              error: emailError.message || 'Falha ao enviar convite de calendário',
              details: emailError.toString()
            });

            await supabase
              .from('ordens_servico')
              .update({ email_error_log: errorLog })
              .eq('id', params.osId);
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }

          toast(isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado', {
            description: 'OS atualizada com sucesso. Falha ao enviar email - você pode reenviar depois.',
          });
        }
      } else {
        // Técnico sem email - apenas confirmar agendamento
        toast(isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado', {
          description: `OS ${isUpdate ? 'reagendada' : 'agendada'} para ${format(params.data, 'dd/MM/yyyy')} às ${params.horaInicio}. Técnico sem email cadastrado.`,
        });
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao agendar OS:', error);
      toast.error('Erro ao agendar', {
        description: error.message,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { scheduleOS, checkConflict, loading };
};
