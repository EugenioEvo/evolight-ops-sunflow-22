import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, Zap, MapPin } from "lucide-react";

const StatsCards = () => {
  const stats = [
    {
      title: "Tickets Abertos",
      value: "24",
      change: "+3",
      icon: Clock,
      className: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
      iconColor: "text-primary"
    },
    {
      title: "Críticos/Urgentes", 
      value: "8",
      change: "+2",
      icon: AlertTriangle,
      className: "bg-gradient-to-br from-red-50 to-red-100 border-red-200",
      iconColor: "text-destructive"
    },
    {
      title: "Finalizados Hoje",
      value: "12",
      change: "+5",
      icon: CheckCircle,
      className: "bg-gradient-to-br from-green-50 to-green-100 border-green-200", 
      iconColor: "text-success"
    },
    {
      title: "Capacidade Impactada",
      value: "2.4 MW",
      change: "-0.8 MW",
      icon: Zap,
      className: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
      iconColor: "text-secondary"
    },
    {
      title: "Rotas Ativas",
      value: "5",
      change: "3 otimizadas",
      icon: MapPin,
      className: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
      iconColor: "text-purple-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {stats.map((stat) => (
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
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change}
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

export default StatsCards;