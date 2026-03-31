import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { technicianService } from "../services/technicianService";
import type { Tecnico } from "../types";

export const useTechnicianMutations = (reload: () => void) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const { toast } = useToast();

  const handleEdit = (tecnico: Tecnico) => {
    setSelectedTecnico(tecnico);
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTecnico) return;

    const formData = new FormData(e.currentTarget);
    const especialidades = formData
      .get("especialidades")
      ?.toString()
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    try {
      await technicianService.update(selectedTecnico.id, {
        especialidades,
        regiao_atuacao: formData.get("regiao_atuacao")?.toString(),
        registro_profissional: formData.get("registro_profissional")?.toString(),
      });

      toast({ title: "Sucesso", description: "Técnico atualizado com sucesso" });
      setEditDialogOpen(false);
      setSelectedTecnico(null);
      reload();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar técnico",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (tecnico: Tecnico) => {
    try {
      await technicianService.toggleActive(tecnico.profile_id, tecnico.profiles.ativo);
      toast({
        title: "Sucesso",
        description: `Técnico ${tecnico.profiles.ativo ? "desativado" : "ativado"} com sucesso`,
      });
      reload();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    editDialogOpen,
    setEditDialogOpen,
    selectedTecnico,
    handleEdit,
    handleUpdate,
    handleToggleActive,
  };
};
