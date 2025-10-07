import DashboardStats from "@/components/DashboardStats";
import TechnicianDashboard from "@/components/TechnicianDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Activity } from "lucide-react";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const { profile } = useAuth();
  
  const loadRecentActivity = async () => {
    const { data } = await supabase
      .from('status_historico')
      .select(`
        *,
        tickets(numero_ticket, titulo),
        profiles:alterado_por(nome)
      `)
      .order('data_alteracao', { ascending: false })
      .limit(5);
    
    setRecentActivity(data || []);
  };

  useEffect(() => {
    loadRecentActivity();
  }, []);

  useTicketsRealtime({
    onTicketChange: loadRecentActivity
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'aberto': 'Aberto',
      'aguardando_aprovacao': 'Aguardando Aprovação',
      'aprovado': 'Aprovado',
      'rejeitado': 'Rejeitado',
      'ordem_servico_gerada': 'OS Gerada',
      'em_execucao': 'Em Execução',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado'
    };
    return labels[status] || status;
  };

  // Se for técnico, mostrar dashboard específico
  if (profile?.role === 'tecnico_campo') {
    return <TechnicianDashboard />;
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-solar bg-clip-text text-transparent">
          Dashboard Evolight
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Sistema de Controle O&M Solar
        </p>
      </div>
      
      <DashboardStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Atividade Recente
            </CardTitle>
            <CardDescription>Últimas atualizações de status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {activity.tickets?.numero_ticket} - {activity.tickets?.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusLabel(activity.status_anterior)} → {getStatusLabel(activity.status_novo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.data_alteracao).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Performance
            </CardTitle>
            <CardDescription>Métricas de eficiência do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Gráficos de performance em desenvolvimento</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
