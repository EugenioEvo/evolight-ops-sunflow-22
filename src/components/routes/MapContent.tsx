import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Badge } from "@/components/ui/badge";
import L from 'leaflet';
import { 
  createNumberedIcon, 
  createEvolightIcon, 
  getPrioridadeColor, 
  getStatusColor,
  EVOLIGHT_COORDS 
} from './utils';
import type { TicketData, RotaOtimizada, RouteProvider } from './types';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapContentProps {
  validTickets: TicketData[];
  validSelectedTickets: TicketData[];
  validGeometry: [number, number][];
  selectedRota: RotaOtimizada | null | undefined;
  selectedRoute: number | null;
  routeProvider: RouteProvider;
}

const getPolylineProps = (provider: RouteProvider) => {
  if (provider === 'mapbox') return { 
    color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: '10, 5' 
  };
  if (provider === 'osrm') return { 
    color: '#8b5cf6', weight: 4, opacity: 0.85 
  };
  return { 
    color: '#6b7280', weight: 3, opacity: 0.6, dashArray: '3, 8' 
  };
};

const createDefaultIcon = (prioridade: string) => {
  const colors: Record<string, string> = {
    critica: '#dc2626',
    alta: '#f97316',
    media: '#eab308',
    baixa: '#22c55e'
  };
  const color = colors[prioridade] || '#3b82f6';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const MapContent: React.FC<MapContentProps> = ({
  validTickets,
  validSelectedTickets,
  validGeometry,
  selectedRota,
  selectedRoute,
  routeProvider
}) => {
  return (
    <MapContainer
      center={EVOLIGHT_COORDS}
      zoom={12}
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Marcador fixo da Evolight (ponto inicial) */}
      <Marker 
        position={EVOLIGHT_COORDS}
        icon={createEvolightIcon()}
      >
        <Popup>
          <div className="p-2 min-w-[200px]">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">🏢</span>
              <h6 className="font-semibold text-purple-600">Evolight</h6>
            </div>
            <p className="text-sm font-medium mb-1">Ponto de Partida</p>
            <p className="text-xs text-gray-600">Avenida T9, 1001</p>
            <p className="text-xs text-gray-600">Setor Bueno, Goiânia-GO</p>
            <p className="text-xs text-gray-500 mt-2">CEP 74215-025</p>
          </div>
        </Popup>
      </Marker>
      
      {/* Marcadores dos tickets */}
      {selectedRota ? (
        // Marcadores numerados quando rota selecionada
        validSelectedTickets.map((ticket) => (
          <Marker 
            key={`marker-${ticket.id}`} 
            position={ticket.coordenadas}
            icon={createNumberedIcon(ticket.ordem || 0, ticket.prioridade)}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline" className="font-bold">#{ticket.ordem}</Badge>
                  <h6 className="font-semibold">{ticket.cliente}</h6>
                </div>
                <p className="text-sm text-gray-600 mb-1">OS: {ticket.numeroOS}</p>
                <p className="text-sm text-gray-600 mb-1">{ticket.tipo}</p>
                <p className="text-xs text-gray-500 mb-2">{ticket.endereco}</p>
                
                {ticket.dataProgramada && (
                  <p className="text-xs text-gray-500 mb-2">
                    📅 {new Date(ticket.dataProgramada).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
                
                <p className="text-xs text-gray-500 mb-2">👷 {ticket.tecnico}</p>
                <p className="text-xs text-gray-500 mb-2">⏱️ {ticket.estimativa}</p>
                
                {!ticket.hasRealCoords && (
                  <Badge variant="outline" className="text-xs mb-2">
                    📍 Localização aproximada
                  </Badge>
                )}
                
                <Badge className={getPrioridadeColor(ticket.prioridade)}>
                  {ticket.prioridade}
                </Badge>
              </div>
            </Popup>
          </Marker>
        ))
      ) : (
        // Marcadores simples quando nenhuma rota selecionada
        validTickets.map((ticket) => (
          <Marker
            key={`ticket-${ticket.id}`}
            position={ticket.coordenadas}
            icon={createDefaultIcon(ticket.prioridade)}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h6 className="font-semibold mb-1">{ticket.cliente}</h6>
                <p className="text-sm text-gray-600 mb-1">OS: {ticket.numeroOS}</p>
                <p className="text-sm text-gray-600 mb-1">{ticket.tipo}</p>
                <p className="text-xs text-gray-500 mb-2">{ticket.endereco}</p>
                <div className="flex space-x-1">
                  <Badge className={getPrioridadeColor(ticket.prioridade)}>
                    {ticket.prioridade}
                  </Badge>
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </Popup>
          </Marker>
        ))
      )}
      
      {/* Linha da rota */}
      {selectedRoute && validGeometry.length > 1 && (
        <Polyline
          positions={validGeometry}
          {...getPolylineProps(routeProvider)}
        />
      )}
    </MapContainer>
  );
};

export default MapContent;
