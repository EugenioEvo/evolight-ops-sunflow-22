import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function RDO() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> RDO — Relatório Diário de Obra
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Em breve: lista e wizard do RDO (Fase 3).
        </CardContent>
      </Card>
    </div>
  );
}
