import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation2, Save, RotateCcw } from "lucide-react";
import { RouteTimeline } from '@/components/RouteTimeline';
import { toast } from "sonner";
import type { RotaOtimizada, TicketData } from './types';

interface TimelineItem {
  id: string;
  address: string;
  priority: string;
  status?: string;
  coordenadas?: [number, number];
  hasRealCoords?: boolean;
  tempoServico?: number;
}

interface RouteDetailsProps {
  selectedRoute: number | null;
  rotas: RotaOtimizada[];
  onRouteUpdate?: (routeId: number, newTicketsOrder: TicketData[]) => void;
}

const RouteDetailsComponent: React.FC<RouteDetailsProps> = ({
  selectedRoute,
  rotas,
  onRouteUpdate
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [reorderedItems, setReorderedItems] = useState<TimelineItem[] | null>(null);

  if (!selectedRoute) return null;

  const rota = rotas.find(r => r.id === selectedRoute);
  if (!rota) return null;

  const originalTimelineItems = rota.ticketsData.map(t => ({
    id: t.id,
    address: t.endereco,
    priority: t.prioridade,
    status: t.status,
    coordenadas: t.coordenadas,
    hasRealCoords: t.hasRealCoords,
    tempoServico: parseInt(t.estimativa) || 30
  }));

  const handleReorder = useCallback((newItems: TimelineItem[]) => {
    setReorderedItems(newItems);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!reorderedItems || !onRouteUpdate) return;

    // Reconstruct ticketsData in new order
    const newTicketsOrder = reorderedItems.map((item, index) => {
      const originalTicket = rota.ticketsData.find(t => t.id === item.id);
      if (!originalTicket) return null;
      return { ...originalTicket, ordem: index };
    }).filter(Boolean) as TicketData[];

    onRouteUpdate(selectedRoute, newTicketsOrder);
    setHasChanges(false);
    toast.success("Ordem da rota atualizada!");
  }, [reorderedItems, onRouteUpdate, rota.ticketsData, selectedRoute]);

  const handleReset = useCallback(() => {
    setReorderedItems(null);
    setHasChanges(false);
  }, []);

  const currentItems = reorderedItems || originalTimelineItems;

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Navigation2 className="h-5 w-5" />
          Timeline da Rota
        </CardTitle>
        {hasChanges && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Desfazer
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Salvar Ordem
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <RouteTimeline 
          items={currentItems} 
          editable={true}
          onReorder={handleReorder}
        />
      </CardContent>
    </Card>
  );
};

export const RouteDetails = React.memo(RouteDetailsComponent);
