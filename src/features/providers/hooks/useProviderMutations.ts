import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { providerService } from "../services/providerService";
import { prestadorSchema, type PrestadorForm, type Prestador } from "../types";

export const useProviderMutations = (reload: () => void) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null);
  const { handleError } = useErrorHandler();

  const form = useForm<PrestadorForm>({
    resolver: zodResolver(prestadorSchema),
    defaultValues: {
      nome: "", email: "", telefone: "", cpf: "", endereco: "", cidade: "",
      estado: "", cep: "", categoria: "", especialidades: [], certificacoes: [],
      experiencia: "", data_admissao: "",
    },
  });

  const onSubmit = async (data: PrestadorForm) => {
    try {
      if (editingPrestador) {
        await providerService.update(editingPrestador.id, data);
        toast.success("Prestador atualizado com sucesso!");
      } else {
        await providerService.create(data);
        toast.success("Prestador criado com sucesso!");
      }
      form.reset();
      setIsDialogOpen(false);
      setEditingPrestador(null);
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao salvar prestador' });
    }
  };

  const handleEdit = (prestador: Prestador) => {
    setEditingPrestador(prestador);
    form.reset({
      nome: prestador.nome || "", email: prestador.email || "",
      telefone: prestador.telefone || "", cpf: prestador.cpf || "",
      endereco: prestador.endereco || "", cidade: prestador.cidade || "",
      estado: prestador.estado || "", cep: prestador.cep || "",
      categoria: prestador.categoria || "", especialidades: prestador.especialidades || [],
      certificacoes: prestador.certificacoes || [], experiencia: prestador.experiencia || "",
      data_admissao: prestador.data_admissao || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await providerService.remove(id);
      toast.success("Prestador removido com sucesso!");
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao remover prestador' });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await providerService.approve(id);
      toast.success("Prestador aprovado com sucesso!");
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao aprovar prestador' });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await providerService.remove(id);
      toast.success("Prestador rejeitado e removido.");
      reload();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao rejeitar prestador' });
    }
  };

  const openNew = () => {
    setEditingPrestador(null);
    form.reset();
    setIsDialogOpen(true);
  };

  return {
    form, isDialogOpen, setIsDialogOpen, editingPrestador,
    onSubmit, handleEdit, handleDelete, handleApprove, handleReject, openNew,
  };
};
