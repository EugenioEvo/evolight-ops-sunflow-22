export interface TicketData {
  id: string;
  ticketId: string;
  numeroOS: string;
  numero: string;
  cliente: string;
  endereco: string;
  prioridade: string;
  status: string;
  tipo: string;
  tecnico: string;
  estimativa: string;
  dataProgramada?: string;
  coordenadas: [number, number];
  hasRealCoords: boolean;
  tecnicoId: string | null;
  ordem?: number;
}

export interface RotaOtimizada {
  id: number;
  nome: string;
  ticketsData: TicketData[];
  tecnico: string;
  tecnicoId: string | null;
  dataRota: string | null; // Data da rota (YYYY-MM-DD)
  distanciaTotal: string;
  tempoEstimado: string;
  allGeocoded: boolean;
  canOptimize?: boolean;
  isOptimized?: boolean; // Se já foi otimizada via API
}

export interface TecnicoOption {
  id: string;
  nome: string;
}

export type RouteProvider = 'mapbox' | 'osrm' | 'local' | null;
