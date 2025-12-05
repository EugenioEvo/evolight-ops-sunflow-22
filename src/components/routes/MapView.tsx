import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MarkerCluster from '@/components/MarkerCluster';
import MapErrorBoundary from './MapErrorBoundary';
import { 
  createNumberedIcon, 
  createEvolightIcon, 
  getPrioridadeColor, 
  getStatusColor,
  EVOLIGHT_COORDS 
} from './utils';
import type { TicketData, RotaOtimizada, RouteProvider } from './types';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  tickets: TicketData[];
  selectedRoute: number | null;
  rotas: RotaOtimizada[];
  routeGeometry: [number, number][] | null;
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

const MapViewComponent: React.FC<MapViewProps> = ({
  tickets,
  selectedRoute,
  rotas,
  routeGeometry,
  routeProvider
}) => {
  const selectedRota = selectedRoute ? rotas.find(r => r.id === selectedRoute) : null;

  return (
    <Card className="h-full">
      <CardContent className="p-0 h-full">
        <div className="w-full h-[600px] rounded-lg overflow-hidden relative">
          <MapErrorBoundary>
            <MapContainer
              key="route-map"
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
                selectedRota.ticketsData.map((ticket) => (
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
                // Cluster de marcadores quando nenhuma rota selecionada
                <MarkerCluster
                  markers={tickets.map((ticket) => ({
                    id: ticket.id,
                    position: ticket.coordenadas,
                    popupContent: `
                      <div class="p-2">
                        <h6 class="font-semibold mb-1">${ticket.cliente}</h6>
                        <p class="text-sm text-gray-600 mb-1">OS: ${ticket.numeroOS}</p>
                        <p class="text-sm text-gray-600 mb-1">${ticket.tipo}</p>
                        <p class="text-xs text-gray-500 mb-2">${ticket.endereco}</p>
                        <div class="flex space-x-1">
                          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getPrioridadeColor(ticket.prioridade)}">${ticket.prioridade}</span>
                          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(ticket.status)}">${ticket.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                    `
                  }))}
                />
              )}
              
              {/* Linha da rota */}
              {selectedRoute && routeGeometry && routeGeometry.length > 1 && (
                <Polyline
                  positions={routeGeometry}
                  {...getPolylineProps(routeProvider)}
                />
              )}
            </MapContainer>
          </MapErrorBoundary>
        </div>
      </CardContent>
    </Card>
  );
};

export const MapView = React.memo(MapViewComponent);
