import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Camera, FileText, Download, Plus, Search } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

const rmeSchema = z.object({
  condicoes_encontradas: z.string().min(1, 'Campo obrigatório'),
  servicos_executados: z.string().min(1, 'Campo obrigatório'),
  materiais_utilizados: z.record(z.number()).optional(),
  medicoes_eletricas: z.record(z.string()).optional(),
  testes_realizados: z.string().optional(),
  observacoes_tecnicas: z.string().optional(),
  data_execucao: z.string().min(1, 'Data de execução obrigatória'),
  nome_cliente_assinatura: z.string().min(1, 'Nome do cliente obrigatório'),
});

type RMEForm = z.infer<typeof rmeSchema>;

const RME = () => {
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [rmes, setRmes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRME, setEditingRME] = useState<any>(null);
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fotosBefore, setFotosBefore] = useState<File[]>([]);
  const [fotosAfter, setFotosAfter] = useState<File[]>([]);
  const [tecnicoSignature, setTecnicoSignature] = useState<string>('');
  const [clienteSignature, setClienteSignature] = useState<string>('');

  const { user, profile } = useAuth();
  const { toast } = useToast();

  let sigCanvasTecnico: SignatureCanvas | null = null;
  let sigCanvasCliente: SignatureCanvas | null = null;

  const form = useForm<RMEForm>({
    resolver: zodResolver(rmeSchema),
    defaultValues: {
      condicoes_encontradas: '',
      servicos_executados: '',
      testes_realizados: '',
      observacoes_tecnicas: '',
      data_execucao: new Date().toISOString().split('T')[0],
      nome_cliente_assinatura: '',
    },
  });

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar ordens de serviço pendentes de RME
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            *,
            clientes!inner(
              empresa,
              profiles!inner(nome, email)
            )
          )
        `)
        .eq('tickets.status', 'em_execucao')
        .order('created_at', { ascending: false });

      setOrdensServico(osData || []);

      // Carregar RMEs existentes
      const { data: rmeData } = await supabase
        .from('rme_relatorios')
        .select(`
          *,
          tickets!inner(
            titulo,
            numero_ticket,
            clientes!inner(
              empresa,
              profiles!inner(nome)
            )
          ),
          tecnicos!inner(
            profiles!inner(nome)
          )
        `)
        .order('created_at', { ascending: false });

      setRmes(rmeData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uploadPhotos = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of files) {
      const fileName = `${user?.id}/${folder}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('rme-fotos')
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('rme-fotos')
        .getPublicUrl(fileName);
      
      urls.push(data.publicUrl);
    }
    
    return urls;
  };

  const onSubmit = async (data: RMEForm) => {
    try {
      setLoading(true);

      if (!selectedOS) {
        throw new Error('Selecione uma ordem de serviço');
      }

      // Upload das fotos
      const fotosAntesUrls = await uploadPhotos(fotosBefore, 'antes');
      const fotosDepoisUrls = await uploadPhotos(fotosAfter, 'depois');

      const rmeData = {
        ...data,
        ticket_id: selectedOS.ticket_id,
        ordem_servico_id: selectedOS.id,
        tecnico_id: profile?.tecnicos?.[0]?.id,
        materiais_utilizados: data.materiais_utilizados || {},
        medicoes_eletricas: data.medicoes_eletricas || {},
        fotos_antes: fotosAntesUrls,
        fotos_depois: fotosDepoisUrls,
        assinatura_tecnico: tecnicoSignature,
        assinatura_cliente: clienteSignature,
        data_execucao: new Date(data.data_execucao).toISOString(),
      };

      if (editingRME) {
        const { error } = await supabase
          .from('rme_relatorios')
          .update(rmeData as any)
          .eq('id', editingRME.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'RME atualizado com sucesso!',
        });
      } else {
        const { error } = await supabase
          .from('rme_relatorios')
          .insert([rmeData as any]);

        if (error) throw error;

        // Atualizar status do ticket
        await supabase
          .from('tickets')
          .update({ status: 'concluido' })
          .eq('id', selectedOS.ticket_id);

        toast({
          title: 'Sucesso',
          description: 'RME criado com sucesso! Ticket marcado como concluído.',
        });
      }

      setIsDialogOpen(false);
      setEditingRME(null);
      setSelectedOS(null);
      setFotosBefore([]);
      setFotosAfter([]);
      setTecnicoSignature('');
      setClienteSignature('');
      form.reset();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar RME:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar RME',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = Array.from(event.target.files || []);
    if (type === 'before') {
      setFotosBefore(prev => [...prev, ...files]);
    } else {
      setFotosAfter(prev => [...prev, ...files]);
    }
  };

  const removePhoto = (index: number, type: 'before' | 'after') => {
    if (type === 'before') {
      setFotosBefore(prev => prev.filter((_, i) => i !== index));
    } else {
      setFotosAfter(prev => prev.filter((_, i) => i !== index));
    }
  };

  const clearSignature = (type: 'tecnico' | 'cliente') => {
    if (type === 'tecnico' && sigCanvasTecnico) {
      sigCanvasTecnico.clear();
      setTecnicoSignature('');
    } else if (type === 'cliente' && sigCanvasCliente) {
      sigCanvasCliente.clear();
      setClienteSignature('');
    }
  };

  const saveSignature = (type: 'tecnico' | 'cliente') => {
    if (type === 'tecnico' && sigCanvasTecnico) {
      setTecnicoSignature(sigCanvasTecnico.toDataURL());
    } else if (type === 'cliente' && sigCanvasCliente) {
      setClienteSignature(sigCanvasCliente.toDataURL());
    }
  };

  const filteredRMEs = rmes.filter(rme => 
    rme.tickets?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.numero_ticket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && rmes.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RME - Relatório de Manutenção Elétrica</h1>
          <p className="text-muted-foreground">Gerencie relatórios técnicos de manutenção</p>
        </div>
        
        {profile?.role === 'tecnico_campo' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRME(null); form.reset(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo RME
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRME ? 'Editar RME' : 'Criar Novo RME'}</DialogTitle>
                <DialogDescription>
                  Preencha o relatório de manutenção elétrica
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Seleção da OS */}
                  {!editingRME && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ordem de Serviço</label>
                      <Select onValueChange={(value) => {
                        const os = ordensServico.find(o => o.id === value);
                        setSelectedOS(os);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma ordem de serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {ordensServico.map((os) => (
                            <SelectItem key={os.id} value={os.id}>
                              {os.numero_os} - {os.tickets.titulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_execucao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Execução</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nome_cliente_assinatura"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Cliente (Assinatura)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome completo do cliente" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="condicoes_encontradas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condições Encontradas</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descreva as condições encontradas no local..." rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="servicos_executados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serviços Executados</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descreva detalhadamente os serviços executados..." rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="testes_realizados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Testes Realizados</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descreva os testes realizados..." rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observacoes_tecnicas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações Técnicas</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Observações adicionais..." rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Upload de Fotos */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fotos Antes</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'before')}
                          className="hidden"
                          id="photos-before"
                        />
                        <label htmlFor="photos-before" className="cursor-pointer">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">Clique para adicionar fotos</p>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {fotosBefore.map((file, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Antes ${index + 1}`}
                              className="w-full h-20 object-cover rounded"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={() => removePhoto(index, 'before')}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fotos Depois</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'after')}
                          className="hidden"
                          id="photos-after"
                        />
                        <label htmlFor="photos-after" className="cursor-pointer">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">Clique para adicionar fotos</p>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {fotosAfter.map((file, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Depois ${index + 1}`}
                              className="w-full h-20 object-cover rounded"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={() => removePhoto(index, 'after')}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Assinaturas */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assinatura do Técnico</label>
                      <div className="border rounded">
                        <SignatureCanvas
                          ref={(ref) => { sigCanvasTecnico = ref; }}
                          canvasProps={{
                            width: 300,
                            height: 150,
                            className: 'signature-canvas'
                          }}
                          onEnd={() => saveSignature('tecnico')}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('tecnico')}>
                        Limpar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assinatura do Cliente</label>
                      <div className="border rounded">
                        <SignatureCanvas
                          ref={(ref) => { sigCanvasCliente = ref; }}
                          canvasProps={{
                            width: 300,
                            height: 150,
                            className: 'signature-canvas'
                          }}
                          onEnd={() => saveSignature('cliente')}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('cliente')}>
                        Limpar
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : editingRME ? 'Atualizar' : 'Criar RME'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar RMEs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRMEs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum RME encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Tente ajustar os filtros de busca' : 'Crie seu primeiro RME'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredRMEs.map((rme) => (
            <Card key={rme.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {rme.tickets?.titulo}
                    </CardTitle>
                    <CardDescription>
                      Ticket: {rme.tickets?.numero_ticket} | 
                      Cliente: {rme.tickets?.clientes?.empresa || rme.tickets?.clientes?.profiles?.nome}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {new Date(rme.data_execucao).toLocaleDateString('pt-BR')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Técnico:</strong> {rme.tecnicos?.profiles?.nome}</p>
                  <p><strong>Condições Encontradas:</strong> {rme.condicoes_encontradas}</p>
                  <p><strong>Serviços Executados:</strong> {rme.servicos_executados}</p>
                  {rme.pdf_url && (
                    <div className="pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={rme.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </a>
                      </Button>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Criado em {new Date(rme.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RME;