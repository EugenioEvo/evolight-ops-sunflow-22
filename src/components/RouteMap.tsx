import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, Route as RouteIcon } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Guard against runtime errors in map libs to avoid full app crash
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.error('MapErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full">
          <CardContent className="p-6 flex items-center justify-center">
            <div className="text-center text-sm">Falha ao carregar o mapa.</div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children as any;
  }
}


// Create custom icon to avoid production build issues
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Set the default icon for all markers
L.Marker.prototype.options.icon = defaultIcon;

const RouteMap: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mock data para demonstração
  const tickets = [
    {
      id: 1,
      cliente: "Solar Tech Ltda",
      endereco: "Av. Paulista, 1000 - São Paulo, SP",
      coordenadas: [-23.5505, -46.6333] as [number, number],
      prioridade: "alta",
      tipo: "Manutenção Preventiva",
      tecnico: "João Silva",
      status: "pendente",
      estimativa: "2h"
    },
    {
      id: 2,
      cliente: "Green Energy Corp",
      endereco: "Rua das Flores, 500 - São Paulo, SP",
      coordenadas: [-23.5615, -46.6565] as [number, number],
      prioridade: "media",
      tipo: "Inspeção",
      tecnico: "Maria Santos",
      status: "em_andamento",
      estimativa: "1h"
    },
    {
      id: 3,
      cliente: "EcoSolar Brasil",
      endereco: "Av. Faria Lima, 2000 - São Paulo, SP",
      coordenadas: [-23.5735, -46.6865] as [number, number],
      prioridade: "baixa",
      tipo: "Instalação",
      tecnico: "Pedro Costa",
      status: "concluido",
      estimativa: "4h"
    }
  ];

  const rotasOtimizadas = [
    {
      id: 1,
      nome: "Rota Matinal",
      tickets: [1, 2],
      distanciaTotal: "15.2 km",
      tempoEstimado: "3h 30min",
      tecnico: "João Silva"
    },
    {
      id: 2,
      nome: "Rota Vespertina", 
      tickets: [3],
      distanciaTotal: "8.7 km",
      tempoEstimado: "4h",
      tecnico: "Pedro Costa"
    }
  ];

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "alta": return "bg-red-100 text-red-800";
      case "media": return "bg-yellow-100 text-yellow-800";
      case "baixa": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente": return "bg-gray-100 text-gray-800";
      case "em_andamento": return "bg-blue-100 text-blue-800";
      case "concluido": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRouteCoordinates = (routeId: number) => {
    const route = rotasOtimizadas.find(r => r.id === routeId);
    if (!route) return [];
    
    const coordinates = route.tickets.map(ticketId => {
      const ticket = tickets.find(t => t.id === ticketId);
      return ticket ? ticket.coordenadas : null;
    }).filter((coord): coord is [number, number] => coord !== null);
    
    return coordinates;
  };

  // Don't render map until component is mounted (prevents SSR/hydration issues)
  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Carregando mapa...</div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-6 flex items-center justify-center">
              <div className="text-center">Carregando...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Lista de Rotas */}
      <div className="lg:col-span-1 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <RouteIcon className="h-5 w-5" />
              <span>Rotas Otimizadas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rotasOtimizadas.map((rota) => (
              <div 
                key={rota.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRoute === rota.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedRoute(selectedRoute === rota.id ? null : rota.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{rota.nome}</h4>
                  <Badge variant="outline">{rota.tickets.length} tickets</Badge>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>{rota.tecnico}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>{rota.distanciaTotal}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{rota.tempoEstimado}</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Função para iniciar navegação
                  }}
                >
                  Iniciar Rota
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lista de Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets do Dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="p-3 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-sm">{ticket.cliente}</h5>
                  <div className="flex space-x-1">
                    <Badge className={getPrioridadeColor(ticket.prioridade)}>
                      {ticket.prioridade}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{ticket.tipo}</p>
                  <p>{ticket.endereco}</p>
                  <p>Técnico: {ticket.tecnico}</p>
                  <p>Estimativa: {ticket.estimativa}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Mapa */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardContent className="p-0 h-full">
            <div className="w-full h-full rounded-lg overflow-hidden">
              <MapErrorBoundary>
                <MapContainer
                  key="main-map"
                  center={[-23.5505, -46.6333]}
                  zoom={12}
                  className="w-full h-full"
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Marcadores dos tickets */}
                  {tickets.map((ticket) => (
                    <Marker key={`marker-${ticket.id}`} position={ticket.coordenadas}>
                      <Popup>
                        <div className="p-2">
                          <h6 className="font-semibold mb-1">{ticket.cliente}</h6>
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
                  ))}
                  
                  {/* Linha da rota selecionada */}
                  {selectedRoute && getRouteCoordinates(selectedRoute).length > 1 && (
                    <Polyline
                      key={`route-${selectedRoute}`}
                      positions={getRouteCoordinates(selectedRoute)}
                      color="#3b82f6"
                      weight={4}
                      opacity={0.7}
                    />
                  )}
                </MapContainer>
              </MapErrorBoundary>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RouteMap;