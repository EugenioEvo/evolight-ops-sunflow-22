import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface TechnicianAvailability {
  prestadorId: string;
  tecnicoId: string | null;
  available: boolean;
  conflictDetails?: string;
}

export const useTechnicianAvailability = () => {
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, TechnicianAvailability>>(new Map());
  const [loading, setLoading] = useState(false);

  const checkAvailability = useCallback(async (
    prestadores: Array<{ id: string; email: string }>,
    date: string,
    startTime: string,
    endTime: string,
    excludeOsId?: string
  ) => {
    if (!date || !startTime || !endTime || prestadores.length === 0) {
      setAvailabilityMap(new Map());
      return;
    }

    setLoading(true);
    const newMap = new Map<string, TechnicianAvailability>();

    try {
      // Batch: get all tecnicos by email
      const emails = prestadores.map(p => p.email?.toLowerCase()).filter(Boolean);
      
      const { data: tecnicos } = await supabase
        .from('tecnicos')
        .select('id, profiles!inner(email)')
        .in('profiles.email', emails);

      const tecnicoByEmail = new Map<string, string>();
      (tecnicos || []).forEach((t: any) => {
        tecnicoByEmail.set(t.profiles.email.toLowerCase(), t.id);
      });

      // Check conflicts for each tecnico
      for (const prestador of prestadores) {
        const tecnicoId = tecnicoByEmail.get(prestador.email?.toLowerCase()) || null;
        
        if (!tecnicoId) {
          newMap.set(prestador.id, {
            prestadorId: prestador.id,
            tecnicoId: null,
            available: true, // Can't check without tecnico mapping
          });
          continue;
        }

        const { data: hasConflict } = await supabase.rpc('check_schedule_conflict', {
          p_tecnico_id: tecnicoId,
          p_data: date,
          p_hora_inicio: startTime,
          p_hora_fim: endTime,
          p_os_id: excludeOsId || null,
        });

        let conflictDetails: string | undefined;
        if (hasConflict) {
          const { data: conflictOS } = await supabase
            .from('ordens_servico')
            .select('numero_os, hora_inicio, hora_fim')
            .eq('tecnico_id', tecnicoId)
            .eq('data_programada', date)
            .not('hora_inicio', 'is', null)
            .not('hora_fim', 'is', null);

          if (conflictOS && conflictOS.length > 0) {
            conflictDetails = conflictOS
              .map(os => `${os.numero_os} (${os.hora_inicio}-${os.hora_fim})`)
              .join(', ');
          }
        }

        newMap.set(prestador.id, {
          prestadorId: prestador.id,
          tecnicoId,
          available: !hasConflict,
          conflictDetails,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
    } finally {
      setAvailabilityMap(newMap);
      setLoading(false);
    }
  }, []);

  return { availabilityMap, checkAvailability, loading };
};
