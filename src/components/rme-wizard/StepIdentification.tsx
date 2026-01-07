import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RMEFormData } from "@/pages/RMEWizard";

interface Props {
  formData: RMEFormData;
  updateFormData: (updates: Partial<RMEFormData>) => void;
}

export const StepIdentification = ({ formData, updateFormData }: Props) => {
  const [newCollaborator, setNewCollaborator] = useState("");

  const addCollaborator = () => {
    if (newCollaborator.trim() && !formData.collaboration.includes(newCollaborator.trim())) {
      updateFormData({ collaboration: [...formData.collaboration, newCollaborator.trim()] });
      setNewCollaborator("");
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
            <Label className="text-muted-foreground">UFV/SolarZ</Label>
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

      {/* Collaboration */}
      <div className="space-y-3">
        <Label>Colaboradores Presentes</Label>
        <div className="flex gap-2">
          <Input
            value={newCollaborator}
            onChange={(e) => setNewCollaborator(e.target.value)}
            placeholder="Nome do colaborador"
            className="h-12"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCollaborator();
              }
            }}
          />
          <Button type="button" onClick={addCollaborator} size="icon" className="h-12 w-12">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        {formData.collaboration.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.collaboration.map((name) => (
              <Badge key={name} variant="secondary" className="py-2 px-3 text-sm">
                {name}
                <button
                  type="button"
                  onClick={() => removeCollaborator(name)}
                  className="ml-2 hover:text-destructive"
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
