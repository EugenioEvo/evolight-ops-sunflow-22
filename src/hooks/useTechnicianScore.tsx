import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const EQUIPMENT_SKILL_MAP: Record<string, string[]> = {
  'painel_solar': ['painel solar', 'módulo fotovoltaico', 'limpeza de módulos', 'painel', 'módulo', 'solar'],
  'inversor': ['inversor', 'eletrônica de potência', 'eletronica'],
  'controlador_carga': ['controlador', 'eletrônica', 'carga'],
  'bateria': ['bateria', 'armazenamento', 'storage'],
  'cabeamento': ['cabeamento', 'elétrica', 'eletrica', 'cabos'],
  'estrutura': ['estrutura', 'mecânica', 'mecanica', 'montagem'],
  'monitoramento': ['monitoramento', 'TI', 'comunicação', 'comunicacao', 'software'],
  'outros': []
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface TechnicianScore {
  prestadorId: string;
  score: number;
  agendaScore: number;
  distanciaScore: number;
  habilidadesScore: number;
  osCount: number;
  distanciaKm: number | null;
  hasSkillMatch: boolean;
}

interface UseTechnicianScoreParams {
  prestadores: any[];
  ticketDate?: string | null;
  ticketLat?: number | null;
  ticketLng?: number | null;
  equipamentoTipo?: string | null;
}

export function useTechnicianScore({
  prestadores,
  ticketDate,
  ticketLat,
  ticketLng,
  equipamentoTipo
}: UseTechnicianScoreParams) {
  const [osData, setOsData] = useState<any[]>([]);
  const [ticketCoords, setTicketCoords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prestadores.length) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch OS for the target date to check agenda
        let osQuery = supabase
          .from('ordens_servico')
          .select('tecnico_id, data_programada, ticket_id');

        if (ticketDate) {
          osQuery = osQuery.eq('data_programada', ticketDate);
        }

        const { data: osResult } = await osQuery;
        setOsData(osResult || []);

        // Fetch ticket coordinates for distance calculation
        if (ticketLat && ticketLng) {
          // Get all active tickets with coordinates that have OS assigned
          const { data: ticketsWithCoords } = await supabase
            .from('tickets')
            .select('id, latitude, longitude, tecnico_responsavel_id')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .not('tecnico_responsavel_id', 'is', null)
            .in('status', ['aprovado', 'ordem_servico_gerada', 'em_execucao']);

          setTicketCoords(ticketsWithCoords || []);
        }
      } catch (error) {
        console.error('Erro ao carregar dados de score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prestadores.length, ticketDate, ticketLat, ticketLng]);

  const scores = useMemo((): TechnicianScore[] => {
    if (!prestadores.length) return [];

    // Build map: prestadorId -> tecnico_id (via email matching is complex, use OS data)
    // Instead, count OS per prestador via tecnico_responsavel_id on tickets
    const osByTecnicoId = new Map<string, number>();
    
    // Count OS on the same date per tecnico_id  
    osData.forEach(os => {
      if (os.tecnico_id) {
        osByTecnicoId.set(os.tecnico_id, (osByTecnicoId.get(os.tecnico_id) || 0) + 1);
      }
    });

    // Count by prestador via ticket assignments
    const osByPrestador = new Map<string, number>();
    // Use ticketCoords to find prestador assignments on same date
    if (ticketDate) {
      ticketCoords.forEach(t => {
        if (t.tecnico_responsavel_id) {
          osByPrestador.set(
            t.tecnico_responsavel_id, 
            (osByPrestador.get(t.tecnico_responsavel_id) || 0) + 1
          );
        }
      });
    }

    return prestadores.map(prestador => {
      // 1. Agenda score (40%) - fewer OS = better
      const osCount = osByPrestador.get(prestador.id) || 0;
      let agendaScore: number;
      if (osCount === 0) agendaScore = 100;
      else if (osCount === 1) agendaScore = 80;
      else if (osCount === 2) agendaScore = 60;
      else if (osCount === 3) agendaScore = 40;
      else agendaScore = 20;

      // 2. Distance score (30%) - closer = better
      let distanciaScore = 50; // default when no coords
      let distanciaKm: number | null = null;
      
      if (ticketLat && ticketLng) {
        // Find average coords of this prestador's active tickets
        const prestadorTickets = ticketCoords.filter(
          t => t.tecnico_responsavel_id === prestador.id && t.latitude && t.longitude
        );
        
        if (prestadorTickets.length > 0) {
          const avgLat = prestadorTickets.reduce((sum, t) => sum + Number(t.latitude), 0) / prestadorTickets.length;
          const avgLng = prestadorTickets.reduce((sum, t) => sum + Number(t.longitude), 0) / prestadorTickets.length;
          distanciaKm = haversineDistance(ticketLat, ticketLng, avgLat, avgLng);
          
          if (distanciaKm < 10) distanciaScore = 100;
          else if (distanciaKm < 30) distanciaScore = 70;
          else if (distanciaKm < 60) distanciaScore = 40;
          else distanciaScore = 20;
        } else {
          distanciaScore = 60; // No data = neutral
        }
      }

      // 3. Skills score (30%) - match = better
      let habilidadesScore = 50; // default
      let hasSkillMatch = false;
      
      if (equipamentoTipo && prestador.especialidades?.length) {
        const requiredSkills = EQUIPMENT_SKILL_MAP[equipamentoTipo] || [];
        const prestadorSkills = (prestador.especialidades as string[]).map(
          (s: string) => s.toLowerCase()
        );
        
        const hasMatch = requiredSkills.some(skill =>
          prestadorSkills.some((ps: string) => ps.includes(skill.toLowerCase()) || skill.toLowerCase().includes(ps))
        );
        
        if (hasMatch) {
          habilidadesScore = 100;
          hasSkillMatch = true;
        } else if (requiredSkills.length === 0) {
          habilidadesScore = 60; // 'outros' type
        } else {
          habilidadesScore = 20;
        }
      }

      const score = Math.round(
        agendaScore * 0.4 + distanciaScore * 0.3 + habilidadesScore * 0.3
      );

      return {
        prestadorId: prestador.id,
        score,
        agendaScore,
        distanciaScore,
        habilidadesScore,
        osCount,
        distanciaKm,
        hasSkillMatch
      };
    }).sort((a, b) => b.score - a.score);
  }, [prestadores, osData, ticketCoords, ticketLat, ticketLng, equipamentoTipo, ticketDate]);

  return { scores, loading };
}
