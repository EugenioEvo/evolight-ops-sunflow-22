import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { TechnicianSchedule } from '@/hooks/useConflictCheck';
import { Badge } from '@/components/ui/badge';

interface ConflictWarningProps {
  conflicts: TechnicianSchedule[];
  technicianName?: string;
}

export const ConflictWarning: React.FC<ConflictWarningProps> = ({ 
  conflicts,
  technicianName 
}) => {
  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Conflito de Agenda Detectado</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          {technicianName ? `O técnico ${technicianName}` : 'Este técnico'} já possui {conflicts.length} {conflicts.length === 1 ? 'agendamento' : 'agendamentos'} neste horário:
        </p>
        <div className="space-y-2">
          {conflicts.map((conflict, index) => (
            <div key={index} className="flex items-center gap-2 text-sm bg-background/50 rounded p-2">
              {conflict.osNumber && (
                <Badge variant="outline" className="text-xs">
                  {conflict.osNumber}
                </Badge>
              )}
              <span className="font-medium">
                {conflict.startTime} - {conflict.endTime}
              </span>
              {conflict.ticketTitle && (
                <span className="text-muted-foreground truncate">
                  {conflict.ticketTitle}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm">
          Por favor, escolha outro horário ou técnico.
        </p>
      </AlertDescription>
    </Alert>
  );
};
