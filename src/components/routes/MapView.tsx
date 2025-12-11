import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import MapErrorBoundary from './MapErrorBoundary';
import { 
  getPrioridadeColor, 
  getStatusColor,
  EVOLIGHT_COORDS 
} from './utils';
import type { TicketData, RotaOtimizada, RouteProvider } from './types';

interface MapViewProps {
  tickets: TicketData[];
  selectedRoute: number | null;
  rotas: RotaOtimizada[];
  routeGeometry: [number, number][] | null;
  routeProvider: RouteProvider;
}

// Validar coordenadas antes de renderizar
const isValidCoordinate = (coords: [number, number] | undefined): boolean => {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  const [lat, lon] = coords;
  return typeof lat === 'number' && typeof lon === 'number' &&
         !isNaN(lat) && !isNaN(lon) &&
         lat >= -90 && lat <= 90 &&
         lon >= -180 && lon <= 180;
};

// Lazy load do componente de mapa para evitar erros de SSR
const LazyMapContent = React.lazy(() => import('./MapContent'));

const MapViewComponent: React.FC<MapViewProps> = ({
  tickets,
  selectedRoute,
  rotas,
  routeGeometry,
  routeProvider
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const selectedRota = selectedRoute ? rotas.find(r => r.id === selectedRoute) : null;

  // Garantir que o componente só renderize no cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filtrar tickets com coordenadas válidas
  const validTickets = tickets.filter(t => isValidCoordinate(t.coordenadas));
  const validSelectedTickets = selectedRota?.ticketsData.filter(t => isValidCoordinate(t.coordenadas)) || [];

  // Filtrar geometria da rota para coordenadas válidas
  const validGeometry = routeGeometry?.filter(coord => isValidCoordinate(coord)) || [];

  if (!isMounted) {
    return (
      <Card className="h-full">
        <CardContent className="p-0 h-full">
          <div className="w-full h-[600px] rounded-lg overflow-hidden relative flex items-center justify-center bg-muted/50">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Carregando mapa...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="p-0 h-full">
        <div className="w-full h-[600px] rounded-lg overflow-hidden relative">
          {/* Indicador de provider */}
          {routeProvider && (
            <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium border">
              {routeProvider === 'mapbox' && <span className="text-blue-600">🗺️ Mapbox</span>}
              {routeProvider === 'osrm' && <span className="text-purple-600">🛣️ OSRM</span>}
              {routeProvider === 'local' && <span className="text-muted-foreground">📍 Local</span>}
            </div>
          )}
          
          <MapErrorBoundary>
            <React.Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                </div>
              </div>
            }>
              <LazyMapContent
                validTickets={validTickets}
                validSelectedTickets={validSelectedTickets}
                validGeometry={validGeometry}
                selectedRota={selectedRota}
                selectedRoute={selectedRoute}
                routeProvider={routeProvider}
              />
            </React.Suspense>
          </MapErrorBoundary>
        </div>
      </CardContent>
    </Card>
  );
};

export const MapView = React.memo(MapViewComponent);
