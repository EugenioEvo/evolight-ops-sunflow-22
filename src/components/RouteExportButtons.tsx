import { Button } from "@/components/ui/button";
import { ExternalLink, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RouteExportButtonsProps {
  tickets: Array<{
    coordenadas: [number, number];
    endereco: string;
    hasRealCoords: boolean;
  }>;
}

export const RouteExportButtons = ({ tickets }: RouteExportButtonsProps) => {
  const { toast } = useToast();

  const exportToWaze = () => {
    const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
    
    if (ticketsWithCoords.length === 0) {
      toast({
        title: 'Nenhuma coordenada válida',
        description: 'Geocodifique os endereços primeiro',
        variant: 'destructive'
      });
      return;
    }

    // Waze só suporta um destino por vez, então vamos abrir o primeiro
    const firstTicket = ticketsWithCoords[0];
    const url = `https://waze.com/ul?ll=${firstTicket.coordenadas[0]},${firstTicket.coordenadas[1]}&navigate=yes`;

    window.open(url, '_blank');

    toast({
      title: 'Primeira parada exportada',
      description: 'Abrindo no Waze... (Waze suporta apenas um destino)'
    });
  };

  const exportToOpenStreetMap = () => {
    const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
    if (ticketsWithCoords.length < 2) {
      toast({
        title: 'Selecione ao menos 2 pontos',
        description: 'A rota do OpenStreetMap precisa de origem e destino',
      });
      return;
    }

    // OSM directions com OSRM (carro)
    const routeParam = ticketsWithCoords
      .map(t => `${t.coordenadas[0]},${t.coordenadas[1]}`)
      .join(';');

    const url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(routeParam)}`;
    window.open(url, '_blank');

    toast({ title: 'Rota exportada', description: 'Abrindo no OpenStreetMap...' });
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToOpenStreetMap}
        className="flex-1"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        OpenStreetMap
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToWaze}
        className="flex-1"
      >
        <Navigation className="h-4 w-4 mr-2" />
        Waze
      </Button>
    </div>
  );
};
