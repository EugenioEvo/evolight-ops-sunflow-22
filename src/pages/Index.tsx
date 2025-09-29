import StatsCards from "@/components/StatsCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings } from "lucide-react";

const Index = () => {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Evolight</h1>
        <p className="text-muted-foreground">Sistema de Controle O&M Solar</p>
      </div>
      
      <StatsCards />
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-400">
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Config</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics" className="mt-6">
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Analytics Dashboard</h3>
            <p className="text-muted-foreground">Métricas de performance e relatórios em desenvolvimento</p>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <div className="text-center py-12">
            <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Configurações</h3>
            <p className="text-muted-foreground">Configurações do sistema e integrações</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
