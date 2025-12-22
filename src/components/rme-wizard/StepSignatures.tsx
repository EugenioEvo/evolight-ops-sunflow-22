import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RMEFormData } from "@/pages/RMEWizard";

interface Props {
  formData: RMEFormData;
  updateFormData: (updates: Partial<RMEFormData>) => void;
}

interface Material {
  descricao: string;
  quantidade: number;
  tinha_estoque: boolean;
}

export const StepSignatures = ({ formData, updateFormData }: Props) => {
  const [newMaterial, setNewMaterial] = useState<Material>({
    descricao: "",
    quantidade: 1,
    tinha_estoque: true,
  });

  const addMaterial = () => {
    if (newMaterial.descricao.trim()) {
      updateFormData({
        materiais_utilizados: [...formData.materiais_utilizados, { ...newMaterial }],
      });
      setNewMaterial({ descricao: "", quantidade: 1, tinha_estoque: true });
    }
  };

  const removeMaterial = (index: number) => {
    updateFormData({
      materiais_utilizados: formData.materiais_utilizados.filter((_, i) => i !== index),
    });
  };

  const addSignature = (role: "responsavel" | "gerente_manutencao" | "gerente_projeto", nome: string) => {
    if (!nome.trim()) return;
    updateFormData({
      signatures: {
        ...formData.signatures,
        [role]: { nome, at: new Date().toISOString() },
      },
    });
  };

  const removeSignature = (role: "responsavel" | "gerente_manutencao" | "gerente_projeto") => {
    const updated = { ...formData.signatures };
    delete updated[role];
    updateFormData({ signatures: updated });
  };

  const signatureFields = [
    { key: "responsavel" as const, label: "Responsável Técnico" },
    { key: "gerente_manutencao" as const, label: "Gerente de Manutenção" },
    { key: "gerente_projeto" as const, label: "Gerente de Projeto" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Serviço, Materiais e Assinaturas</h2>
        <p className="text-sm text-muted-foreground">
          Descrição final, materiais utilizados e confirmações
        </p>
      </div>

      {/* Service Performed Notes */}
      <div className="space-y-2">
        <Label>Descrição do Serviço Realizado *</Label>
        <Textarea
          value={formData.servicos_executados}
          onChange={(e) => updateFormData({ servicos_executados: e.target.value })}
          placeholder="Descreva detalhadamente os serviços executados..."
          className="min-h-[150px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Mínimo de 10 caracteres. Seja detalhado.
        </p>
      </div>

      {/* Conditions Found */}
      <div className="space-y-2">
        <Label>Condições Encontradas</Label>
        <Textarea
          value={formData.condicoes_encontradas}
          onChange={(e) => updateFormData({ condicoes_encontradas: e.target.value })}
          placeholder="Descreva as condições encontradas no local..."
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Materials Used */}
      <div className="space-y-3">
        <Label>Materiais Utilizados</Label>
        
        {/* Add Material Form */}
        <div className="p-4 rounded-lg border space-y-3">
          <Input
            placeholder="Descrição do material"
            value={newMaterial.descricao}
            onChange={(e) => setNewMaterial({ ...newMaterial, descricao: e.target.value })}
            className="h-12"
          />
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <Input
                type="number"
                min="1"
                placeholder="Qtd"
                value={newMaterial.quantidade}
                onChange={(e) =>
                  setNewMaterial({ ...newMaterial, quantidade: parseInt(e.target.value) || 1 })
                }
                className="h-12"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={newMaterial.tinha_estoque}
                onCheckedChange={(checked) =>
                  setNewMaterial({ ...newMaterial, tinha_estoque: checked === true })
                }
              />
              <span className="text-sm">Em estoque</span>
            </label>
            <Button type="button" onClick={addMaterial} className="h-12">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Materials List */}
        {formData.materiais_utilizados.length > 0 && (
          <div className="space-y-2">
            {formData.materiais_utilizados.map((mat, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex-1">
                  <p className="font-medium">{mat.descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    Quantidade: {mat.quantidade} | {mat.tinha_estoque ? "Em estoque" : "Sem estoque"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMaterial(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="space-y-3">
        <Label>Assinaturas</Label>
        <div className="grid gap-3">
          {signatureFields.map((field) => {
            const signature = formData.signatures[field.key];
            return (
              <div key={field.key} className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{field.label}</p>
                    {signature ? (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {signature.nome}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Pendente</p>
                    )}
                  </div>
                  {signature ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSignature(field.key)}
                      className="text-destructive"
                    >
                      Remover
                    </Button>
                  ) : (
                    <SignatureInput
                      onConfirm={(nome) => addSignature(field.key, nome)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Simple signature input component
const SignatureInput = ({ onConfirm }: { onConfirm: (nome: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const handleConfirm = () => {
    if (nome.trim()) {
      onConfirm(nome.trim());
      setNome("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Assinar
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome"
        className="h-9 w-40"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
      />
      <Button size="sm" onClick={handleConfirm}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
