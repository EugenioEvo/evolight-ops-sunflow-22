import { useState } from "react";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { technicianService } from "../services/technicianService";
import type { Tecnico } from "../types";

export const useTechnicianMutations = (reload: () => void) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const { handleError } = useErrorHandler();

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

      toast.success("Técnico atualizado com sucesso");
      setEditDialogOpen(false);
      setSelectedTecnico(null);
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao atualizar técnico' });
    }
  };

  const handleToggleActive = async (tecnico: Tecnico) => {
    try {
      await technicianService.toggleActive(tecnico.profile_id, tecnico.profiles.ativo);
      toast.success(`Técnico ${tecnico.profiles.ativo ? "desativado" : "ativado"} com sucesso`);
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao atualizar status' });
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
