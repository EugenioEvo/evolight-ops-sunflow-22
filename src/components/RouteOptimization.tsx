import { AlertCircle, TrendingUp, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Otimização avançada considerando janelas de tempo e prioridades
export const optimizeRouteAdvanced = (tickets: any[]): any[] => {
  if (tickets.length <= 1) return tickets.map((t, i) => ({ ...t, ordem: i + 1 }));

  const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
  const ticketsWithoutCoords = tickets.filter(t => !t.hasRealCoords);

  if (ticketsWithCoords.length === 0) {
    return tickets.map((t, i) => ({ ...t, ordem: i + 1 }));
  }

  // ===== FASE 1: AGRUPAR POR JANELA DE TEMPO =====
  const agrupadosPorData: Record<string, any[]> = {};
  
  ticketsWithCoords.forEach(ticket => {
    const data = ticket.dataProgramada 
      ? new Date(ticket.dataProgramada).toISOString().split('T')[0]
      : 'sem_data';
    
    if (!agrupadosPorData[data]) {
      agrupadosPorData[data] = [];
    }
    agrupadosPorData[data].push(ticket);
  });

  // ===== FASE 2: OTIMIZAR CADA GRUPO =====
  const gruposOtimizados: any[][] = [];

  Object.keys(agrupadosPorData).sort().forEach(data => {
    const grupo = agrupadosPorData[data];
    
    // Ordenar por prioridade dentro do grupo
    const prioMap: Record<string, number> = { 
      critica: 4,
      alta: 3, 
      media: 2, 
      baixa: 1 
    };
    
    grupo.sort((a, b) => {
      const prioDiff = prioMap[b.prioridade] - prioMap[a.prioridade];
      if (prioDiff !== 0) return prioDiff;
      
      // Se mesma prioridade, usar nearest neighbor
      return 0;
    });

    // Aplicar nearest neighbor mantendo prioridades críticas no início
    const criticos = grupo.filter(t => t.prioridade === 'critica');
    const resto = grupo.filter(t => t.prioridade !== 'critica');

    const grupoOtimizado = [
      ...criticos,
      ...nearestNeighborOptimization(resto)
    ];

    gruposOtimizados.push(grupoOtimizado);
  });

  // ===== FASE 3: CONSOLIDAR RESULTADO =====
  const resultado = gruposOtimizados.flat();
  
  // Adicionar tickets sem coordenadas no final
  const final = [
    ...resultado,
    ...ticketsWithoutCoords
  ].map((t, i) => ({ ...t, ordem: i + 1 }));

  return final;
};

// Nearest Neighbor clássico
const nearestNeighborOptimization = (tickets: any[]): any[] => {
  if (tickets.length <= 1) return tickets;

  const optimized: any[] = [];
  const remaining = [...tickets];

  // Começar pelo primeiro
  let current = remaining[0];
  optimized.push(current);
  remaining.splice(0, 1);

  // Encontrar vizinho mais próximo
  while (remaining.length > 0) {
    let nearest = remaining[0];
    let minDist = Infinity;

    for (const ticket of remaining) {
      const dist = haversineDistance(
        current.coordenadas[0], current.coordenadas[1],
        ticket.coordenadas[0], ticket.coordenadas[1]
      );

      if (dist < minDist) {
        minDist = dist;
        nearest = ticket;
      }
    }

    optimized.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
    current = nearest;
  }

  return optimized;
};

// Cálculo de distância Haversine
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Componente de Badge de Prioridade
export const PrioridadeBadge = ({ prioridade }: { prioridade: string }) => {
  const configs: Record<string, { label: string; className: string; icon: typeof AlertCircle }> = {
    critica: { 
      label: 'Crítica', 
      className: 'bg-red-500 text-white hover:bg-red-600',
      icon: AlertCircle
    },
    alta: { 
      label: 'Alta', 
      className: 'bg-orange-500 text-white hover:bg-orange-600',
      icon: TrendingUp
    },
    media: { 
      label: 'Média', 
      className: 'bg-yellow-500 text-white hover:bg-yellow-600',
      icon: Clock
    },
    baixa: { 
      label: 'Baixa', 
      className: 'bg-green-500 text-white hover:bg-green-600',
      icon: Calendar
    }
  };

  const config = configs[prioridade] || configs.media;
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
