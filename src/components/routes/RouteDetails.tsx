import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation2 } from "lucide-react";
import { RouteTimeline } from '@/components/RouteTimeline';
import type { RotaOtimizada } from './types';

interface RouteDetailsProps {
  selectedRoute: number | null;
  rotas: RotaOtimizada[];
}

const RouteDetailsComponent: React.FC<RouteDetailsProps> = ({
  selectedRoute,
  rotas
}) => {
  if (!selectedRoute) return null;

  const rota = rotas.find(r => r.id === selectedRoute);
  if (!rota) return null;

  const timelineItems = rota.ticketsData.map(t => ({
    id: t.id,
    address: t.endereco,
    priority: t.prioridade,
    status: t.status
  }));

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation2 className="h-5 w-5" />
          Timeline da Rota
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RouteTimeline items={timelineItems} />
      </CardContent>
    </Card>
  );
};

export const RouteDetails = React.memo(RouteDetailsComponent);
