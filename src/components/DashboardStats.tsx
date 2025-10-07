import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, FileText, Wrench, ClipboardCheck } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DashboardStats = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    ticketsAbertos: 0,
    ticketsCriticos: 0,
    ticketsHoje: 0,
    osGeradas: 0,
    emExecucao: 0,
    concluidos: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Total de tickets abertos (não concluídos/cancelados)
      const { count: ticketsAbertos } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(concluido,cancelado)');

      // Tickets críticos (alta prioridade + crítica)
      const { count: ticketsCriticos } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('prioridade', ['alta', 'critica'])
        .not('status', 'in', '(concluido,cancelado)');

      // Tickets finalizados hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const { count: ticketsHoje } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluido')
        .gte('data_conclusao', hoje.toISOString());

      // OS geradas hoje
      const { count: osGeradas } = await supabase
        .from('ordens_servico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hoje.toISOString());

      // Em execução
      const { count: emExecucao } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_execucao');

      // Total concluídos
      const { count: concluidos } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluido');

      setStats({
        ticketsAbertos: ticketsAbertos || 0,
        ticketsCriticos: ticketsCriticos || 0,
        ticketsHoje: ticketsHoje || 0,
        osGeradas: osGeradas || 0,
        emExecucao: emExecucao || 0,
        concluidos: concluidos || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Atualizar stats a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statsConfig = [
    {
      title: "Tickets Abertos",
      value: stats.ticketsAbertos,
      icon: Clock,
      className: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
      iconColor: "text-primary"
    },
    {
      title: "Críticos/Urgentes", 
      value: stats.ticketsCriticos,
      icon: AlertTriangle,
      className: "bg-gradient-to-br from-red-50 to-red-100 border-red-200",
      iconColor: "text-destructive"
    },
    {
      title: "Finalizados Hoje",
      value: stats.ticketsHoje,
      icon: CheckCircle,
      className: "bg-gradient-to-br from-green-50 to-green-100 border-green-200", 
      iconColor: "text-success"
    },
    {
      title: "OS Geradas Hoje",
      value: stats.osGeradas,
      icon: FileText,
      className: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
      iconColor: "text-purple-600"
    },
    {
      title: "Em Execução",
      value: stats.emExecucao,
      icon: Wrench,
      className: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
      iconColor: "text-secondary"
    },
    {
      title: "Total Concluídos",
      value: stats.concluidos,
      icon: ClipboardCheck,
      className: "bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200",
      iconColor: "text-teal-600"
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
      {statsConfig.map((stat) => (
        <Card key={stat.title} className={`${stat.className} shadow-sm hover:shadow-md transition-all duration-300`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-full bg-white/80 ${stat.iconColor}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;
