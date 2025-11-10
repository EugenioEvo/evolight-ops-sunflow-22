import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

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
      // Buscar dados atuais da OS para saber se é update ou create
      const { data: currentOS } = await supabase
        .from('ordens_servico')
        .select('data_programada, hora_inicio, hora_fim')
        .eq('id', params.osId)
        .single();

      const isUpdate = currentOS?.data_programada && currentOS?.hora_inicio && currentOS?.hora_fim;

      // Verificar conflito
      const hasConflict = await checkConflict(
        params.tecnicoId,
        params.data,
        params.horaInicio,
        params.horaFim,
        params.osId
      );

      if (hasConflict) {
        toast({
          title: 'Conflito de agenda',
          description: 'Já existe uma OS agendada para este técnico neste horário',
          variant: 'destructive'
        });
        return false;
      }

      // Agendar/Reagendar OS
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          data_programada: params.data.toISOString(),
          hora_inicio: params.horaInicio,
          hora_fim: params.horaFim,
          duracao_estimada_min: params.duracaoMin
        })
        .eq('id', params.osId);

      if (error) throw error;

      // Enviar convite de calendário (create ou update)
      try {
        await supabase.functions.invoke('send-calendar-invite', {
          body: {
            os_id: params.osId,
            action: isUpdate ? 'update' : 'create'
          }
        });
        
        toast({
          title: isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado',
          description: `OS ${isUpdate ? 'reagendada' : 'agendada'} para ${format(params.data, 'dd/MM/yyyy')} às ${params.horaInicio}. Convites enviados!`
        });
      } catch (emailError) {
        console.error('Erro ao enviar convite:', emailError);
        toast({
          title: isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado',
          description: 'OS atualizada, mas não foi possível enviar convite por email',
          variant: 'default'
        });
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao agendar OS:', error);
      toast({
        title: 'Erro ao agendar',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { scheduleOS, checkConflict, loading };
};
