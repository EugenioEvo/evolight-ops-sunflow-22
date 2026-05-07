import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function Obras() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Obras
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Em breve: cadastro e gestão de obras EPC (Fase 2c).
        </CardContent>
      </Card>
    </div>
  );
}
