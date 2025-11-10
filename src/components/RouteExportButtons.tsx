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

  const exportToGoogleMaps = () => {
    const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
    
    if (ticketsWithCoords.length === 0) {
      toast({
        title: 'Nenhuma coordenada válida',
        description: 'Geocodifique os endereços primeiro',
        variant: 'destructive'
      });
      return;
    }

    // Google Maps directions URL com múltiplos waypoints
    const origin = `${ticketsWithCoords[0].coordenadas[0]},${ticketsWithCoords[0].coordenadas[1]}`;
    const destination = ticketsWithCoords.length > 1
      ? `${ticketsWithCoords[ticketsWithCoords.length - 1].coordenadas[0]},${ticketsWithCoords[ticketsWithCoords.length - 1].coordenadas[1]}`
      : origin;

    const waypoints = ticketsWithCoords
      .slice(1, -1)
      .map(t => `${t.coordenadas[0]},${t.coordenadas[1]}`)
      .join('|');

    const url = waypoints
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    window.open(url, '_blank');

    toast({
      title: 'Rota exportada',
      description: 'Abrindo no Google Maps...'
    });
  };

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

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToGoogleMaps}
        className="flex-1"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Google Maps
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
