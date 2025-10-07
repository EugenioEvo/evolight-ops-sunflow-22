import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Users, Route as RouteIcon } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const { profile } = useAuth();

  useEffect(() => {
    setMounted(true);
    loadOrdensServico();
  }, [dateFilter, statusFilter, profile]);

  const loadOrdensServico = async () => {
    try {
      // Se for técnico de campo, buscar apenas suas OS
      let query = supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            id,
            numero_ticket,
            titulo,
            endereco_servico,
            prioridade,
            status,
            tempo_estimado,
            clientes!inner(
              empresa
            )
          ),
          tecnicos!inner(
            id,
            profiles!inner(nome)
          )
        `);

      // Filtrar por técnico se for técnico de campo
      if (profile?.role === 'tecnico_campo') {
        const { data: tecnicoData } = await supabase
          .from('tecnicos')
          .select('id')
          .eq('profile_id', profile?.id)
          .single();
        
        if (tecnicoData) {
          query = query.eq('tecnico_id', tecnicoData.id);
        }
      }

      // Filtro de status
      if (statusFilter === 'pendente') {
        query = query.eq('tickets.status', 'ordem_servico_gerada');
      } else if (statusFilter === 'execucao') {
        query = query.eq('tickets.status', 'em_execucao');
      } else {
        query = query.in('tickets.status', ['ordem_servico_gerada', 'em_execucao']);
      }

      // Filtro de data
      if (dateFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('data_programada', today);
      } else if (dateFilter === 'week') {
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        query = query.lte('data_programada', weekEnd.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      setOrdensServico(data || []);
    } catch (error) {
      console.error('Erro ao carregar ordens de serviço:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert OS to tickets format for map display
  const tickets = ordensServico.map((os, index) => ({
    id: os.id,
    numero: os.tickets.numero_ticket,
    cliente: os.tickets.clientes.empresa,
    endereco: os.tickets.endereco_servico,
    prioridade: os.tickets.prioridade,
    status: os.tickets.status,
    tipo: os.tickets.titulo,
    tecnico: os.tecnicos?.profiles?.nome || 'Não atribuído',
    estimativa: os.tickets.tempo_estimado ? `${os.tickets.tempo_estimado}h` : 'N/A',
    // Mock coordinates - in production you'd geocode the addresses
    coordenadas: [-23.5505 + (index * 0.02), -46.6333 + (index * 0.02)] as [number, number],
  }));

  // Group by technician
  const rotasPorTecnico = ordensServico.reduce((acc: any[], os) => {
    const tecnicoNome = os.tecnicos?.profiles?.nome || 'Sem técnico';
    let rota = acc.find(r => r.tecnico === tecnicoNome);
    
    if (!rota) {
      rota = {
        id: acc.length + 1,
        nome: `Rota - ${tecnicoNome}`,
        tickets: [],
        tecnico: tecnicoNome,
        distanciaTotal: 'Calcular',
        tempoEstimado: '0h'
      };
      acc.push(rota);
    }
    
    rota.tickets.push(tickets.findIndex(t => t.id === os.id));
    return acc;
  }, []);

  const rotasOtimizadas = rotasPorTecnico.length > 0 ? rotasPorTecnico : [
    {
      id: 1,
      nome: 'Ordens Pendentes',
      tickets: tickets.map((_, idx) => idx),
      distanciaTotal: 'Calcular',
      tempoEstimado: 'A definir',
      tecnico: 'Diversos'
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
    
    const coordinates = route.tickets.map(ticketIdx => {
      const ticket = tickets[ticketIdx];
      return ticket ? ticket.coordenadas : null;
    }).filter((coord): coord is [number, number] => coord !== null);
    
    return coordinates;
  };

  if (loading || !mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Carregando rotas...</div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-6 flex items-center justify-center">
              <div className="text-center">Carregando mapa...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="execucao">Em Execução</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default RouteMap;