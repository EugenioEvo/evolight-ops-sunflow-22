import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, Download, Search, ArrowLeft, QrCode, Plus, Trash2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Progress } from '@/components/ui/progress';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { EquipmentQuickAdd } from '@/components/EquipmentQuickAdd';

const rmeSchema = z.object({
  condicoes_encontradas: z.string().min(1, 'Campo obrigatório'),
  servicos_executados: z.string().min(1, 'Campo obrigatório'),
  testes_realizados: z.string().optional(),
  observacoes_tecnicas: z.string().optional(),
  data_execucao: z.string().min(1, 'Data de execução obrigatória'),
  nome_cliente_assinatura: z.string().min(1, 'Nome do cliente obrigatório'),
  tensao_entrada: z.string().optional(),
  tensao_saida: z.string().optional(),
  corrente: z.string().optional(),
  potencia: z.string().optional(),
  frequencia: z.string().optional(),
});

type RMEForm = z.infer<typeof rmeSchema>;

const RME = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const osIdFromUrl = searchParams.get('os');

  const [rmes, setRmes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fotosBefore, setFotosBefore] = useState<File[]>([]);
  const [fotosAfter, setFotosAfter] = useState<File[]>([]);
  const [tecnicoSignature, setTecnicoSignature] = useState<string>('');
  const [clienteSignature, setClienteSignature] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [scannedEquipment, setScannedEquipment] = useState<any>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [materiais, setMateriais] = useState<Array<{ insumo_id: string; nome: string; quantidade: number }>>([]);

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
      tensao_entrada: '',
      tensao_saida: '',
      corrente: '',
      potencia: '',
      frequencia: '',
    },
  });

  useEffect(() => {
    if (profile?.role === 'tecnico_campo') {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (osIdFromUrl && !selectedOS) {
      loadOSFromUrl(osIdFromUrl);
    }
  }, [osIdFromUrl]);

  const loadOSFromUrl = async (osId: string) => {
    try {
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            *,
            clientes!inner(empresa)
          )
        `)
        .eq('id', osId)
        .single();

      if (osData) {
        setSelectedOS(osData);
      }
    } catch (error) {
      console.error('Erro ao carregar OS:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar RMEs existentes
      const { data: rmeData } = await supabase
        .from('rme_relatorios')
        .select(`
          *,
          status_aprovacao,
          aprovado_por,
          data_aprovacao,
          observacoes_aprovacao,
          tickets!inner(
            titulo,
            numero_ticket,
            clientes!inner(
              empresa
            )
          ),
          tecnicos!inner(
            profiles!inner(nome)
          ),
          aprovador:aprovado_por(nome)
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

      if (!tecnicoSignature || !clienteSignature) {
        throw new Error('As assinaturas do técnico e do cliente são obrigatórias');
      }

      // Upload das fotos
      const fotosAntesUrls = fotosBefore.length > 0 ? await uploadPhotos(fotosBefore, 'antes') : [];
      const fotosDepoisUrls = fotosAfter.length > 0 ? await uploadPhotos(fotosAfter, 'depois') : [];

      // Buscar ID do técnico
      const { data: tecnicoData } = await supabase
        .from('tecnicos')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      // Preparar medições elétricas
      const medicoesEletricas = {
        tensao_entrada: data.tensao_entrada,
        tensao_saida: data.tensao_saida,
        corrente: data.corrente,
        potencia: data.potencia,
        frequencia: data.frequencia,
      };

      // Preparar materiais utilizados
      const materiaisUtilizados = materiais.map(m => ({
        insumo_id: m.insumo_id,
        nome: m.nome,
        quantidade: m.quantidade,
      }));

      const rmeData = {
        condicoes_encontradas: data.condicoes_encontradas,
        servicos_executados: data.servicos_executados,
        testes_realizados: data.testes_realizados,
        observacoes_tecnicas: data.observacoes_tecnicas,
        nome_cliente_assinatura: data.nome_cliente_assinatura,
        ticket_id: selectedOS.ticket_id,
        ordem_servico_id: selectedOS.id,
        tecnico_id: tecnicoData?.id,
        equipamento_id: scannedEquipment?.id || null,
        fotos_antes: fotosAntesUrls,
        fotos_depois: fotosDepoisUrls,
        assinatura_tecnico: tecnicoSignature,
        assinatura_cliente: clienteSignature,
        data_execucao: new Date(data.data_execucao).toISOString(),
        medicoes_eletricas: medicoesEletricas,
        materiais_utilizados: materiaisUtilizados,
      };

      const { error } = await supabase
        .from('rme_relatorios')
        .insert([rmeData as any]);

      if (error) throw error;

      // Atualizar status do ticket
      await supabase
        .from('tickets')
        .update({ 
          status: 'concluido',
          data_conclusao: new Date().toISOString()
        })
        .eq('id', selectedOS.ticket_id);

      toast({
        title: 'Sucesso',
        description: 'RME criado com sucesso! Ticket marcado como concluído.',
      });

      // Resetar formulário
      setSelectedOS(null);
      setFotosBefore([]);
      setFotosAfter([]);
      setTecnicoSignature('');
      setClienteSignature('');
      setScannedEquipment(null);
      setMateriais([]);
      form.reset();
      
      // Voltar para Minhas OS
      navigate('/minhas-os');
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_FILES = 10;
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    const currentCount = type === 'before' ? fotosBefore.length : fotosAfter.length;
    
    // Validar quantidade
    if (currentCount + files.length > MAX_FILES) {
      toast({
        title: "Limite excedido",
        description: `Máximo de ${MAX_FILES} fotos por tipo.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validar arquivos
    const invalidFiles = files.filter(f => 
      !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE
    );
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Arquivos inválidos",
        description: "Use apenas JPG/PNG/WEBP até 5MB.",
        variant: "destructive",
      });
      return;
    }
    
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
    const canvas = type === 'tecnico' ? sigCanvasTecnico : sigCanvasCliente;
    
    if (!canvas || canvas.isEmpty()) {
      toast({
        title: "Assinatura vazia",
        description: "Por favor, assine antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    
    if (type === 'tecnico') {
      setTecnicoSignature(canvas.toDataURL());
      toast({
        title: "Assinatura salva!",
        description: "Assinatura do técnico registrada.",
      });
    } else {
      setClienteSignature(canvas.toDataURL());
      toast({
        title: "Assinatura salva!",
        description: "Assinatura do cliente registrada.",
      });
    }
  };

  const handleQRCodeScan = async (decodedText: string) => {
    try {
      setShowScanner(false);
      
      // Tentar parsear como JSON
      let qrData;
      try {
        qrData = JSON.parse(decodedText);
      } catch {
        // Se não for JSON, assumir que é um número de série
        qrData = { numero_serie: decodedText };
      }

      // Buscar equipamento no banco
      let query = supabase.from('equipamentos').select('*');
      
      if (qrData.id) {
        query = query.eq('id', qrData.id);
      } else if (qrData.numero_serie) {
        query = query.eq('numero_serie', qrData.numero_serie);
      }

      const { data: equipment, error } = await query.maybeSingle();

      if (error) throw error;

      if (equipment) {
        setScannedEquipment(equipment);
        toast({
          title: 'Equipamento encontrado!',
          description: `${equipment.nome} - ${equipment.modelo || 'N/A'}`,
        });
      } else {
        // Equipamento não encontrado, oferecer cadastro rápido
        toast({
          title: 'Equipamento não encontrado',
          description: 'Deseja cadastrar este equipamento?',
        });
        setShowQuickAdd(true);
      }
    } catch (error: any) {
      console.error('Erro ao processar QR Code:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar QR Code',
        variant: 'destructive',
      });
    }
  };

  const addMaterial = () => {
    setMateriais([...materiais, { insumo_id: '', nome: '', quantidade: 1 }]);
  };

  const removeMaterial = (index: number) => {
    setMateriais(materiais.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materiais];
    updated[index] = { ...updated[index], [field]: value };
    setMateriais(updated);
  };

  const filteredRMEs = rmes.filter(rme => 
    rme.tickets?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.numero_ticket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular progresso do formulário
  const calculateProgress = () => {
    const values = form.watch();
    const requiredFilled = [
      values.condicoes_encontradas,
      values.servicos_executados,
      values.data_execucao,
      values.nome_cliente_assinatura,
      tecnicoSignature,
      clienteSignature,
    ].filter(Boolean).length;
    
    const optionalFilled = [
      fotosBefore.length > 0 || fotosAfter.length > 0,
      scannedEquipment !== null,
      values.tensao_entrada || values.tensao_saida || values.corrente,
      materiais.length > 0,
    ].filter(Boolean).length;

    // 6 campos obrigatórios = 60%, 4 opcionais = 40%
    return (requiredFilled / 6) * 60 + (optionalFilled / 4) * 40;
  };

  const canAccessRME = profile?.role === 'tecnico_campo' || 
                       profile?.role === 'admin' || 
                       profile?.role === 'area_tecnica';
  
  if (!canAccessRME) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Acesso negado. Esta página é para técnicos de campo, administradores e área técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se há OS selecionada, mostrar formulário
  if (selectedOS) {
    const progress = calculateProgress();

    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedOS(null);
              navigate('/rme');
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Preencher RME</h1>
            <p className="text-sm text-muted-foreground">
              OS: {selectedOS.numero_os} - {selectedOS.tickets?.titulo}
            </p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso do formulário</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_execucao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Execução *</FormLabel>
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
                        <FormLabel>Nome do Cliente *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo do cliente" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Seção de Equipamento com QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Equipamento</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScanner(true)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Escanear QR Code
                  </Button>
                </CardTitle>
                <CardDescription>
                  Escaneie o QR Code do equipamento ou cadastre manualmente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scannedEquipment ? (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{scannedEquipment.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {scannedEquipment.tipo} - {scannedEquipment.modelo || 'N/A'}
                        </p>
                        {scannedEquipment.numero_serie && (
                          <p className="text-xs text-muted-foreground">
                            S/N: {scannedEquipment.numero_serie}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setScannedEquipment(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum equipamento selecionado
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Medições Elétricas */}
            <Card>
              <CardHeader>
                <CardTitle>Medições Elétricas</CardTitle>
                <CardDescription>Registre as medições realizadas durante o serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tensao_entrada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão Entrada (V)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 220" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tensao_saida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão Saída (V)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 220" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corrente (A)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 10.5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potência (W)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 2000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência (Hz)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 60" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Materiais Utilizados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Materiais Utilizados</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMaterial}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Material
                  </Button>
                </CardTitle>
                <CardDescription>
                  Liste os insumos e materiais utilizados no serviço
                </CardDescription>
              </CardHeader>
              <CardContent>
                {materiais.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum material adicionado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {materiais.map((material, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-sm font-medium">Material/Insumo</label>
                          <Input
                            placeholder="Nome do material"
                            value={material.nome}
                            onChange={(e) => updateMaterial(index, 'nome', e.target.value)}
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-sm font-medium">Quantidade</label>
                          <Input
                            type="number"
                            min="1"
                            value={material.quantidade}
                            onChange={(e) => updateMaterial(index, 'quantidade', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeMaterial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Condições e Serviços</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="condicoes_encontradas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condições Encontradas *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva as condições encontradas no local..." rows={4} />
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
                      <FormLabel>Serviços Executados *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva os serviços realizados..." rows={4} />
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
                        <Textarea {...field} placeholder="Descreva os testes realizados..." rows={3} />
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
                        <Textarea {...field} placeholder="Observações adicionais..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Fotos */}
            <Card>
              <CardHeader>
                <CardTitle>Fotos</CardTitle>
                <CardDescription>Adicione fotos do antes e depois do serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Fotos Antes</label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'before')}
                        className="hidden"
                        id="photos-before"
                      />
                      <label htmlFor="photos-before" className="cursor-pointer">
                        <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique ou arraste fotos aqui</p>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fotosBefore.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Antes ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(index, 'before')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Fotos Depois</label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'after')}
                        className="hidden"
                        id="photos-after"
                      />
                      <label htmlFor="photos-after" className="cursor-pointer">
                        <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique ou arraste fotos aqui</p>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fotosAfter.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Depois ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(index, 'after')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assinaturas */}
            <Card>
              <CardHeader>
                <CardTitle>Assinaturas *</CardTitle>
                <CardDescription>Assinaturas digitais do técnico e do cliente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Assinatura do Técnico</label>
                    <div className="border-2 rounded-lg overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={(ref) => { sigCanvasTecnico = ref; }}
                        canvasProps={{
                          width: 400,
                          height: 200,
                          className: 'signature-canvas w-full'
                        }}
                        onEnd={() => saveSignature('tecnico')}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('tecnico')} className="w-full">
                      Limpar Assinatura
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Assinatura do Cliente</label>
                    <div className="border-2 rounded-lg overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={(ref) => { sigCanvasCliente = ref; }}
                        canvasProps={{
                          width: 400,
                          height: 200,
                          className: 'signature-canvas w-full'
                        }}
                        onEnd={() => saveSignature('cliente')}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('cliente')} className="w-full">
                      Limpar Assinatura
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading || progress < 100}>
                {loading ? 'Salvando...' : 'Concluir e Enviar RME'}
              </Button>
            </div>
          </form>
        </Form>

        {/* Modal do Scanner QR Code */}
        {showScanner && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <QRCodeScanner
              onScanSuccess={handleQRCodeScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        )}

        {/* Modal de Cadastro Rápido */}
        <EquipmentQuickAdd
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          onSuccess={(equipmentId) => {
            supabase
              .from('equipamentos')
              .select('*')
              .eq('id', equipmentId)
              .single()
              .then(({ data }) => {
                if (data) setScannedEquipment(data);
              });
            setShowQuickAdd(false);
          }}
          clienteId={selectedOS?.tickets?.cliente_id || ''}
        />
      </div>
    );
  }

  // Lista de RMEs
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RME - Relatórios de Manutenção</h1>
          <p className="text-muted-foreground">Histórico de relatórios enviados</p>
        </div>
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
                  {searchTerm ? 'Tente ajustar os filtros de busca' : 'Seus RMEs aparecerão aqui'}
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
                      Cliente: {rme.tickets?.clientes?.empresa}
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
