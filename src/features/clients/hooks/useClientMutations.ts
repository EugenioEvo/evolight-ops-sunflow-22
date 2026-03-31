import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { clientService } from "../services/clientService";
import { clienteSchema, type ClienteForm, type Cliente } from "../types";

export function useClientMutations(fetchClientes: () => Promise<void>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const { handleError } = useErrorHandler();

  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      empresa: '', cnpj_cpf: '', endereco: '', cidade: '', estado: 'SP',
      cep: '', telefone: '', email: '', ufv_solarz: '', prioridade: 5, observacoes: ''
    }
  });

  const onSubmit = async (data: ClienteForm) => {
    try {
      if (editingClient) {
        await clientService.update(editingClient.id, editingClient.profile?.id, data);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await clientService.create(data);
        toast.success('Cliente adicionado com sucesso!');
      }
      setIsDialogOpen(false);
      setEditingClient(null);
      form.reset();
      fetchClientes();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao salvar cliente' });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingClient(cliente);
    form.reset({
      empresa: cliente.empresa, cnpj_cpf: cliente.cnpj_cpf, endereco: cliente.endereco,
      cidade: cliente.cidade, estado: cliente.estado, cep: cliente.cep,
      telefone: cliente.telefone, email: cliente.email,
      ufv_solarz: cliente.ufv_solarz || '', prioridade: cliente.prioridade ?? 5,
      observacoes: cliente.observacoes
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await clientService.delete(id);
      toast.success('Cliente removido com sucesso!');
      fetchClientes();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao remover cliente' });
    }
  };

  return { form, isDialogOpen, setIsDialogOpen, editingClient, setEditingClient, onSubmit, handleEdit, handleDelete };
}
