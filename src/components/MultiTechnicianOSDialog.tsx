import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useTechnicianAvailability } from "@/hooks/useTechnicianAvailability";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";

interface Prestador {
  id: string;
  nome: string;
  email: string;
}

interface MultiTechnicianOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticket?: any;
  prestadores: Prestador[];
  onSuccess?: () => void;
}

export const MultiTechnicianOSDialog = ({
  open,
  onOpenChange,
  ticketId,
  ticket,
  prestadores,
  onSuccess,
}: MultiTechnicianOSDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedPrestadores, setSelectedPrestadores] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    equipe: "",
    servico_solicitado: "MANUTENÇÃO",
    inspetor_responsavel: "TODOS",
    tipo_trabalho: [] as string[],
  });

  const { availabilityMap, checkAvailability, loading: checkingAvailability } = useTechnicianAvailability();

  // Check availability when dialog opens
  useEffect(() => {
    if (open && ticket?.data_servico && ticket?.horario_previsto_inicio) {
      const tempoEstimado = ticket.tempo_estimado || 1;
      const [h, m] = ticket.horario_previsto_inicio.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(h + tempoEstimado, m, 0, 0);
      const endTime = endDate.toTimeString().slice(0, 5);

      checkAvailability(
        prestadores,
        ticket.data_servico,
        ticket.horario_previsto_inicio,
        endTime
      );
    }
  }, [open, ticket, prestadores]);

  // Pre-select the assigned technician
  useEffect(() => {
    if (open && ticket?.tecnico_responsavel_id) {
      setSelectedPrestadores([ticket.tecnico_responsavel_id]);
    }
  }, [open, ticket]);

  const handleTogglePrestador = (prestadorId: string, checked: boolean) => {
    const availability = availabilityMap.get(prestadorId);
    if (availability && !availability.available && checked) {
      toast.error("Este técnico possui conflito de agenda no horário selecionado");
      return;
    }
    setSelectedPrestadores(prev =>
      checked ? [...prev, prestadorId] : prev.filter(id => id !== prestadorId)
    );
  };

  const handleTipoTrabalhoChange = (tipo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tipo_trabalho: checked
        ? [...prev.tipo_trabalho, tipo]
        : prev.tipo_trabalho.filter(t => t !== tipo),
    }));
  };

  const handleSubmit = async () => {
    if (selectedPrestadores.length === 0) {
      toast.error("Selecione ao menos um técnico");
      return;
    }
    if (formData.tipo_trabalho.length === 0) {
      toast.error("Selecione ao menos um tipo de trabalho");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const prestadorId of selectedPrestadores) {
        try {
          // Temporarily assign this prestador to the ticket for OS generation
          await supabase
            .from('tickets')
            .update({ tecnico_responsavel_id: prestadorId })
            .eq('id', ticketId);

          const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
            body: {
              ticketId,
              equipe: formData.equipe ? formData.equipe.split('/').map(n => n.trim()) : [],
              servico_solicitado: formData.servico_solicitado,
              inspetor_responsavel: formData.inspetor_responsavel,
              tipo_trabalho: formData.tipo_trabalho,
              tecnico_override_id: prestadorId,
            },
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Erro ao gerar OS');
          successCount++;
        } catch (err: any) {
          console.error(`Erro ao gerar OS para prestador ${prestadorId}:`, err);
          errorCount++;
        }
      }

      // Restore the first selected prestador as the main technician
      if (selectedPrestadores.length > 0) {
        await supabase
          .from('tickets')
          .update({ tecnico_responsavel_id: selectedPrestadores[0] })
          .eq('id', ticketId);
      }

      if (successCount > 0) {
        toast.success(`${successCount} OS gerada(s) com sucesso!${errorCount > 0 ? ` ${errorCount} falha(s).` : ''}`);
      } else {
        toast.error('Nenhuma OS foi gerada. Verifique os erros.');
      }

      onOpenChange(false);
      setSelectedPrestadores([]);
      setFormData({
        equipe: "",
        servico_solicitado: "MANUTENÇÃO",
        inspetor_responsavel: "TODOS",
        tipo_trabalho: [],
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Erro ao gerar OS múltiplas:', error);
      toast.error(error.message || 'Erro ao gerar Ordens de Serviço');
    } finally {
      setLoading(false);
    }
  };

  const hasDateInfo = ticket?.data_servico && ticket?.horario_previsto_inicio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Selecione um ou mais técnicos para gerar OS individuais para cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seleção de técnicos */}
          <div className="space-y-2">
            <Label>
              Técnicos <span className="text-red-500">*</span>
            </Label>
            {!hasDateInfo && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Sem data/horário definidos no ticket. A verificação de conflito de agenda está desabilitada.
                </AlertDescription>
              </Alert>
            )}
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {prestadores.map(prestador => {
                const availability = availabilityMap.get(prestador.id);
                const isSelected = selectedPrestadores.includes(prestador.id);
                const hasConflict = availability && !availability.available;
                const hasEmail = prestador.email && prestador.email.trim() !== '';

                return (
                  <div
                    key={prestador.id}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${
                      hasConflict ? 'bg-red-50/50 opacity-70' : ''
                    }`}
                  >
                    <Checkbox
                      id={`tech-${prestador.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleTogglePrestador(prestador.id, checked as boolean)
                      }
                      disabled={!!hasConflict || !hasEmail}
                    />
                    <label
                      htmlFor={`tech-${prestador.id}`}
                      className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <span className={!hasEmail ? 'text-destructive' : ''}>
                        {prestador.nome}
                      </span>
                      {!hasEmail && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Sem email
                        </Badge>
                      )}
                    </label>
                    <div className="flex-shrink-0">
                      {checkingAvailability ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : hasDateInfo && availability ? (
                        availability.available ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Disponível
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" />
                            Ocupado
                          </Badge>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedPrestadores.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedPrestadores.length} técnico(s) selecionado(s) — será gerada 1 OS para cada
              </p>
            )}
          </div>

          {/* Conflict details */}
          {Array.from(availabilityMap.values())
            .filter(a => !a.available && a.conflictDetails)
            .map(a => {
              const prest = prestadores.find(p => p.id === a.prestadorId);
              return (
                <Alert key={a.prestadorId} variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>{prest?.nome}</strong>: Conflito com {a.conflictDetails}
                  </AlertDescription>
                </Alert>
              );
            })}

          {/* Form fields */}
          <div className="space-y-2">
            <Label htmlFor="equipe">Equipe</Label>
            <Input
              id="equipe"
              placeholder="Ex: DIEGO / ADRIAN / RICHADS"
              value={formData.equipe}
              onChange={(e) => setFormData(prev => ({ ...prev, equipe: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Separe os nomes com "/" (barra)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servico">Serviço Solicitado</Label>
            <Input
              id="servico"
              value={formData.servico_solicitado}
              onChange={(e) => setFormData(prev => ({ ...prev, servico_solicitado: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspetor">Inspetor Responsável</Label>
            <Input
              id="inspetor"
              value={formData.inspetor_responsavel}
              onChange={(e) => setFormData(prev => ({ ...prev, inspetor_responsavel: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Tipo de Trabalho <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-6">
              {['internet', 'eletrica', 'limpeza'].map(tipo => (
                <div key={tipo} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tipo-${tipo}`}
                    checked={formData.tipo_trabalho.includes(tipo)}
                    onCheckedChange={(checked) => handleTipoTrabalhoChange(tipo, checked as boolean)}
                  />
                  <label htmlFor={`tipo-${tipo}`} className="text-sm font-medium">
                    {tipo === 'eletrica' ? 'ELÉTRICA' : tipo.toUpperCase()}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>ATENÇÃO:</strong> A OS deve ser preenchida e grampeada junto com o RME.
              Não será permitido RME sem a OS grampeada e/ou vinculada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedPrestadores.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar {selectedPrestadores.length > 1 ? `${selectedPrestadores.length} OS` : 'OS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
