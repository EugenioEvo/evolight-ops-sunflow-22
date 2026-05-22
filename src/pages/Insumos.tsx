import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { Plus, Package, Wrench, Trash2, Edit, ArrowDownIcon, RotateCcw, ShoppingCart, Eye, Camera, Image as ImageIcon, X, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplyData, useSupplyActions, getEstoqueStatus, UNIDADES_OPTIONS, LOCALIZACAO_OPTIONS, supplyService, compraSchema, type CompraForm, type Insumo, type InsumoMidia } from "@/features/supplies";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { obrasService } from "@/features/obras";
import type { Obra } from "@/features/obras";

const getCategoriaIcon = (categoria: string) =>
  ["inversores", "equipamentos_medicao", "ferramentas"].includes(categoria)
    ? <Wrench className="h-4 w-4" />
    : <Package className="h-4 w-4" />;

export default function Insumos() {
  const { profile, user } = useAuth();
  const { handleError } = useErrorHandler();
  const [searchParams] = useSearchParams();
  const osIdParam = searchParams.get("os");
  const {
    insumos, kits, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredInsumos, categoriaCounts, reload,
  } = useSupplyData();

  // Registrar Compra
  const [compraInsumo, setCompraInsumo] = useState<Insumo | null>(null);
  const compraForm = useForm<CompraForm>({
    resolver: zodResolver(compraSchema),
    defaultValues: { insumo_id: "", quantidade: 1, valor_unitario: 0, fornecedor: "", observacoes: "" },
  });
  const abrirCompra = (ins: Insumo) => {
    setCompraInsumo(ins);
    compraForm.reset({ insumo_id: ins.id, quantidade: 1, valor_unitario: Number(ins.preco || 0), fornecedor: ins.fornecedor || "", observacoes: "" });
  };
  const onSubmitCompra = async (data: CompraForm) => {
    if (!user?.id) { toast.error("Sessão inválida."); return; }
    try {
      await supplyService.createCompra({ ...data, registrado_por: user.id });
      toast.success("Compra registrada — estoque e preço médio atualizados.");
      setCompraInsumo(null);
      reload();
    } catch (e) {
      handleError(e, { fallbackMessage: "Erro ao registrar compra." });
    }
  };

  // Visualização de detalhes (fotos/vídeos)
  const [detailInsumo, setDetailInsumo] = useState<Insumo | null>(null);

  // Upload de mídias do insumo (no modal de criação/edição)
  const [uploadingMidias, setUploadingMidias] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isVideo = (m: { type?: string; name?: string; url?: string }) =>
    m.type === "video" || /\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)$/i.test(m.name || m.url || "");


  const {
    insumoForm, saidaForm,
    isInsumoDialogOpen, setIsInsumoDialogOpen,
    isSaidaDialogOpen, setIsSaidaDialogOpen,
    editingInsumo, setEditingInsumo, selectedInsumo,
    onSubmitInsumo, onSubmitSaida,
    handleEditInsumo, handleDeleteInsumo, handleSaida,
    isTecnico,
  } = useSupplyActions(reload);

  // Permissão para gerenciar cadastro/compra (apenas admin e backoffice)
  const userRoles = profile?.roles || [];
  const canManageInventory = userRoles.includes("admin") || userRoles.includes("backoffice");

  // Para fluxo de saída: lista de técnicos + OS ativas + Obras ativas
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nome: string }>>([]);
  const [osAtivas, setOsAtivas] = useState<Array<{ ordem_servico_id: string; numero_os: string; ticket_titulo: string }>>([]);
  const [obrasAtivas, setObrasAtivas] = useState<Obra[]>([]);
  const [meuTecnicoId, setMeuTecnicoId] = useState<string>("");

  const watchedTecnicoId = saidaForm.watch("tecnico_id");
  const watchedTipo = saidaForm.watch("tipo");
  const watchedObraId = saidaForm.watch("obra_id");
  const watchedOsIds = saidaForm.watch("ordens_servico_ids");
  const watchedUsoInterno = saidaForm.watch("uso_interno");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tecnicos")
        .select("id, profile:profiles(nome)")
        .order("id");
      setTecnicos((data as any || []).map((t: any) => ({ id: t.id, nome: t.profile?.nome || "—" })));
      if (isTecnico && profile?.id) {
        const { data: meu } = await supabase
          .from("tecnicos")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();
        if (meu?.id) {
          setMeuTecnicoId(meu.id);
          saidaForm.setValue("tecnico_id", meu.id);
        }
      }
    })();
  }, [isTecnico, profile?.id]);

  useEffect(() => {
    (async () => {
      if (!watchedTecnicoId) { setOsAtivas([]); return; }
      const { data } = await (supabase as any).rpc("get_tecnico_os_ativas", { p_tecnico_id: watchedTecnicoId });
      setOsAtivas(data || []);
    })();
  }, [watchedTecnicoId]);

  // Carrega Obras em atividade (planejada / em_execucao) para o seletor de saída
  useEffect(() => {
    (async () => {
      try {
        const all = await obrasService.fetchAll();
        setObrasAtivas(all.filter((o) => o.status === "planejada" || o.status === "em_execucao"));
      } catch { /* silencioso */ }
    })();
  }, []);

  // Auto-abrir dialog de saída quando navega de Minhas OS via ?os=<id>
  useEffect(() => {
    if (!osIdParam) return;
    saidaForm.reset({
      tipo: "insumo", insumo_id: undefined, kit_id: undefined,
      quantidade: 1, tecnico_id: meuTecnicoId || "", ordens_servico_ids: [osIdParam],
      obra_id: null, evidencias: [], observacoes: "",
    });
    setIsSaidaDialogOpen(true);
  }, [osIdParam, meuTecnicoId]);

  if (loading) {
    return <div className="container mx-auto py-8"><div className="flex items-center justify-center h-64"><div className="text-lg">Carregando...</div></div></div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Insumos</h1>
        {!isTecnico && (
          <Dialog open={isInsumoDialogOpen} onOpenChange={setIsInsumoDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingInsumo(null); insumoForm.reset({ nome: "", categoria: "", unidade: "un", quantidade: 0, estoque_minimo: 10, estoque_critico: 5, localizacao: "Estoque", fornecedor: "", observacoes: "", retornavel: false, midias: [] }); }}><Plus className="h-4 w-4 mr-2" />Novo Insumo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editingInsumo ? "Editar Insumo" : "Novo Insumo"}</DialogTitle></DialogHeader>
              <Form {...insumoForm}>
                <form onSubmit={insumoForm.handleSubmit(onSubmitInsumo)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={insumoForm.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="categoria" render={({ field }) => (<FormItem><FormLabel>Categoria</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="paineis_solares">Painéis Solares</SelectItem><SelectItem value="inversores">Inversores</SelectItem><SelectItem value="estruturas_montagem">Estruturas</SelectItem><SelectItem value="cabos_conectores">Cabos</SelectItem><SelectItem value="equipamentos_medicao">Medição</SelectItem><SelectItem value="ferramentas">Ferramentas</SelectItem><SelectItem value="componentes_eletricos">Componentes</SelectItem><SelectItem value="manutencao">Manutenção</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={insumoForm.control} name="unidade" render={({ field }) => (
                      <FormItem><FormLabel>Unidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {UNIDADES_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={insumoForm.control} name="preco" render={({ field }) => (<FormItem><FormLabel>Preço</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="localizacao" render={({ field }) => (
                      <FormItem><FormLabel>Localização</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "Estoque"}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {LOCALIZACAO_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={insumoForm.control} name="quantidade" render={({ field }) => (<FormItem><FormLabel>Estoque Atual</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="estoque_minimo" render={({ field }) => (<FormItem><FormLabel>Estoque Mínimo</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="estoque_critico" render={({ field }) => (<FormItem><FormLabel>Estoque Crítico</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={insumoForm.control} name="fornecedor" render={({ field }) => (<FormItem><FormLabel>Fornecedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="retornavel" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Retornável</FormLabel>
                          <p className="text-xs text-muted-foreground">Item que sai do estoque e deve voltar (ex: alicate, luvas).</p>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={insumoForm.control} name="midias" render={({ field }) => {
                    const midias: InsumoMidia[] = field.value || [];
                    const onPick = async (files: FileList | null) => {
                      if (!files || files.length === 0) return;
                      const list = Array.from(files);
                      const tooBig = list.find(f => (f.type.startsWith("video/") ? f.size > 50 * 1024 * 1024 : f.size > 5 * 1024 * 1024));
                      if (tooBig) { toast.error("Foto até 5MB e vídeo até 50MB."); return; }
                      try {
                        setUploadingMidias(true);
                        const uploaded = await supplyService.uploadInsumoMidias(editingInsumo?.id || "novos", list);
                        field.onChange([...midias, ...uploaded]);
                        toast.success(`${uploaded.length} mídia(s) anexada(s).`);
                      } catch (e) {
                        handleError(e, { fallbackMessage: "Erro ao enviar mídia." });
                      } finally {
                        setUploadingMidias(false);
                      }
                    };
                    const remove = async (m: InsumoMidia) => {
                      try { await supplyService.removeInsumoMidia(m.path); } catch {/* ignore */}
                      field.onChange(midias.filter(x => x.path !== m.path));
                    };
                    return (
                      <FormItem>
                        <FormLabel>Fotos e vídeos do item</FormLabel>
                        <p className="text-xs text-muted-foreground -mt-1">A primeira mídia aparece no card do insumo. Foto até 5MB, vídeo até 50MB.</p>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={uploadingMidias}>
                            <Camera className="h-4 w-4 mr-1" />Câmera
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()} disabled={uploadingMidias}>
                            <ImageIcon className="h-4 w-4 mr-1" />Galeria
                          </Button>
                          {uploadingMidias && <span className="text-xs text-muted-foreground self-center">Enviando…</span>}
                          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
                          <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
                        </div>
                        {midias.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {midias.map((m, i) => (
                              <div key={m.path} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                                {isVideo(m) ? (
                                  <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <Film className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <img src={m.url} alt={m.name || `mídia ${i + 1}`} className="w-full h-full object-cover" />
                                )}
                                {i === 0 && <Badge className="absolute top-1 left-1 text-[10px] px-1">capa</Badge>}
                                <button type="button" onClick={() => remove(m)} className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </FormItem>
                    );
                  }} />
                  <FormField control={insumoForm.control} name="observacoes" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setIsInsumoDialogOpen(false); insumoForm.reset(); }}>Cancelar</Button>
                    <Button type="submit">{editingInsumo ? "Atualizar" : "Criar"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Saída Dialog */}
      <Dialog open={isSaidaDialogOpen} onOpenChange={setIsSaidaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Saída{selectedInsumo && ` - ${selectedInsumo.nome}`}</DialogTitle>
          </DialogHeader>
          <Form {...saidaForm}>
            <form onSubmit={saidaForm.handleSubmit(onSubmitSaida)} className="space-y-4">
              <FormField control={saidaForm.control} name="tipo" render={({ field }) => (
                <FormItem><FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="insumo">Item avulso</SelectItem>
                      <SelectItem value="kit">KIT</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {watchedTipo === "kit" && (
                <FormField control={saidaForm.control} name="kit_id" render={({ field }) => (
                  <FormItem><FormLabel>KIT</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o KIT" /></SelectTrigger></FormControl>
                      <SelectContent>{kits.map(k => <SelectItem key={k.id} value={k.id}>{k.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              )}

              <FormField control={saidaForm.control} name="quantidade" render={({ field }) => (
                <FormItem><FormLabel>Quantidade</FormLabel>
                  <FormControl><Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                  {selectedInsumo && watchedTipo === "insumo" && (
                    <p className="text-sm text-muted-foreground">Estoque atual: {selectedInsumo.quantidade} {selectedInsumo.unidade}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={saidaForm.control} name="tecnico_id" render={({ field }) => (
                <FormItem><FormLabel>Técnico responsável</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isTecnico && !!meuTecnicoId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione um técnico" /></SelectTrigger></FormControl>
                    <SelectContent>{tecnicos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={saidaForm.control} name="uso_interno" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5 pr-3">
                    <FormLabel className="text-sm font-medium">Uso Interno</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Saída não vinculada a OS (ex.: estoque do veículo, ferramentaria).
                      Ainda passa pelo fluxo de aprovação do BackOffice.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        if (v) saidaForm.setValue("ordens_servico_ids", []);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )} />

              {!saidaForm.watch("uso_interno") && (
              <FormField control={saidaForm.control} name="ordens_servico_ids" render={({ field }) => (
                <FormItem><FormLabel>Ordens de Serviço {field.value?.length ? `(${field.value.length} selecionada${field.value.length > 1 ? "s" : ""})` : ""}</FormLabel>
                  <div className="rounded-md border max-h-48 overflow-y-auto p-2 space-y-1">
                    {!watchedTecnicoId && <div className="p-2 text-sm text-muted-foreground">Escolha o técnico primeiro</div>}
                    {watchedTecnicoId && osAtivas.length === 0 && <div className="p-2 text-sm text-muted-foreground">Nenhuma OS aceita/em execução</div>}
                    {osAtivas.map(os => {
                      const checked = (field.value || []).includes(os.ordem_servico_id);
                      return (
                        <label key={os.ordem_servico_id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const curr = field.value || [];
                              field.onChange(v ? [...curr, os.ordem_servico_id] : curr.filter((id) => id !== os.ordem_servico_id));
                            }}
                          />
                          <span className="flex-1">{os.numero_os} — {os.ticket_titulo}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              )}

              <FormField control={saidaForm.control} name="observacoes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                A saída ficará <strong>pendente de validação do BackOffice</strong>. O estoque é decrementado imediatamente.
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsSaidaDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Registrar Saída</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="todos">Todos ({categoriaCounts.todos})</TabsTrigger>
            <TabsTrigger value="retornaveis"><RotateCcw className="h-3 w-3 mr-1" />Retornáveis ({categoriaCounts.retornaveis})</TabsTrigger>
            <TabsTrigger value="estoque-baixo" className="text-destructive">Estoque Baixo ({categoriaCounts["estoque-baixo"]})</TabsTrigger>
          </TabsList>
          <Input placeholder="Buscar insumos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
        </div>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInsumos.map((insumo) => {
              const estoqueStatus = getEstoqueStatus(insumo.quantidade, insumo.estoque_minimo, insumo.estoque_critico);
              const cover = (insumo.midias || []).find(m => m.type === "image") || (insumo.midias || [])[0];
              return (
                <Card key={insumo.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  {cover && (
                    <button type="button" onClick={() => setDetailInsumo(insumo)} className="block w-full aspect-video bg-muted overflow-hidden">
                      {isVideo(cover) ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={cover.url} alt={insumo.nome} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      )}
                    </button>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">{getCategoriaIcon(insumo.categoria)}<CardTitle className="text-lg">{insumo.nome}</CardTitle></div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailInsumo(insumo)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                        {!isTecnico && (
                          <Button variant="ghost" size="sm" onClick={() => handleEditInsumo(insumo)} title="Editar"><Edit className="h-4 w-4" /></Button>
                        )}
                        {!isTecnico && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir insumo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir <strong>{insumo.nome}</strong>? Esta ação não pode ser desfeita e pode afetar saídas e KITs vinculados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteInsumo(insumo.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">{insumo.categoria}</Badge>
                      {insumo.retornavel && <Badge variant="secondary"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{insumo.quantidade}</span>
                      <Badge variant={estoqueStatus === "critico" ? "destructive" : estoqueStatus === "baixo" ? "secondary" : "default"}>
                        {estoqueStatus === "critico" ? "Crítico" : estoqueStatus === "baixo" ? "Baixo" : "Normal"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Unidade: {insumo.unidade}</div>
                      {insumo.preco && <div>Preço: R$ {insumo.preco.toFixed(2)}</div>}
                      {insumo.localizacao && <div>Local: {insumo.localizacao}</div>}
                      {insumo.fornecedor && <div>Fornecedor: {insumo.fornecedor}</div>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleSaida(insumo)} disabled={insumo.quantidade === 0}>
                        <ArrowDownIcon className="h-4 w-4 mr-1" />Saída
                      </Button>
                      {!isTecnico && (
                        <Button size="sm" variant="secondary" onClick={() => abrirCompra(insumo)}>
                          <ShoppingCart className="h-4 w-4 mr-1" />Compra
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredInsumos.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insumo encontrado</h3>
              <p className="text-muted-foreground">{searchTerm ? "Tente ajustar os filtros de busca." : "Comece adicionando alguns insumos ao sistema."}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Registrar Compra */}
      <Dialog open={!!compraInsumo} onOpenChange={(o) => !o && setCompraInsumo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Compra {compraInsumo && `— ${compraInsumo.nome}`}</DialogTitle>
          </DialogHeader>
          {compraInsumo && (
            <Form {...compraForm}>
              <form onSubmit={compraForm.handleSubmit(onSubmitCompra)} className="space-y-3">
                <div className="rounded-md border p-3 text-xs text-muted-foreground bg-muted/30">
                  Estoque atual: <strong>{compraInsumo.quantidade}</strong> {compraInsumo.unidade}
                  {compraInsumo.preco != null && <> • Preço médio atual: <strong>R$ {Number(compraInsumo.preco).toFixed(2)}</strong></>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={compraForm.control} name="quantidade" render={({ field }) => (
                    <FormItem><FormLabel>Quantidade</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={compraForm.control} name="valor_unitario" render={({ field }) => (
                    <FormItem><FormLabel>Valor unitário (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min={0} {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={compraForm.control} name="fornecedor" render={({ field }) => (
                  <FormItem><FormLabel>Fornecedor</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="Opcional — atualiza o fornecedor do insumo se preenchido" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={compraForm.control} name="observacoes" render={({ field }) => (
                  <FormItem><FormLabel>Observações</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  O preço médio será recalculado por <strong>média ponderada</strong> com o estoque atual.
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCompraInsumo(null)}>Cancelar</Button>
                  <Button type="submit">Registrar Compra</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhes do Insumo */}
      <Dialog open={!!detailInsumo} onOpenChange={(o) => !o && setDetailInsumo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailInsumo?.nome}</DialogTitle>
          </DialogHeader>
          {detailInsumo && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap text-sm">
                <Badge variant="outline">{detailInsumo.categoria}</Badge>
                {detailInsumo.retornavel && <Badge variant="secondary"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>}
                <Badge>{detailInsumo.quantidade} {detailInsumo.unidade}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                {detailInsumo.preco != null && <div>Preço médio: R$ {Number(detailInsumo.preco).toFixed(2)}</div>}
                {detailInsumo.localizacao && <div>Local: {detailInsumo.localizacao}</div>}
                {detailInsumo.fornecedor && <div>Fornecedor: {detailInsumo.fornecedor}</div>}
                <div>Estoque mínimo: {detailInsumo.estoque_minimo}</div>
                <div>Estoque crítico: {detailInsumo.estoque_critico}</div>
              </div>
              {detailInsumo.observacoes && (
                <div className="text-sm"><span className="font-medium">Observações: </span>{detailInsumo.observacoes}</div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Fotos e vídeos ({(detailInsumo.midias || []).length})</h4>
                {(detailInsumo.midias || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mídia anexada.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(detailInsumo.midias || []).map((m, i) => (
                      <a key={m.path} href={m.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-md overflow-hidden border bg-muted">
                        {isVideo(m) ? (
                          <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" controls />
                        ) : (
                          <img src={m.url} alt={m.name || `mídia ${i + 1}`} className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
