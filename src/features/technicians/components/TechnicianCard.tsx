import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Award, UserCheck, UserX } from "lucide-react";
import type { Tecnico } from "../types";

interface TechnicianCardProps {
  tecnico: Tecnico;
  onEdit: (tecnico: Tecnico) => void;
  onToggleActive: (tecnico: Tecnico) => void;
}

export const TechnicianCard = ({ tecnico, onEdit, onToggleActive }: TechnicianCardProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{tecnico.profiles.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">{tecnico.profiles.email}</p>
          {tecnico.profiles.telefone && (
            <p className="text-sm text-muted-foreground">{tecnico.profiles.telefone}</p>
          )}
        </div>
        <Badge variant={tecnico.profiles.ativo ? "default" : "secondary"}>
          {tecnico.profiles.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {tecnico.regiao_atuacao && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{tecnico.regiao_atuacao}</span>
        </div>
      )}
      {tecnico.registro_profissional && (
        <div className="flex items-center gap-2 text-sm">
          <Award className="h-4 w-4 text-muted-foreground" />
          <span>{tecnico.registro_profissional}</span>
        </div>
      )}
      {tecnico.especialidades && tecnico.especialidades.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Especialidades:</p>
          <div className="flex flex-wrap gap-1">
            {tecnico.especialidades.map((esp, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">{esp}</Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(tecnico)}>
          Editar
        </Button>
        <Button
          variant={tecnico.profiles.ativo ? "destructive" : "default"}
          size="sm"
          className="flex-1"
          onClick={() => onToggleActive(tecnico)}
        >
          {tecnico.profiles.ativo ? (
            <><UserX className="h-4 w-4 mr-1" />Desativar</>
          ) : (
            <><UserCheck className="h-4 w-4 mr-1" />Ativar</>
          )}
        </Button>
      </div>
    </CardContent>
  </Card>
);
