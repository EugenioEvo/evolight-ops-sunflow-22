import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRMEData, useRMEActions, rmeService, rmeSchema } from '@/features/rme';
import type { RMEForm } from '@/features/rme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, Download, Search, ArrowLeft, Plus, Trash2, CheckCircle2, Circle, AlertCircle, Printer, Loader2, Mail } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Progress } from '@/components/ui/progress';
import { EquipmentQuickAdd } from '@/components/EquipmentQuickAdd';
import { TechnicianBreadcrumb } from '@/components/TechnicianBreadcrumb';
import { LoadingState } from '@/components/LoadingState';
import { Alert, AlertDescription } from '@/components/ui/alert';

const RME = () => {
  const {
    filteredRMEs, selectedOS, setSelectedOS, loading, setLoading,
    searchTerm, setSearchTerm, user, profile, authLoading,
    canAccessRME, osLoading, navigate, loadOSFromUrl,
  } = useRMEData();

  const {
    fotosBefore, fotosAfter, tecnicoSignature, setTecnicoSignature,
    clienteSignature, setClienteSignature, scannedEquipment, setScannedEquipment,
    showQuickAdd, setShowQuickAdd, materiais, exportingRMEId, sendingEmailId,
    handlePhotoUpload, removePhoto, addMaterial, removeMaterial, updateMaterial,
    handleExportRMEPDF, handleSendRMEEmail, resetForm,
  } = useRMEActions();

  let sigCanvasTecnico: SignatureCanvas | null = null;
  let sigCanvasCliente: SignatureCanvas | null = null;

  const form = useForm<RMEForm>({
    resolver: zodResolver(rmeSchema),
    defaultValues: {
      condicoes_encontradas: '', servicos_executados: '', testes_realizados: '',
      observacoes_tecnicas: '', data_execucao: new Date().toISOString().split('T')[0],
      nome_cliente_assinatura: '', tensao_entrada: '', tensao_saida: '',
      corrente: '', potencia: '', frequencia: '',
    },
  });

  const clearSignature = (type: 'tecnico' | 'cliente') => {
    if (type === 'tecnico' && sigCanvasTecnico) { sigCanvasTecnico.clear(); setTecnicoSignature(''); }
    else if (type === 'cliente' && sigCanvasCliente) { sigCanvasCliente.clear(); setClienteSignature(''); }
  };

  const saveSignature = (type: 'tecnico' | 'cliente') => {
    const canvas = type === 'tecnico' ? sigCanvasTecnico : sigCanvasCliente;
    if (!canvas || canvas.isEmpty()) return;
    if (type === 'tecnico') setTecnicoSignature(canvas.toDataURL());
    else setClienteSignature(canvas.toDataURL());
  };

  const onSubmit = async (data: RMEForm) => {
    try {
      setLoading(true);
      if (!selectedOS) throw new Error('Selecione uma ordem de serviço');
      if (selectedOS.tickets?.status !== 'em_execucao') return;
      if (!tecnicoSignature || !clienteSignature) throw new Error('As assinaturas são obrigatórias');

      const fotosAntesUrls = fotosBefore.length > 0 ? await rmeService.uploadPhotos(fotosBefore, 'antes', user!.id) : [];
      const fotosDepoisUrls = fotosAfter.length > 0 ? await rmeService.uploadPhotos(fotosAfter, 'depois', user!.id) : [];
      const tecnicoId = await rmeService.getTecnicoId(profile!.id);

      await rmeService.createRME({
        condicoes_encontradas: data.condicoes_encontradas,
        servicos_executados: data.servicos_executados,
        testes_realizados: data.testes_realizados,
        observacoes_tecnicas: data.observacoes_tecnicas,
        nome_cliente_assinatura: data.nome_cliente_assinatura,
        ticket_id: selectedOS.ticket_id,
        ordem_servico_id: selectedOS.id,
        tecnico_id: tecnicoId,
        equipamento_id: scannedEquipment?.id || null,
        fotos_antes: fotosAntesUrls, fotos_depois: fotosDepoisUrls,
        assinatura_tecnico: tecnicoSignature, assinatura_cliente: clienteSignature,
        data_execucao: new Date(data.data_execucao).toISOString(),
        medicoes_eletricas: { tensao_entrada: data.tensao_entrada, tensao_saida: data.tensao_saida, corrente: data.corrente, potencia: data.potencia, frequencia: data.frequencia },
        materiais_utilizados: materiais.map(m => ({ insumo_id: m.insumo_id, nome: m.nome, quantidade: m.quantidade })),
      });

      await rmeService.markTicketConcluido(selectedOS.ticket_id);
      setSelectedOS(null);
      resetForm();
      form.reset();
      navigate('/minhas-os');
    } catch (error: any) {
      console.error('Erro ao salvar RME:', error);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    const v = form.watch();
    return !!(v.condicoes_encontradas && v.servicos_executados && v.data_execucao && v.nome_cliente_assinatura && tecnicoSignature && clienteSignature);
  };

  const calculateProgress = () => {
    const v = form.watch();
    const req = [v.condicoes_encontradas, v.servicos_executados, v.data_execucao, v.nome_cliente_assinatura, tecnicoSignature, clienteSignature].filter(Boolean).length;
    const opt = [fotosBefore.length > 0 || fotosAfter.length > 0, scannedEquipment !== null, v.tensao_entrada || v.tensao_saida || v.corrente, materiais.length > 0].filter(Boolean).length;
    return (req / 6) * 60 + (opt / 4) * 40;
  };

  if (authLoading || osLoading) return <div className="p-6"><LoadingState /></div>;

  if (!canAccessRME && !selectedOS) {
    return (
      <div className="p-6"><Card><CardContent className="pt-6"><p className="text-muted-foreground">Acesso negado. Esta página é para técnicos de campo, administradores e área técnica.</p></CardContent></Card></div>
    );
  }

  if (selectedOS) {
    const progress = calculateProgress();
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <TechnicianBreadcrumb current="rme" osNumber={selectedOS.numero_os} />
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedOS(null); navigate('/rme'); }}>
            <ArrowLeft className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Preencher RME</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">OS: {selectedOS.numero_os} - {selectedOS.tickets?.titulo}</p>
          </div>
        </div>

        {selectedOS?.tickets?.status !== 'em_execucao' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div><strong>Atenção:</strong> O status do ticket não está como "Em Execução".</div>
              <Button variant="outline" size="sm" onClick={() => loadOSFromUrl(selectedOS.id)}>Atualizar</Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardContent className="pt-6"><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{Math.round(progress)}%</span></div><Progress value={progress} className="h-2" /></div></CardContent></Card>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card><CardHeader><CardTitle>Informações Básicas</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="data_execucao" render={({ field }) => (<FormItem><FormLabel>Data de Execução *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="nome_cliente_assinatura" render={({ field }) => (<FormItem><FormLabel>Nome do Cliente *</FormLabel><FormControl><Input {...field} placeholder="Nome completo do cliente" /></FormControl><FormMessage /></FormItem>)} />
                </div></CardContent></Card>

                <Card><CardHeader><CardTitle>Equipamento</CardTitle><CardDescription>Equipamento vinculado (opcional)</CardDescription></CardHeader><CardContent>
                  {scannedEquipment ? (
                    <div className="p-4 bg-muted rounded-lg space-y-2"><div className="flex items-center justify-between"><div><p className="font-medium">{scannedEquipment.nome}</p><p className="text-sm text-muted-foreground">{scannedEquipment.tipo} - {scannedEquipment.modelo || 'N/A'}</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setScannedEquipment(null)}><X className="h-4 w-4" /></Button></div></div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum equipamento vinculado</p>}
                </CardContent></Card>

                <Card><CardHeader><CardTitle>Medições Elétricas</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(['tensao_entrada', 'tensao_saida', 'corrente', 'potencia', 'frequencia'] as const).map(name => {
                    const labels: Record<string, string> = { tensao_entrada: 'Tensão Entrada (V)', tensao_saida: 'Tensão Saída (V)', corrente: 'Corrente (A)', potencia: 'Potência (W)', frequencia: 'Frequência (Hz)' };
                    return <FormField key={name} control={form.control} name={name} render={({ field }) => (<FormItem><FormLabel>{labels[name]}</FormLabel><FormControl><Input {...field} type="number" step="0.01" /></FormControl><FormMessage /></FormItem>)} />;
                  })}
                </div></CardContent></Card>

                <Card><CardHeader><CardTitle className="flex items-center justify-between"><span>Materiais Utilizados</span><Button type="button" variant="outline" size="sm" onClick={addMaterial}><Plus className="h-4 w-4 mr-2" />Adicionar</Button></CardTitle></CardHeader><CardContent>
                  {materiais.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum material adicionado</p> : (
                    <div className="space-y-3">{materiais.map((material, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1"><label className="text-sm font-medium">Material</label><Input placeholder="Nome" value={material.nome} onChange={e => updateMaterial(index, 'nome', e.target.value)} /></div>
                        <div className="w-24"><label className="text-sm font-medium">Qtd</label><Input type="number" min="1" value={material.quantidade} onChange={e => updateMaterial(index, 'quantidade', parseInt(e.target.value) || 1)} /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}</div>
                  )}
                </CardContent></Card>

                <Card><CardHeader><CardTitle>Descrição do Serviço</CardTitle></CardHeader><CardContent className="space-y-4">
                  <FormField control={form.control} name="condicoes_encontradas" render={({ field }) => (<FormItem><FormLabel>Condições Encontradas *</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="servicos_executados" render={({ field }) => (<FormItem><FormLabel>Serviços Executados *</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="testes_realizados" render={({ field }) => (<FormItem><FormLabel>Testes Realizados</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="observacoes_tecnicas" render={({ field }) => (<FormItem><FormLabel>Observações Técnicas</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent></Card>

                <Card><CardHeader><CardTitle>Fotos</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(['before', 'after'] as const).map(type => {
                    const photos = type === 'before' ? fotosBefore : fotosAfter;
                    const label = type === 'before' ? 'Fotos Antes' : 'Fotos Depois';
                    return (
                      <div key={type} className="space-y-3">
                        <label className="text-sm font-medium">{label}</label>
                        <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors">
                          <input type="file" multiple accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e, type)} className="hidden" id={`photos-${type}`} />
                          <label htmlFor={`photos-${type}`} className="cursor-pointer"><Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Clique ou arraste</p></label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">{photos.map((file, i) => (
                          <div key={i} className="relative group">
                            <img src={URL.createObjectURL(file)} alt={`${label} ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(i, type)}><X className="h-4 w-4" /></Button>
                          </div>
                        ))}</div>
                      </div>
                    );
                  })}
                </div></CardContent></Card>

                <Card><CardHeader><CardTitle>Assinaturas *</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(['tecnico', 'cliente'] as const).map(type => (
                    <div key={type} className="space-y-3">
                      <label className="text-sm font-medium">Assinatura do {type === 'tecnico' ? 'Técnico' : 'Cliente'}</label>
                      <div className="border-2 rounded-lg overflow-hidden bg-white">
                        <SignatureCanvas ref={ref => { if (type === 'tecnico') sigCanvasTecnico = ref; else sigCanvasCliente = ref; }} canvasProps={{ width: 400, height: 200, className: 'signature-canvas w-full' }} onEnd={() => saveSignature(type)} />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => clearSignature(type)} className="w-full">Limpar</Button>
                    </div>
                  ))}
                </div></CardContent></Card>

                <Button type="submit" disabled={loading || !canSubmit() || selectedOS?.tickets?.status !== 'em_execucao'} className="w-full sm:w-auto">
                  {loading ? 'Salvando...' : 'Concluir e Enviar RME'}
                </Button>
              </form>
            </Form>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Checklist</CardTitle></CardHeader><CardContent><div className="space-y-3 text-xs">
              {[
                { check: form.watch('data_execucao'), label: 'Data de execução' },
                { check: form.watch('nome_cliente_assinatura'), label: 'Nome do cliente' },
                { check: form.watch('condicoes_encontradas'), label: 'Condições encontradas' },
                { check: form.watch('servicos_executados'), label: 'Serviços executados' },
                { check: tecnicoSignature, label: 'Assinatura do técnico' },
                { check: clienteSignature, label: 'Assinatura do cliente' },
              ].map(({ check, label }) => (
                <div key={label} className="flex items-start gap-2">
                  {check ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                  <span className={check ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                </div>
              ))}
              <div className="pt-3 border-t"><p className="text-xs font-medium text-muted-foreground mb-2">Opcionais</p>
                {[
                  { check: fotosBefore.length > 0, label: `Fotos antes (${fotosBefore.length})` },
                  { check: fotosAfter.length > 0, label: `Fotos depois (${fotosAfter.length})` },
                  { check: !!scannedEquipment, label: 'Equipamento' },
                  { check: materiais.length > 0, label: 'Materiais utilizados' },
                ].map(({ check, label }) => (
                  <div key={label} className="flex items-start gap-2">
                    {check ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                    <span className={check ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                  </div>
                ))}
              </div>
            </div></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  // Lista de RMEs
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">RME - Relatórios de Manutenção</h1><p className="text-muted-foreground">Histórico de relatórios enviados</p></div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar RMEs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
        </div>
      </div>
      <div className="grid gap-4">
        {filteredRMEs.length === 0 ? (
          <Card><CardContent className="flex items-center justify-center py-12"><div className="text-center"><FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-medium">Nenhum RME encontrado</h3><p className="text-muted-foreground">{searchTerm ? 'Tente ajustar os filtros' : 'Seus RMEs aparecerão aqui'}</p></div></CardContent></Card>
        ) : filteredRMEs.map(rme => (
          <Card key={rme.id} className="hover:shadow-md transition-shadow">
            <CardHeader><div className="flex items-start justify-between"><div className="space-y-1"><CardTitle className="text-lg">{rme.tickets?.titulo}</CardTitle><CardDescription>Ticket: {rme.tickets?.numero_ticket}</CardDescription></div><Badge variant="outline">{new Date(rme.data_execucao).toLocaleDateString('pt-BR')}</Badge></div></CardHeader>
            <CardContent><div className="space-y-2">
              <p><strong>Técnico:</strong> {rme.tecnicos?.profiles?.nome}</p>
              <p><strong>Condições:</strong> {rme.condicoes_encontradas}</p>
              <p><strong>Serviços:</strong> {rme.servicos_executados}</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleExportRMEPDF(rme)} disabled={exportingRMEId === rme.id} className="gap-2">
                  {exportingRMEId === rme.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Exportar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSendRMEEmail(rme)} disabled={sendingEmailId === rme.id} className="gap-2">
                  {sendingEmailId === rme.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email
                </Button>
                {rme.pdf_url && <Button variant="outline" size="sm" asChild><a href={rme.pdf_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 mr-2" />PDF</a></Button>}
              </div>
              <div className="flex justify-between items-center pt-2 border-t"><span className="text-xs text-muted-foreground">Criado em {new Date(rme.created_at).toLocaleString('pt-BR')}</span></div>
            </div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RME;
