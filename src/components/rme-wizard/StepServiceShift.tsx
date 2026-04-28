import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RMEFormData } from "@/pages/RMEWizard";

interface Props {
  formData: RMEFormData;
  updateFormData: (updates: Partial<RMEFormData>) => void;
}

const serviceTypes = [
  { value: "limpeza", label: "Limpeza" },
  { value: "eletrica", label: "Elétrica" },
  { value: "internet", label: "Internet" },
  { value: "outros", label: "Outros" },
];

export const StepServiceShift = ({ formData, updateFormData }: Props) => {
  const toggleServiceType = (value: string) => {
    const current = formData.service_type || [];
    const updated = current.includes(value)
      ? current.filter((t) => t !== value)
      : [...current, value];
    updateFormData({ service_type: updated });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date) {
      updateFormData({ data_fim_execucao: date.toISOString().split("T")[0] });
    }
  };

  const startDate = formData.data_execucao ? new Date(formData.data_execucao + "T12:00:00") : undefined;
  const endDate = formData.data_fim_execucao ? new Date(formData.data_fim_execucao + "T12:00:00") : undefined;

  // Trava: data_fim_execucao >= data_execucao
  const endBeforeStart = !!startDate && !!endDate && endDate < new Date(startDate.toDateString());
  // Trava: se mesmo dia, end_time > start_time
  const sameDay =
    !!startDate && !!endDate && startDate.toDateString() === endDate.toDateString();
  const endTimeBeforeStart =
    sameDay && !!formData.start_time && !!formData.end_time && formData.end_time <= formData.start_time;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Serviço e Execução</h2>
        <p className="text-sm text-muted-foreground">
          Tipo de serviço, datas e horários de execução
        </p>
      </div>

      {/* Service Type Multi-select */}
      <div className="space-y-3">
        <Label>Tipo de Serviço *</Label>
        <div className="grid grid-cols-2 gap-3">
          {serviceTypes.map((st) => (
            <label
              key={st.value}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                formData.service_type?.includes(st.value)
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox
                checked={formData.service_type?.includes(st.value)}
                onCheckedChange={() => toggleServiceType(st.value)}
              />
              <span className="font-medium">{st.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Início da Execução: Data + Hora — AUTOMÁTICO (puxado da OS) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Início preenchido automaticamente quando a OS foi iniciada — não editável.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Início da Execução</Label>
            <Input
              type="text"
              value={startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}
              disabled
              className="h-12 bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>Hora Início</Label>
            <Input
              type="time"
              value={formData.start_time}
              disabled
              className="h-12 bg-muted"
            />
          </div>
        </div>
      </div>

      {/* Fim da Execução: Data + Hora — MANUAL */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fim da Execução *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-12",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateChange}
                locale={ptBR}
                disabled={(d) => (startDate ? d < startDate : false)}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Hora Fim *</Label>
          <Input
            type="time"
            value={formData.end_time}
            onChange={(e) => updateFormData({ end_time: e.target.value })}
            className="h-12"
            min={sameDay ? formData.start_time : undefined}
          />
        </div>
      </div>

      {endBeforeStart && (
        <p className="text-sm text-destructive">
          A data de fim não pode ser anterior à data de início.
        </p>
      )}
      {endTimeBeforeStart && (
        <p className="text-sm text-destructive">
          A hora de fim deve ser posterior à hora de início (mesmo dia).
        </p>
      )}

      {/* Dia da semana (informativo) */}
      <div className="space-y-2">
        <Label>Dia da Semana (Início)</Label>
        <Input value={formData.weekday} disabled className="h-12 bg-muted" />
      </div>
    </div>
  );
};
