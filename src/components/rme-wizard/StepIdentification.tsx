import { useState } from "react";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { RMEFormData, TechnicianOption } from "@/pages/RMEWizard";

interface Props {
  formData: RMEFormData;
  updateFormData: (updates: Partial<RMEFormData>) => void;
  availableTechnicians?: TechnicianOption[];
}

export const StepIdentification = ({ formData, updateFormData, availableTechnicians = [] }: Props) => {
  const [open, setOpen] = useState(false);

  const toggleTechnician = (name: string) => {
    const current = formData.collaboration;
    if (current.includes(name)) {
      updateFormData({ collaboration: current.filter((c) => c !== name) });
    } else {
      updateFormData({ collaboration: [...current, name] });
    }
  };

  const removeCollaborator = (name: string) => {
    updateFormData({ collaboration: formData.collaboration.filter((c) => c !== name) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Identificação</h2>
        <p className="text-sm text-muted-foreground">
          Informações do local e equipe responsável
        </p>
      </div>

      {/* Read-only fields from OS */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Cliente</Label>
          <Input value={formData.client_name} disabled className="bg-muted" />
        </div>
        {formData.ufv_solarz && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Usina(s)</Label>
            <Input value={formData.ufv_solarz} disabled className="bg-amber-50 border-amber-200 text-amber-800" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Usina</Label>
          <Input value={formData.site_name} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Endereço</Label>
          <Input value={formData.address} disabled className="bg-muted" />
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Número Micro</Label>
          <Input
            value={formData.micro_number}
            onChange={(e) => updateFormData({ micro_number: e.target.value })}
            placeholder="Ex: MICRO-001"
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label>Número Inversor</Label>
          <Input
            value={formData.inverter_number}
            onChange={(e) => updateFormData({ inverter_number: e.target.value })}
            placeholder="Ex: INV-001"
            className="h-12"
          />
        </div>
      </div>

      {/* Collaboration — multi-select dropdown of technicians with approved OS for the ticket */}
      <div className="space-y-3">
        <Label>Colaboradores Presentes</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-12"
              disabled={availableTechnicians.length === 0}
            >
              <span className="flex items-center gap-2 text-left truncate">
                <Users className="h-4 w-4 shrink-0" />
                {availableTechnicians.length === 0
                  ? "Nenhum técnico aprovado neste ticket"
                  : formData.collaboration.length === 0
                  ? "Selecione os técnicos presentes"
                  : `${formData.collaboration.length} selecionado(s)`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar técnico..." />
              <CommandList>
                <CommandEmpty>Nenhum técnico encontrado.</CommandEmpty>
                <CommandGroup>
                  {availableTechnicians.map((tec) => {
                    const checked = formData.collaboration.includes(tec.nome);
                    return (
                      <CommandItem
                        key={tec.id}
                        value={tec.nome}
                        onSelect={() => toggleTechnician(tec.nome)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            checked ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{tec.nome}</span>
                          {tec.email && (
                            <span className="text-xs text-muted-foreground">{tec.email}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {formData.collaboration.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.collaboration.map((name) => (
              <Badge key={name} variant="secondary" className="py-2 px-3 text-sm">
                {name}
                <button
                  type="button"
                  onClick={() => removeCollaborator(name)}
                  className="ml-2 hover:text-destructive"
                  aria-label={`Remover ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
