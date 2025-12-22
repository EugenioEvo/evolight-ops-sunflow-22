import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const shifts = [
  { value: "manha", label: "Manhã (06:00 - 12:00)" },
  { value: "tarde", label: "Tarde (12:00 - 18:00)" },
  { value: "noite", label: "Noite (18:00 - 06:00)" },
];

const getWeekday = (date: Date): string => {
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return days[date.getDay()];
};

export const StepServiceShift = ({ formData, updateFormData }: Props) => {
  const toggleServiceType = (value: string) => {
    const current = formData.service_type || [];
    const updated = current.includes(value)
      ? current.filter((t) => t !== value)
      : [...current, value];
    updateFormData({ service_type: updated });
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      updateFormData({
        data_execucao: date.toISOString().split("T")[0],
        weekday: getWeekday(date),
      });
    }
  };

  const selectedDate = formData.data_execucao ? new Date(formData.data_execucao + "T12:00:00") : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Serviço e Turno</h2>
        <p className="text-sm text-muted-foreground">
          Tipo de serviço e horários de execução
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

      {/* Date and Weekday */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Data de Execução *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-12",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate
                  ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                  : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Dia da Semana</Label>
          <Input value={formData.weekday} disabled className="h-12 bg-muted" />
        </div>
      </div>

      {/* Shift */}
      <div className="space-y-2">
        <Label>Turno *</Label>
        <Select
          value={formData.shift}
          onValueChange={(value) => updateFormData({ shift: value })}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione o turno" />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Times */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Hora Início</Label>
          <Input
            type="time"
            value={formData.start_time}
            onChange={(e) => updateFormData({ start_time: e.target.value })}
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label>Hora Fim</Label>
          <Input
            type="time"
            value={formData.end_time}
            onChange={(e) => updateFormData({ end_time: e.target.value })}
            className="h-12"
          />
        </div>
      </div>
    </div>
  );
};
