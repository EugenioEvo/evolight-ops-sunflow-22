import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, MapPin, Building2 } from "lucide-react";

interface RouteLegendProps {
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  routeProvider?: 'mapbox' | 'osrm' | 'local' | null;
}

export const RouteLegend = ({ 
  criticalCount = 0, 
  highCount = 0, 
  mediumCount = 0, 
  lowCount = 0,
  routeProvider = null
}: RouteLegendProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const priorities = [
    { color: '#dc2626', label: 'Crítica', count: criticalCount },
    { color: '#f97316', label: 'Alta', count: highCount },
    { color: '#eab308', label: 'Média', count: mediumCount },
    { color: '#22c55e', label: 'Baixa', count: lowCount },
  ];

  const routeProviders = [
    { type: 'mapbox', color: '#3b82f6', label: 'Mapbox (vias reais)', style: 'dashed' },
    { type: 'osrm', color: '#8b5cf6', label: 'OSRM (vias reais)', style: 'solid' },
    { type: 'local', color: '#6b7280', label: 'Linha direta (local)', style: 'dotted' },
  ];

  return (
    <Card className="mt-4">
      <CardContent 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Legenda do Mapa</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CardContent>
      
      {isOpen && (
        <CardContent className="px-3 pb-3 pt-0 space-y-3">
          {/* Ponto de Partida */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Ponto de Partida</p>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              <span className="text-xs">Sede Evolight</span>
            </div>
          </div>

          {/* Prioridades */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Prioridades</p>
            <div className="space-y-1">
              {priorities.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow-md" 
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs flex-1">{p.label}</span>
                  {p.count > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {p.count}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tipos de Rota */}
          {routeProvider && (
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground">Rota Otimizada</p>
              <div className="space-y-1">
                {routeProviders
                  .filter(rp => rp.type === routeProvider)
                  .map((rp) => (
                    <div key={rp.type} className="flex items-center gap-2">
                      <div 
                        className="w-8 h-0.5" 
                        style={{ 
                          backgroundColor: rp.color,
                          borderStyle: rp.style === 'dashed' ? 'dashed' : 'solid',
                          borderWidth: rp.style === 'dotted' ? '2px' : '0',
                          borderColor: rp.style === 'dotted' ? rp.color : 'transparent'
                        }}
                      />
                      <span className="text-xs">{rp.label}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
