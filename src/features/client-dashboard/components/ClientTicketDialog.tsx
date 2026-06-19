import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const schema = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres'),
  descricao: z.string().min(5, 'Descreva o problema'),
  ufv_nome: z.string().optional().nullable(),
  equipamento_tipo: z.enum(['painel_solar', 'inversor', 'bateria', 'estrutura', 'cabeamento', 'outros']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
  endereco_servico: z.string().min(5, 'Endereço obrigatório'),
  observacoes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: any;
  editingTicket?: any | null;
  onSaved: () => void;
}

const buildEndereco = (o: { endereco?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null }) =>
  [o.endereco, o.cidade, o.estado].filter(Boolean).join(', ') + (o.cep ? ` - ${o.cep}` : '');

export const ClientTicketDialog = ({ open, onOpenChange, cliente, editingTicket, onSaved }: Props) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titulo: '', descricao: '', ufv_nome: '', equipamento_tipo: 'painel_solar',
      prioridade: 'media', endereco_servico: '', observacoes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingTicket) {
      form.reset({
        titulo: editingTicket.titulo || '',
        descricao: editingTicket.descricao || '',
        ufv_nome: editingTicket.ufv_nome || '',
        equipamento_tipo: (editingTicket.equipamento_tipo as FormData['equipamento_tipo']) || 'painel_solar',
        prioridade: (editingTicket.prioridade as FormData['prioridade']) || 'media',
        endereco_servico: editingTicket.endereco_servico || '',
        observacoes: editingTicket.observacoes || '',
      });
    } else {
      const defaultUfv = cliente?.cliente_ufvs?.length === 1 ? cliente.cliente_ufvs[0] : null;
      form.reset({
        titulo: '', descricao: '',
        ufv_nome: defaultUfv?.nome || '',
        equipamento_tipo: 'painel_solar',
        prioridade: 'media',
        endereco_servico: defaultUfv ? buildEndereco(defaultUfv) : buildEndereco(cliente || {}),
        observacoes: '',
      });
    }
  }, [open, editingTicket, cliente, form]);

  const watchedUfv = form.watch('ufv_nome');
  useEffect(() => {
    if (editingTicket) return;
    const ufv = cliente?.cliente_ufvs?.find((u: any) => u.nome === watchedUfv);
    if (ufv) form.setValue('endereco_servico', buildEndereco(ufv));
  }, [watchedUfv, cliente, editingTicket, form]);

  const onSubmit = async (data: FormData) => {
    if (!cliente?.id || !user?.id) return;
    setSaving(true);
    try {
      const payload = {
        titulo: data.titulo.trim(),
        descricao: data.descricao.trim(),
        ufv_nome: data.ufv_nome?.trim() || null,
        equipamento_tipo: data.equipamento_tipo,
        prioridade: data.prioridade,
        endereco_servico: data.endereco_servico.trim(),
        observacoes: data.observacoes?.trim() || null,
      };

      if (editingTicket) {
        const { error } = await supabase.from('tickets').update(payload).eq('id', editingTicket.id);
        if (error) throw error;
        toast.success('Chamado atualizado.');
      } else {
        const { error } = await supabase.from('tickets').insert({
          ...payload,
          cliente_id: cliente.id,
          created_by: user.id,
          numero_ticket: '',
          status: 'aberto',
        } as any);
        if (error) throw error;
        toast.success('Chamado aberto! Nossa equipe já foi notificada.');
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar chamado');
    } finally {
      setSaving(false);
    }
  };

  const ufvs: any[] = cliente?.cliente_ufvs || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTicket ? 'Editar chamado' : 'Abrir novo chamado'}</DialogTitle>
          <DialogDescription>
            {editingTicket
              ? 'Atualize as informações enquanto o chamado ainda não entrou em atendimento.'
              : 'Descreva o que precisa de atenção e nossa equipe avaliará em seguida.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Ex.: Inversor com alarme" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea rows={4} placeholder="Descreva o problema observado" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ufvs.length > 0 && (
                <FormField control={form.control} name="ufv_nome" render={({ field }) => (
                  <FormItem><FormLabel>UFV</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione a UFV" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ufvs.map((u) => <SelectItem key={u.id} value={u.nome}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="equipamento_tipo" render={({ field }) => (
                <FormItem><FormLabel>Equipamento</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="painel_solar">Painel solar</SelectItem>
                      <SelectItem value="inversor">Inversor</SelectItem>
                      <SelectItem value="bateria">Bateria</SelectItem>
                      <SelectItem value="estrutura">Estrutura</SelectItem>
                      <SelectItem value="cabeamento">Cabeamento</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="prioridade" render={({ field }) => (
                <FormItem><FormLabel>Prioridade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="endereco_servico" render={({ field }) => (
              <FormItem><FormLabel>Endereço do atendimento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem><FormLabel>Observações (opcional)</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editingTicket ? 'Salvar alterações' : 'Abrir chamado'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
