import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RouteLegendProps {
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
}

export const RouteLegend = ({ 
  criticalCount = 0, 
  highCount = 0, 
  mediumCount = 0, 
  lowCount = 0 
}: RouteLegendProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const legendItems = [
    { 
      label: "Crítica", 
      color: "bg-red-500", 
      count: criticalCount,
      icon: "🔴"
    },
    { 
      label: "Alta", 
      color: "bg-orange-500", 
      count: highCount,
      icon: "🟠"
    },
    { 
      label: "Média", 
      color: "bg-yellow-500", 
      count: mediumCount,
      icon: "🟡"
    },
    { 
      label: "Baixa", 
      color: "bg-green-500", 
      count: lowCount,
      icon: "🟢"
    }
  ];

  const routeStyles = [
    { label: "Mapbox (Otimizada)", style: "border-t-2 border-dashed border-blue-500", color: "text-blue-500" },
    { label: "OSRM (Alternativa)", style: "border-t-2 border-purple-500", color: "text-purple-500" },
    { label: "Local (Básica)", style: "border-t-2 border-dotted border-gray-500", color: "text-gray-500" }
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Legenda do Mapa
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8 p-0"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Prioridades</p>
            <div className="space-y-1">
              {legendItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {item.count}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tipos de Rota</p>
            <div className="space-y-2">
              {routeStyles.map((route, idx) => (
                <div key={idx} className="space-y-1">
                  <div className={`w-full ${route.style}`} />
                  <p className={`text-xs ${route.color}`}>{route.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-xs">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="font-medium">Ponto Inicial: Evolight</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
