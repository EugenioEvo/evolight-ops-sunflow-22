import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

export default function GerenciarRDO() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" /> Aprovar RDOs
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Em breve: fluxo de aprovação de RDOs (Fase 4a).
        </CardContent>
      </Card>
    </div>
  );
}
