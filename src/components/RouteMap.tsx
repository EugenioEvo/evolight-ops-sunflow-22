import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Users, Route as RouteIcon, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { optimizeRouteAdvanced, PrioridadeBadge } from '@/components/RouteOptimization';
import { RouteExportButtons } from '@/components/RouteExportButtons';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';
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
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Falha ao carregar o mapa.</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return <>{this.props.children}</>;
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

// Create numbered marker icon
const createNumberedIcon = (number: number, prioridade: string) => {
  const colorMap: Record<string, string> = {
    critica: '#dc2626', // red-600
    alta: '#f97316',    // orange-500
    media: '#eab308',   // yellow-500
    baixa: '#22c55e'    // green-500
  };
  
  const color = colorMap[prioridade] || '#3b82f6';
  
  return L.divIcon({
    className: 'custom-numbered-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        color: white;
      ">
        ${number}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Haversine distance calculation (km)
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Removido - agora está em RouteOptimization.tsx

// Calculate route totals (distance and time)
const calculateRouteTotals = (tickets: any[]) => {
  let totalDistance = 0;
  let totalTime = 0;
  
  const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
  
  if (ticketsWithCoords.length < 2) {
    return {
      distance: '0 km',
      time: '0h 0min'
    };
  }
  
  for (let i = 0; i < ticketsWithCoords.length - 1; i++) {
    const dist = haversineDistance(
      ticketsWithCoords[i].coordenadas[0], ticketsWithCoords[i].coordenadas[1],
      ticketsWithCoords[i+1].coordenadas[0], ticketsWithCoords[i+1].coordenadas[1]
    );
    totalDistance += dist;
    
    // Estimate 30 km/h urban traffic + 15min per stop
    const travelTime = (dist / 30) * 60; // minutes
    totalTime += travelTime + 15; // +15min stop time
  }
  
  // Add service time
  const serviceTime = tickets.reduce((sum, t) => {
    const tempo = parseInt(t.estimativa) || 0;
    return sum + tempo * 60;
  }, 0);
  totalTime += serviceTime;
  
  return {
    distance: `${totalDistance.toFixed(1)} km`,
    time: `${Math.floor(totalTime / 60)}h ${Math.floor(totalTime % 60)}min`
  };
};

const RouteMap: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [optimizingRoute, setOptimizingRoute] = useState<number | null>(null);
  const { profile } = useAuth();
  const { geocodeAddress, geocodeBatch, loading: geocoding, progress, completed, total } = useGeocoding();
  const { optimizeRoute, loading: optimizing, optimizedRoute } = useRouteOptimization();

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
            latitude,
            longitude,
            geocoded_at,
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

  // Convert OS to tickets format for map display - memoized
  const tickets = useMemo(() => {
    return ordensServico.map((os, index) => {
      const hasCoords = os.tickets.latitude && os.tickets.longitude;
      
      return {
        id: os.id,
        ticketId: os.tickets.id,
        numeroOS: os.numero_os,
        numero: os.tickets.numero_ticket,
        cliente: os.tickets.clientes?.empresa || 'Cliente não definido',
        endereco: os.tickets.endereco_servico,
        prioridade: os.tickets.prioridade,
        status: os.tickets.status,
        tipo: os.tickets.titulo,
        tecnico: os.tecnicos?.profiles?.nome || 'Não atribuído',
        estimativa: os.tickets.tempo_estimado ? `${os.tickets.tempo_estimado}h` : 'N/A',
        dataProgramada: os.data_programada,
        // Usar coordenadas reais ou fallback para São Paulo
        coordenadas: hasCoords 
          ? [os.tickets.latitude, os.tickets.longitude] as [number, number]
          : [-23.5505, -46.6333] as [number, number], // Fallback: Centro de SP
        hasRealCoords: hasCoords
      };
    });
  }, [ordensServico]);

  // Group by technician and optimize routes - memoized
  const rotasOtimizadas = useMemo(() => {
    const rotasPorTecnico = ordensServico.reduce((acc: any[], os) => {
      const tecnicoNome = os.tecnicos?.profiles?.nome || 'Sem técnico';
      let rota = acc.find(r => r.tecnico === tecnicoNome);
      
      if (!rota) {
        rota = {
          id: acc.length + 1,
          nome: `Rota - ${tecnicoNome}`,
          ticketsData: [],
          tecnico: tecnicoNome
        };
        acc.push(rota);
      }
      
      const ticketData = tickets.find(t => t.id === os.id);
      if (ticketData) {
        rota.ticketsData.push(ticketData);
      }
      
      return acc;
    }, []);

    // Optimize each route and calculate totals (usando algoritmo local por padrão)
    const optimizedRoutes = rotasPorTecnico.map(rota => {
      const optimizedTickets = optimizeRouteAdvanced(rota.ticketsData);
      const totals = calculateRouteTotals(optimizedTickets);
      const allGeocoded = optimizedTickets.every(t => t.hasRealCoords);
      const canOptimize = allGeocoded && optimizedTickets.length >= 2;
      
      return {
        ...rota,
        ticketsData: optimizedTickets,
        distanciaTotal: totals.distance,
        tempoEstimado: totals.time,
        allGeocoded,
        canOptimize
      };
    });

    return optimizedRoutes.length > 0 ? optimizedRoutes : [
      {
        id: 1,
        nome: 'Ordens Pendentes',
        ticketsData: optimizeRouteAdvanced(tickets),
        distanciaTotal: calculateRouteTotals(tickets).distance,
        tempoEstimado: calculateRouteTotals(tickets).time,
        tecnico: 'Diversos',
        allGeocoded: tickets.every(t => t.hasRealCoords)
      }
    ];
  }, [ordensServico, tickets]);

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


  if (loading || !mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RouteIcon className="h-5 w-5" />
                <span>Rotas Otimizadas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-6 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando mapa...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold mb-2">Nenhuma ordem de serviço encontrada</h3>
              <p className="text-sm text-muted-foreground">
                Altere os filtros ou aguarde novas atribuições
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar de geocodificação */}
      {geocoding && (
        <div className="fixed top-4 right-4 w-80 bg-card shadow-lg rounded-lg p-4 z-50 border">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Geocodificando endereços</p>
              <Progress value={progress} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {completed}/{total} concluídos
              </p>
            </div>
          </div>
        </div>
      )}
      
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
        {/* Lista de Rotas e Tickets - 1/3 */}
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
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{rota.ticketsData.length} OS</Badge>
                    {rota.allGeocoded ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Pronto
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </div>
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
                
                {!rota.allGeocoded && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    disabled={geocoding}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ticketsToGeocode = rota.ticketsData
                        .filter(t => !t.hasRealCoords)
                        .map(t => ({ id: t.ticketId, address: t.endereco }));
                      
                      await geocodeBatch(ticketsToGeocode);
                      loadOrdensServico();
                    }}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${geocoding ? 'animate-spin' : ''}`} />
                    {geocoding ? 'Geocodificando...' : 'Geocodificar Endereços'}
                  </Button>
                )}
                
                {rota.canOptimize && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full mt-3"
                    disabled={optimizing || optimizingRoute === rota.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setOptimizingRoute(rota.id);
                      
                      const optimized = await optimizeRoute(rota.ticketsData);
                      if (optimized) {
                        // Recarregar OS para atualizar a UI com rota otimizada
                        loadOrdensServico();
                      }
                      
                      setOptimizingRoute(null);
                    }}
                  >
                    <RouteIcon className={`h-4 w-4 mr-2 ${optimizingRoute === rota.id ? 'animate-spin' : ''}`} />
                    {optimizingRoute === rota.id ? 'Otimizando...' : 'Otimizar com OSRM'}
                  </Button>
                )}
                
                {rota.allGeocoded && (
                  <div className="mt-3">
                    <RouteExportButtons tickets={rota.ticketsData} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lista de Tickets com ordem otimizada */}
        <Card>
          <CardHeader>
            <CardTitle>Ordens do Dia (Otimizadas)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedRoute ? (
              rotasOtimizadas
                .find(r => r.id === selectedRoute)
                ?.ticketsData.map((ticket: any) => (
                  <div key={ticket.id} className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="font-bold">#{ticket.ordem}</Badge>
                        <h5 className="font-medium text-sm">{ticket.cliente}</h5>
                      </div>
                      <div className="flex space-x-1">
                        <PrioridadeBadge prioridade={ticket.prioridade} />
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium">OS: {ticket.numeroOS}</p>
                      <p>{ticket.tipo}</p>
                      <p>{ticket.endereco}</p>
                      <p>Estimativa: {ticket.estimativa}</p>
                    </div>
                  </div>
                ))
            ) : (
              tickets.map((ticket) => (
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
                    <p className="font-medium">OS: {ticket.numeroOS}</p>
                    <p>{ticket.tipo}</p>
                    <p>{ticket.endereco}</p>
                    <p>Técnico: {ticket.tecnico}</p>
                    <p>Estimativa: {ticket.estimativa}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>

        {/* Mapa - 2/3 */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              <div className="w-full h-[600px] rounded-lg overflow-hidden relative">
                <MapErrorBoundary>
                  <MapContainer
                    center={[-23.5505, -46.6333]}
                    zoom={12}
                    className="w-full h-full"
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Marcadores dos tickets com numeração quando rota selecionada */}
                    {selectedRoute ? (
                      rotasOtimizadas
                        .find(r => r.id === selectedRoute)
                        ?.ticketsData.map((ticket: any) => (
                          <Marker 
                            key={`marker-${ticket.id}`} 
                            position={ticket.coordenadas}
                            icon={createNumberedIcon(ticket.ordem, ticket.prioridade)}
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
                      tickets.map((ticket) => (
                        <Marker key={`marker-${ticket.id}`} position={ticket.coordenadas}>
                          <Popup>
                            <div className="p-2">
                              <h6 className="font-semibold mb-1">{ticket.cliente}</h6>
                              <p className="text-sm text-gray-600 mb-1">OS: {ticket.numeroOS}</p>
                              <p className="text-sm text-gray-600 mb-1">{ticket.tipo}</p>
                              <p className="text-xs text-gray-500 mb-2">{ticket.endereco}</p>
                              
                              {!ticket.hasRealCoords && (
                                <Badge variant="outline" className="text-xs mb-2">
                                  📍 Localização aproximada
                                </Badge>
                              )}
                              
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
                    
                    {/* Linha da rota selecionada */}
                    {selectedRoute && (() => {
                      const rota = rotasOtimizadas.find(r => r.id === selectedRoute);
                      const coordinates = rota?.ticketsData
                        .filter((t: any) => t.hasRealCoords)
                        .map((t: any) => t.coordenadas) || [];
                      return coordinates.length > 1 && (
                        <Polyline
                          positions={coordinates}
                          color="#3b82f6"
                          weight={3}
                          opacity={0.7}
                        />
                      );
                    })()}
                  </MapContainer>
                  
                  {/* Legenda do mapa */}
                  <div className="absolute bottom-4 left-4 bg-card p-3 rounded-lg shadow-lg z-[1000] border">
                    <p className="text-xs font-semibold mb-2">Prioridade</p>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-red-600"></div>
                        <span className="text-xs">Crítica</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                        <span className="text-xs">Alta</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                        <span className="text-xs">Média</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-green-500"></div>
                        <span className="text-xs">Baixa</span>
                      </div>
                    </div>
                  </div>
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