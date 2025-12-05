import React from 'react';
import { Clock, MapPin, Navigation, Car, Wrench, AlertTriangle, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { haversineDistance, EVOLIGHT_COORDS } from '@/components/routes/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TimelineItem {
  id: string;
  address: string;
  priority: string;
  estimatedArrival?: string;
  travelTime?: number;
  status?: string;
  coordenadas?: [number, number];
  hasRealCoords?: boolean;
  tempoServico?: number;
}

interface ETAResult {
  arrivalTime: string;
  departureTime: string;
  travelTimeMinutes: number;
  distanceKm: number;
  serviceTimeMinutes: number;
}

interface RouteTimelineProps {
  items: TimelineItem[];
  startTime?: string;
  averageSpeedKmh?: number;
  onReorder?: (items: TimelineItem[]) => void;
  editable?: boolean;
}

const URBAN_FACTOR = 1.3;

const calculateDynamicETAs = (
  items: TimelineItem[],
  startTime: string,
  startCoords: [number, number] = EVOLIGHT_COORDS,
  averageSpeedKmh: number = 40
): ETAResult[] => {
  const results: ETAResult[] = [];
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  let currentMinutes = startHours * 60 + startMinutes;
  let prevCoords = startCoords;

  for (const item of items) {
    let distanceKm = 0;
    let travelTimeMinutes = 0;

    if (item.coordenadas && item.hasRealCoords) {
      distanceKm = haversineDistance(
        prevCoords[0], prevCoords[1],
        item.coordenadas[0], item.coordenadas[1]
      ) * URBAN_FACTOR;
      
      travelTimeMinutes = Math.round((distanceKm / averageSpeedKmh) * 60);
      prevCoords = item.coordenadas;
    } else {
      travelTimeMinutes = 15;
      distanceKm = (travelTimeMinutes / 60) * averageSpeedKmh / URBAN_FACTOR;
    }

    currentMinutes += travelTimeMinutes;
    const arrivalHours = Math.floor(currentMinutes / 60);
    const arrivalMins = currentMinutes % 60;
    const arrivalTime = `${String(arrivalHours).padStart(2, '0')}:${String(arrivalMins).padStart(2, '0')}`;

    const serviceTimeMinutes = item.tempoServico || 30;

    currentMinutes += serviceTimeMinutes;
    const departureHours = Math.floor(currentMinutes / 60);
    const departureMins = currentMinutes % 60;
    const departureTime = `${String(departureHours).padStart(2, '0')}:${String(departureMins).padStart(2, '0')}`;

    results.push({
      arrivalTime,
      departureTime,
      travelTimeMinutes,
      distanceKm,
      serviceTimeMinutes
    });
  }

  return results;
};

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'critica': return 'destructive';
    case 'alta': return 'default';
    case 'media': return 'secondary';
    default: return 'outline';
  }
};

interface SortableItemProps {
  item: TimelineItem;
  eta: ETAResult;
  index: number;
  isLast: boolean;
  editable: boolean;
}

const SortableTimelineItem = ({ item, eta, index, isLast, editable }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const isEstimated = !item.hasRealCoords;

  return (
    <div ref={setNodeRef} style={style} className="relative pl-8 pb-4">
      {/* Timeline line */}
      <div className="absolute left-0 top-0 h-full w-px bg-border">
        {!isLast && (
          <div className="absolute top-6 left-0 w-px h-full bg-gradient-to-b from-primary/50 to-transparent" />
        )}
      </div>
      
      {/* Timeline dot with number */}
      <div className="absolute left-0 top-2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary-foreground">
        {index + 1}
      </div>

      {/* Travel info between points */}
      {eta.travelTimeMinutes > 0 && (
        <div className="absolute -left-3 top-9 text-xs text-muted-foreground flex items-center gap-1 bg-background px-1 rounded">
          <Car className="h-3 w-3" />
          <span>{eta.travelTimeMinutes}min</span>
          <span className="text-[10px]">({eta.distanceKm.toFixed(1)}km)</span>
        </div>
      )}

      <Card className={`p-3 hover:shadow-md transition-all ${isEstimated ? 'border-dashed border-warning/50' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}>
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          {editable && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Header with priority and arrival time */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                {item.priority}
              </Badge>
              <span className="text-sm font-bold text-primary">
                ⏰ {eta.arrivalTime}
              </span>
              {isEstimated && (
                <span className="text-xs text-warning flex items-center gap-1" title="Coordenadas estimadas">
                  <AlertTriangle className="h-3 w-3" />
                  ~estimado
                </span>
              )}
            </div>

            {/* Address */}
            <p className="text-sm font-medium truncate mb-2" title={item.address}>
              <MapPin className="inline h-3 w-3 mr-1 text-muted-foreground" />
              {item.address}
            </p>

            {/* Time details */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                Serviço: {eta.serviceTimeMinutes}min
              </span>
              <span className="flex items-center gap-1">
                🏁 Saída: {eta.departureTime}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

const RouteTimelineComponent = ({ 
  items, 
  startTime = "08:00",
  averageSpeedKmh = 40,
  onReorder,
  editable = false
}: RouteTimelineProps) => {
  const [localItems, setLocalItems] = React.useState(items);

  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(newItems);
      onReorder?.(newItems);
    }
  };
  
  if (!localItems || localItems.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma OS na rota</p>
      </Card>
    );
  }

  const etas = calculateDynamicETAs(localItems, startTime, EVOLIGHT_COORDS, averageSpeedKmh);
  
  const totalDistanceKm = etas.reduce((sum, eta) => sum + eta.distanceKm, 0);
  const totalTravelMinutes = etas.reduce((sum, eta) => sum + eta.travelTimeMinutes, 0);
  const totalServiceMinutes = etas.reduce((sum, eta) => sum + eta.serviceTimeMinutes, 0);
  const lastEta = etas[etas.length - 1];

  return (
    <div className="space-y-2">
      {/* Start point */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <Navigation className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Início da Rota</p>
          <p className="text-xs text-muted-foreground">Evolight - {startTime}</p>
        </div>
      </div>

      {/* Editable hint */}
      {editable && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <GripVertical className="h-3 w-3" />
          Arraste para reordenar as paradas
        </p>
      )}

      {/* Timeline items with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localItems.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {localItems.map((item, index) => (
            <SortableTimelineItem
              key={item.id}
              item={item}
              eta={etas[index]}
              index={index}
              isLast={index === localItems.length - 1}
              editable={editable}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Summary */}
      <Card className="p-4 bg-muted/50 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Resumo do Dia</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Distância total:</span>
            <span className="font-medium ml-1">{totalDistanceKm.toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-muted-foreground">Previsão término:</span>
            <span className="font-medium ml-1">{lastEta?.departureTime || '--:--'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tempo em trânsito:</span>
            <span className="font-medium ml-1">{Math.floor(totalTravelMinutes / 60)}h {totalTravelMinutes % 60}min</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tempo de serviço:</span>
            <span className="font-medium ml-1">{Math.floor(totalServiceMinutes / 60)}h {totalServiceMinutes % 60}min</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const RouteTimeline = React.memo(RouteTimelineComponent);
