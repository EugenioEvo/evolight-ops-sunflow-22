import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, Users, Route as RouteIcon, RefreshCw, CheckCircle, AlertCircle, Navigation2, TrendingUp, TestTube } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { toast } from "sonner";
import { optimizeRouteAdvanced, PrioridadeBadge } from '@/components/RouteOptimization';
import { RouteExportButtons } from '@/components/RouteExportButtons';
import { RouteStatsCards } from '@/components/RouteStatsCards';
import { RouteTimeline } from '@/components/RouteTimeline';
import { RouteFilters } from '@/components/RouteFilters';
import { RouteLegend } from '@/components/RouteLegend';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Guard against runtime errors in map libs to avoid full app crash
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode }, 
  { hasError: boolean; errorMessage?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: undefined };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }
  
  componentDidCatch(error: any, info: any) {
    console.error('MapErrorBoundary caught error:', error);
    console.error('Error info:', info);
    console.error('Component stack:', info?.componentStack);
  }
  
  handleReset = () => {
    this.setState({ hasError: false, errorMessage: undefined });
    window.location.reload();
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full">
          <CardContent className="p-6 flex items-center justify-center">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <p className="text-sm font-medium mb-2">Erro ao carregar o mapa</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {this.state.errorMessage || 'Ocorreu um erro inesperado'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={this.handleReset}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar mapa
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

// Create Evolight start point marker (special icon)
const createEvolightIcon = () => {
  return L.divIcon({
    className: 'custom-evolight-icon',
    html: `
      <div style="
        background-color: #8B5CF6;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      ">
        🏢
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
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

// Normaliza e corrige coordenadas (lat, lon) para o Brasil
const normalizeCoordinates = (lat: any, lon: any): [number, number] => {
  let latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  let longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

  const isLatInBR = latitude >= -34 && latitude <= 6;
  const isLonInBR = longitude >= -74 && longitude <= -34;

  // Se estiverem fora do range do Brasil, tentar inverter
  const swappedLat = typeof lon === 'string' ? parseFloat(lon) : lon;
  const swappedLon = typeof lat === 'string' ? parseFloat(lat) : lat;
  const swapIsBetter = !isLatInBR || !isLonInBR
    ? (swappedLat >= -34 && swappedLat <= 6) && (swappedLon >= -74 && swappedLon <= -34)
    : false;

  if (swapIsBetter) {
    return [swappedLat, swappedLon];
  }

  return [latitude, longitude];
};

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
  const [dateFilter, setDateFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tecnicoFilter, setTecnicoFilter] = useState('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [optimizingRoute, setOptimizingRoute] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [routeProvider, setRouteProvider] = useState<'mapbox' | 'osrm' | 'local' | null>(null);
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nome: string }>>([]);
  const { profile } = useAuth();
  const { geocodeAddress, geocodeBatch, loading: geocoding, progress, completed, total } = useGeocoding();
  const { optimizeRoute, loading: optimizing, optimizedRoute } = useRouteOptimization();

  useEffect(() => {
    setMounted(true);
    loadOrdensServico();
    loadTecnicos();
  }, [dateFilter, statusFilter, tecnicoFilter, prioridadeFilter, searchQuery, profile]);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(nome)')
      .order('profiles(nome)');
    
    if (data) {
      setTecnicos(data.map(t => ({ id: t.id, nome: (t.profiles as any).nome })));
    }
  };

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

      // Filtro de técnico
      if (tecnicoFilter !== 'todos') {
        query = query.eq('tecnico_id', tecnicoFilter);
      }

      // Filtro de status
      if (statusFilter !== 'todos') {
        type TicketStatus = 'aberto' | 'aguardando_aprovacao' | 'aguardando_rme' | 'aprovado' | 'cancelado' | 'concluido' | 'em_execucao' | 'ordem_servico_gerada' | 'rejeitado';
        query = query.eq('tickets.status', statusFilter as TicketStatus);
      } else {
        query = query.in('tickets.status', ['ordem_servico_gerada', 'em_execucao', 'concluido']);
      }

      // Filtro de data
      const today = new Date();
      if (dateFilter === 'hoje') {
        const todayStr = today.toISOString().split('T')[0];
        query = query.eq('data_programada', todayStr);
      } else if (dateFilter === 'amanha') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = query.eq('data_programada', tomorrow.toISOString().split('T')[0]);
      } else if (dateFilter === 'semana') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        query = query.gte('data_programada', today.toISOString().split('T')[0])
          .lte('data_programada', weekEnd.toISOString().split('T')[0]);
      } else if (dateFilter === 'mes') {
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        query = query.gte('data_programada', today.toISOString().split('T')[0])
          .lte('data_programada', monthEnd.toISOString().split('T')[0]);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      let filteredData = data || [];

      // Filtro de prioridade
      if (prioridadeFilter !== 'todas') {
        filteredData = filteredData.filter(os => 
          os.tickets.prioridade === prioridadeFilter
        );
      }

      // Filtro de busca por texto
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        filteredData = filteredData.filter(os => 
          os.tickets.endereco_servico?.toLowerCase().includes(search) ||
          os.tickets.clientes?.empresa?.toLowerCase().includes(search) ||
          os.tickets.numero_ticket?.toLowerCase().includes(search)
        );
      }

      setOrdensServico(filteredData);
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
        coordenadas: hasCoords 
          ? normalizeCoordinates(os.tickets.latitude, os.tickets.longitude)
          : [-16.6869, -49.2648] as [number, number],
        hasRealCoords: hasCoords,
        tecnicoId: os.tecnicos?.id || null
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

  // Limpar geometria ao trocar de rota
  useEffect(() => {
    setRouteGeometry(null);
    setRouteProvider(null);
  }, [selectedRoute]);

  // Carregar rota persistida ao selecionar uma rota
  useEffect(() => {
    const loadPersistedRoute = async () => {
      if (!selectedRoute) return;
      
      const rota = rotasOtimizadas.find(r => r.id === selectedRoute);
      const firstTicket = rota?.ticketsData?.[0];
      if (!firstTicket?.tecnicoId) return;

      // Determinar data da rota (menor dataProgramada)
      const dates = (rota!.ticketsData as any[])
        .map(t => t.dataProgramada)
        .filter(Boolean)
        .map((d: string) => new Date(d));
      const dataRota = (dates.length 
        ? new Date(Math.min(...dates.map(d => d.getTime()))) 
        : new Date()
      ).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('route_optimizations')
        .select('*')
        .eq('tecnico_id', firstTicket.tecnicoId)
        .eq('data_rota', dataRota)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('⚠️ Erro ao carregar rota persistida:', error);
        return;
      }

      const record = data?.[0];
      if (record?.geometry && Array.isArray(record.geometry) && record.geometry.length > 0) {
        // Converter GeoJSON [lon, lat] para Leaflet [lat, lon]
        const toLeaflet = (coords: [number, number][]) => 
          coords.map(c => [c[1], c[0]] as [number, number]);
        
        setRouteGeometry(toLeaflet(record.geometry as [number, number][]));
        setRouteProvider(record.optimization_method as any);
        console.info(`📍 Rota carregada do banco: ${record.optimization_method}`);
      }
    };

    loadPersistedRoute();
  }, [selectedRoute, rotasOtimizadas]);

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
      <div className="space-y-6">
        <RouteStatsCards 
          totalOS={0}
          totalDistance={0}
          activeTechnicians={0}
          avgDuration={0}
        />
        
        <RouteFilters
          periodo={dateFilter}
          setPeriodo={setDateFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tecnicoFilter={tecnicoFilter}
          setTecnicoFilter={setTecnicoFilter}
          prioridadeFilter={prioridadeFilter}
          setPrioridadeFilter={setPrioridadeFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          tecnicos={tecnicos}
        />

        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma ordem de serviço encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {dateFilter !== 'todos' 
                  ? 'Não há OSs para o período selecionado. Tente ajustar os filtros acima.'
                  : 'Não há ordens de serviço cadastradas no sistema.'}
              </p>
            </div>
            {dateFilter !== 'todos' && (
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setDateFilter('todos');
                    setStatusFilter('todos');
                    setTecnicoFilter('todos');
                    setPrioridadeFilter('todas');
                    setSearchQuery('');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Calcular estatísticas gerais
  const totalOS = tickets.length;
  const totalDistance = rotasOtimizadas.reduce((sum, r) => {
    const km = parseFloat(r.distanciaTotal?.replace(' km', '') || '0');
    return sum + km;
  }, 0);
  const activeTechnicians = new Set(ordensServico.map(os => os.tecnico_id).filter(Boolean)).size;
  const avgDuration = ordensServico.reduce((sum, os) => {
    return sum + (os.tickets?.tempo_estimado || 0);
  }, 0) / (ordensServico.length || 1) * 60;

  // Contar por prioridade
  const priorityCounts = tickets.reduce((acc, t) => {
    const p = t.prioridade?.toLowerCase() || 'baixa';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

      {/* Stats Cards */}
      <RouteStatsCards 
        totalOS={totalOS}
        totalDistance={totalDistance}
        activeTechnicians={activeTechnicians}
        avgDuration={avgDuration}
      />

      {/* Filtros Avançados */}
      <RouteFilters
        periodo={dateFilter}
        setPeriodo={setDateFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tecnicoFilter={tecnicoFilter}
        setTecnicoFilter={setTecnicoFilter}
        prioridadeFilter={prioridadeFilter}
        setPrioridadeFilter={setPrioridadeFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        tecnicos={tecnicos}
      />

      {/* Botão de teste de geocodificação */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Testar Geocodificação Mapbox</p>
              <p className="text-xs text-muted-foreground">Verifica se o token está funcionando</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const enderecoTeste = "Avenida Paulista, 1578, São Paulo, SP";
              
              toast.info('🔍 Testando geocodificação...', {
                description: `Endereço: ${enderecoTeste}`
              });

              try {
                const { data, error } = await supabase.functions.invoke('mapbox-geocode', {
                  body: { address: enderecoTeste }
                });

                if (error) throw error;

                if (data?.success) {
                  toast.success('✅ Token Mapbox funcionando!', {
                    description: `Lat: ${data.data.latitude.toFixed(6)}, Lng: ${data.data.longitude.toFixed(6)}`
                  });
                } else {
                  toast.error('❌ Erro na geocodificação', {
                    description: data?.error || 'Erro desconhecido'
                  });
                }
              } catch (err: any) {
                toast.error('❌ Falha no teste', {
                  description: err.message || 'Verifique os logs'
                });
              }
            }}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Testar Agora
          </Button>
        </div>
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
                  <div className="flex items-start gap-3 mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {rota.tecnico.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm truncate">{rota.nome}</h4>
                        <Badge variant="outline" className="ml-2">{rota.ticketsData.length} OS</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{rota.tecnico}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">
                        {rota.ticketsData.filter((t: any) => t.status === 'concluido').length}/{rota.ticketsData.length}
                      </span>
                    </div>
                    <Progress 
                      value={(rota.ticketsData.filter((t: any) => t.status === 'concluido').length / rota.ticketsData.length) * 100} 
                      className="h-2"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{rota.distanciaTotal}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{rota.tempoEstimado}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      {rota.allGeocoded ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-green-600 font-medium">Rota Pronta</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                          <span className="text-yellow-600 font-medium">
                            {rota.ticketsData.filter((t: any) => !t.hasRealCoords).length} endereços pendentes
                          </span>
                        </>
                      )}
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
                        
                        // Determinar contexto para persistência
                        const firstTicket = rota.ticketsData[0];
                        const dates = rota.ticketsData
                          .map((t: any) => t.dataProgramada)
                          .filter(Boolean)
                          .map((d: string) => new Date(d));
                        const dataRota = (dates.length 
                          ? new Date(Math.min(...dates.map(d => d.getTime()))) 
                          : new Date()
                        ).toISOString().slice(0, 10);

                        const result = await optimizeRoute(rota.ticketsData, {
                          tecnicoId: firstTicket?.tecnicoId,
                          dataRota
                        });

                        if (result?.data?.route?.geometry) {
                          // Converter GeoJSON [lon, lat] para Leaflet [lat, lon]
                          const toLeaflet = (coords: [number, number][]) => 
                            coords.map(c => [c[1], c[0]] as [number, number]);
                          setRouteGeometry(toLeaflet(result.data.route.geometry));
                        } else {
                          // Fallback: linha direta
                          const coords = rota.ticketsData
                            .filter((t: any) => t.hasRealCoords)
                            .map((t: any) => t.coordenadas);
                          setRouteGeometry(coords.length > 1 ? coords : null);
                        }
                        setRouteProvider(result?.provider || null);
                        
                        setOptimizingRoute(null);
                      }}
                    >
                      <RouteIcon className={`h-4 w-4 mr-2 ${optimizingRoute === rota.id ? 'animate-spin' : ''}`} />
                      {optimizingRoute === rota.id ? 'Otimizando...' : 'Otimizar Rota'}
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

          {/* Timeline da Rota Selecionada */}
          {selectedRoute && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation2 className="h-5 w-5" />
                  Timeline da Rota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RouteTimeline 
                  items={rotasOtimizadas
                    .find(r => r.id === selectedRoute)
                    ?.ticketsData.map((t: any) => ({
                      id: t.id,
                      address: t.endereco,
                      priority: t.prioridade,
                      status: t.status
                    })) || []
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Legenda */}
          <RouteLegend
            criticalCount={rotasOtimizadas.reduce((sum, r) => 
              sum + r.ticketsData.filter((t: any) => t.prioridade === 'critica').length, 0)}
            highCount={rotasOtimizadas.reduce((sum, r) => 
              sum + r.ticketsData.filter((t: any) => t.prioridade === 'alta').length, 0)}
            mediumCount={rotasOtimizadas.reduce((sum, r) => 
              sum + r.ticketsData.filter((t: any) => t.prioridade === 'media').length, 0)}
            lowCount={rotasOtimizadas.reduce((sum, r) => 
              sum + r.ticketsData.filter((t: any) => t.prioridade === 'baixa').length, 0)}
            routeProvider={routeProvider}
          />
        </div>

        {/* Mapa - 2/3 */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              <div className="w-full h-[600px] rounded-lg overflow-hidden relative">
                <MapErrorBoundary>
                  <MapContainer
                    key="route-map"
                    center={[-16.6869, -49.2648]}
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
                      position={[-16.6869, -49.2648]}
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
                    
                    {/* Linha da rota selecionada com cores por provedor */}
                    {selectedRoute && (() => {
                      const getPolylineProps = (provider: typeof routeProvider) => {
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

                      if (routeGeometry && routeGeometry.length > 1) {
                        return (
                          <Polyline
                            positions={routeGeometry}
                            {...getPolylineProps(routeProvider)}
                          />
                        );
                      }
                      
                      return null;
                    })()}
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

export default React.memo(RouteMap);