import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, Route as RouteIcon, RefreshCw, CheckCircle, AlertCircle, Calendar, Sparkles } from "lucide-react";
import { RouteExportButtons } from '@/components/RouteExportButtons';
import type { RotaOtimizada } from './types';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RouteListProps {
  rotas: RotaOtimizada[];
  selectedRoute: number | null;
  onSelectRoute: (id: number | null) => void;
  onGeocode: (rota: RotaOtimizada) => Promise<void>;
  onOptimize: (rota: RotaOtimizada) => Promise<void>;
  onOptimizeAll: () => Promise<void>;
  isGeocoding: boolean;
  optimizingRouteId: number | null;
  isOptimizingAll: boolean;
}

// Helper para formatar data da rota
const formatRouteDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Sem data';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "dd/MM (EEE)", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const RouteListComponent: React.FC<RouteListProps> = ({
  rotas,
  selectedRoute,
  onSelectRoute,
  onGeocode,
  onOptimize,
  onOptimizeAll,
  isGeocoding,
  optimizingRouteId,
  isOptimizingAll
}) => {
  // Rotas de hoje que podem ser otimizadas
  const todayRoutes = rotas.filter(r => r.dataRota && isToday(parseISO(r.dataRota)) && r.canOptimize && !r.isOptimized);
  const canOptimizeAllToday = todayRoutes.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <RouteIcon className="h-5 w-5" />
            <span>Rotas por Técnico/Dia</span>
          </CardTitle>
        </div>
        {canOptimizeAllToday && (
          <Button
            variant="default"
            size="sm"
            className="mt-3 w-full"
            disabled={isOptimizingAll || optimizingRouteId !== null}
            onClick={onOptimizeAll}
          >
            <Sparkles className={`h-4 w-4 mr-2 ${isOptimizingAll ? 'animate-pulse' : ''}`} />
            {isOptimizingAll 
              ? 'Otimizando todas...' 
              : `Otimizar Todas do Dia (${todayRoutes.length})`}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rotas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma rota encontrada com os filtros atuais
          </p>
        )}
        {rotas.map((rota) => (
          <div 
            key={rota.id}
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 animate-fade-in ${
              selectedRoute === rota.id 
                ? 'bg-primary/5 border-primary shadow-sm' 
                : 'hover:bg-muted/50 hover:border-muted-foreground/20'
            }`}
            onClick={() => onSelectRoute(selectedRoute === rota.id ? null : rota.id)}
          >
            <div className="flex items-start gap-3 mb-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {rota.tecnico.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm truncate">{rota.tecnico}</h4>
                  <div className="flex items-center gap-1.5">
                    {rota.isOptimized && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Otimizada
                      </Badge>
                    )}
                    <Badge variant="outline">{rota.ticketsData.length} OS</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium">{formatRouteDate(rota.dataRota)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">
                  {rota.ticketsData.filter(t => t.status === 'concluido').length}/{rota.ticketsData.length}
                </span>
              </div>
              <Progress 
                value={(rota.ticketsData.filter(t => t.status === 'concluido').length / rota.ticketsData.length) * 100} 
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
                      {rota.ticketsData.filter(t => !t.hasRealCoords).length} endereços pendentes
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
                disabled={isGeocoding}
                onClick={(e) => {
                  e.stopPropagation();
                  onGeocode(rota);
                }}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isGeocoding ? 'animate-spin' : ''}`} />
                {isGeocoding ? 'Geocodificando...' : 'Geocodificar Endereços'}
              </Button>
            )}
            
            {rota.canOptimize && (
              <Button 
                variant="default" 
                size="sm" 
                className="w-full mt-3"
                disabled={optimizingRouteId !== null}
                onClick={(e) => {
                  e.stopPropagation();
                  onOptimize(rota);
                }}
              >
                <RouteIcon className={`h-4 w-4 mr-2 ${optimizingRouteId === rota.id ? 'animate-spin' : ''}`} />
                {optimizingRouteId === rota.id ? 'Otimizando...' : 'Otimizar Rota'}
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
  );
};

export const RouteList = React.memo(RouteListComponent);
