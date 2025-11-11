import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, TrendingUp, Users } from "lucide-react";

interface RouteStatsCardsProps {
  totalOS: number;
  totalDistance: number;
  activeTechnicians: number;
  avgDuration: number;
}

export const RouteStatsCards = ({ 
  totalOS, 
  totalDistance, 
  activeTechnicians, 
  avgDuration 
}: RouteStatsCardsProps) => {
  const stats = [
    {
      icon: MapPin,
      label: "Total de OSs",
      value: totalOS,
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      label: "Distância Total",
      value: `${totalDistance.toFixed(1)} km`,
      color: "text-chart-2"
    },
    {
      icon: Users,
      label: "Técnicos Ativos",
      value: activeTechnicians,
      color: "text-chart-3"
    },
    {
      icon: Clock,
      label: "Duração Média",
      value: `${Math.round(avgDuration)} min`,
      color: "text-chart-4"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
