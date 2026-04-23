import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { clientService } from '../services/clientService';
import { clienteEditableSchema, type Cliente, type ClienteEditableForm } from '../types';

export function useClientMutations(refetch: () => Promise<void>) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const { handleError } = useErrorHandler();

  const form = useForm<ClienteEditableForm>({
    resolver: zodResolver(clienteEditableSchema),
    defaultValues: {
      ufv_solarz: '',
      prioridade: 5,
      observacoes: '',
    },
  });

  // Sync form with the selected client whenever the dialog target changes.
  useEffect(() => {
    if (editingClient) {
      form.reset({
        ufv_solarz: editingClient.ufv_solarz ?? '',
        prioridade: editingClient.prioridade ?? 5,
        observacoes: editingClient.observacoes ?? '',
      });
    }
  }, [editingClient, form]);

  const openClient = (cliente: Cliente) => {
    setEditingClient(cliente);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    form.reset({ ufv_solarz: '', prioridade: 5, observacoes: '' });
  };

  const onSubmit = async (data: ClienteEditableForm) => {
    if (!editingClient) return;
    setSaving(true);
    try {
      await clientService.updateEditable(editingClient.id, data);
      toast.success('Cliente atualizado com sucesso.');
      closeDialog();
      await refetch();
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao salvar alterações' });
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    saving,
    isDialogOpen,
    setIsDialogOpen,
    editingClient,
    openClient,
    closeDialog,
    onSubmit,
  };
}
