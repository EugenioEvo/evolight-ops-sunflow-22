import RouteMap from "@/components/RouteMap";
import { Map } from "lucide-react";

const RoutesPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Map className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gestão de Rotas</h1>
              <p className="text-sm text-muted-foreground">
                Otimize e visualize as rotas dos técnicos em tempo real
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <RouteMap />
      </div>
    </div>
  );
};

export default RoutesPage;