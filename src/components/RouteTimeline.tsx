import React from 'react';
import { Clock, MapPin, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TimelineItem {
  id: string;
  address: string;
  priority: string;
  estimatedArrival?: string;
  travelTime?: number;
  status?: string;
}

interface RouteTimelineProps {
  items: TimelineItem[];
  startTime?: string;
}

const RouteTimelineComponent = ({ items, startTime = "08:00" }: RouteTimelineProps) => {
  const calculateEstimatedTime = (index: number, baseTime: string) => {
    const [hours, minutes] = baseTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + (index * 30); // Estimativa de 30min por OS
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critica': return 'destructive';
      case 'alta': return 'default';
      case 'media': return 'secondary';
      default: return 'outline';
    }
  };

  if (!items || items.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma OS na rota</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
        <Navigation className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Início da Rota</p>
          <p className="text-xs text-muted-foreground">Evolight - {startTime}</p>
        </div>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="relative pl-8 pb-4">
          <div className="absolute left-0 top-0 h-full w-px bg-border">
            {index < items.length - 1 && (
              <div className="absolute top-6 left-0 w-px h-full bg-gradient-to-b from-primary/50 to-transparent" />
            )}
          </div>
          
          <div className="absolute left-0 top-2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background" />

          <Card className="p-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                    {item.priority}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {calculateEstimatedTime(index, startTime)}
                  </span>
                </div>
                <p className="text-sm font-medium truncate" title={item.address}>
                  <MapPin className="inline h-3 w-3 mr-1" />
                  {item.address}
                </p>
                {item.travelTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="inline h-3 w-3 mr-1" />
                    ~{item.travelTime} min de viagem
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
};

export const RouteTimeline = React.memo(RouteTimelineComponent);
