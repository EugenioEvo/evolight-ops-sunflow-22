import { useState, useEffect, useCallback } from 'react';
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

interface TicketContext {
  data_vencimento?: string | null;
  data_servico?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  equipamento_tipo?: string | null;
}

export function useTechnicianScoreEngine(prestadores: any[]) {
  const [allOsData, setAllOsData] = useState<any[]>([]);
  const [allTicketCoords, setAllTicketCoords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prestadores.length) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch ALL recent OS (not filtered by date) to build workload picture
        const { data: osResult } = await supabase
          .from('ordens_servico')
          .select('tecnico_id, data_programada, ticket_id')
          .not('data_programada', 'is', null);

        setAllOsData(osResult || []);

        // Fetch all active tickets with coordinates for distance calc
        const { data: ticketsWithCoords } = await supabase
          .from('tickets')
          .select('id, latitude, longitude, tecnico_responsavel_id, data_vencimento, data_servico')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .not('tecnico_responsavel_id', 'is', null)
          .in('status', ['aprovado', 'ordem_servico_gerada', 'em_execucao']);

        setAllTicketCoords(ticketsWithCoords || []);
      } catch (error) {
        console.error('Erro ao carregar dados de score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prestadores.length]);

  const getScoresForTicket = useCallback((ticket?: TicketContext | null): TechnicianScore[] => {
    if (!prestadores.length) return [];

    const ticketDate = ticket?.data_vencimento || ticket?.data_servico || null;
    const ticketLat = ticket?.latitude ? Number(ticket.latitude) : null;
    const ticketLng = ticket?.longitude ? Number(ticket.longitude) : null;
    const equipamentoTipo = ticket?.equipamento_tipo || null;

    // Count OS per prestador for the specific date
    const osByPrestadorOnDate = new Map<string, number>();
    const osByPrestadorTotal = new Map<string, number>();

    // Count from tickets table (tecnico_responsavel_id = prestador id)
    allTicketCoords.forEach(t => {
      if (t.tecnico_responsavel_id) {
        osByPrestadorTotal.set(
          t.tecnico_responsavel_id,
          (osByPrestadorTotal.get(t.tecnico_responsavel_id) || 0) + 1
        );
        if (ticketDate) {
          const tDate = t.data_vencimento || t.data_servico;
          if (tDate === ticketDate) {
            osByPrestadorOnDate.set(
              t.tecnico_responsavel_id,
              (osByPrestadorOnDate.get(t.tecnico_responsavel_id) || 0) + 1
            );
          }
        }
      }
    });

    // Also count from OS table
    allOsData.forEach(os => {
      if (os.tecnico_id && ticketDate && os.data_programada === ticketDate) {
        // Map tecnico_id to prestador - we need to check via tickets
        // For now, use direct OS count as supplementary
      }
    });

    return prestadores.map(prestador => {
      // 1. Agenda score (40%)
      let agendaScore: number;
      if (ticketDate) {
        const osCount = osByPrestadorOnDate.get(prestador.id) || 0;
        if (osCount === 0) agendaScore = 100;
        else if (osCount === 1) agendaScore = 80;
        else if (osCount === 2) agendaScore = 60;
        else if (osCount === 3) agendaScore = 40;
        else agendaScore = 20;
      } else {
        // No date: use total workload as fallback
        const totalOs = osByPrestadorTotal.get(prestador.id) || 0;
        if (totalOs === 0) agendaScore = 100;
        else if (totalOs <= 2) agendaScore = 80;
        else if (totalOs <= 5) agendaScore = 60;
        else if (totalOs <= 8) agendaScore = 40;
        else agendaScore = 20;
      }

      const osCount = ticketDate
        ? (osByPrestadorOnDate.get(prestador.id) || 0)
        : (osByPrestadorTotal.get(prestador.id) || 0);

      // 2. Distance score (30%)
      let distanciaScore = 50;
      let distanciaKm: number | null = null;

      if (ticketLat && ticketLng) {
        const prestadorTickets = allTicketCoords.filter(
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
          distanciaScore = 60;
        }
      }

      // 3. Skills score (30%)
      let habilidadesScore = 50;
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
          habilidadesScore = 60;
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
  }, [prestadores, allOsData, allTicketCoords]);

  return { getScoresForTicket, loading };
}
