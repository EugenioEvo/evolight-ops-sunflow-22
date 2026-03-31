import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { equipmentService } from "../services/equipmentService";
import { equipamentoSchema, type EquipamentoForm } from "../types";

export function useEquipmentMutations(fetchEquipamentos: () => Promise<void>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<any>(null);
  const { handleError } = useErrorHandler();

  const form = useForm<EquipamentoForm>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: {
      nome: "", modelo: "", fabricante: "", numero_serie: "", tipo: "inversor",
      capacidade: "", tensao: "", corrente: "", data_instalacao: "", garantia: "",
      cliente_id: "", localizacao: "", observacoes: "",
    },
  });

  const onSubmit = async (data: EquipamentoForm) => {
    try {
      if (editingEquipamento) {
        await equipmentService.update(editingEquipamento.id, data);
        toast.success("Equipamento atualizado com sucesso!");
      } else {
        await equipmentService.create(data);
        toast.success("Equipamento criado com sucesso!");
      }
      form.reset();
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      fetchEquipamentos();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao salvar equipamento' });
    }
  };

  const handleEdit = (equipamento: any) => {
    setEditingEquipamento(equipamento);
    form.reset(equipamento);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await equipmentService.delete(id);
      toast.success("Equipamento removido com sucesso!");
      fetchEquipamentos();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao remover equipamento' });
    }
  };

  return { form, isDialogOpen, setIsDialogOpen, editingEquipamento, setEditingEquipamento, onSubmit, handleEdit, handleDelete };
}
