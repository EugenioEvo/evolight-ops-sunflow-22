import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Package, Wrench, Trash2, Edit, ArrowDownIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplyData, useSupplyActions, getEstoqueStatus } from "@/features/supplies";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const getCategoriaIcon = (categoria: string) =>
  ["inversores", "equipamentos_medicao", "ferramentas"].includes(categoria)
    ? <Wrench className="h-4 w-4" />
    : <Package className="h-4 w-4" />;

export default function Insumos() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const osIdParam = searchParams.get("os");
  const {
    insumos, kits, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredInsumos, categoriaCounts, reload,
  } = useSupplyData();

  const {
    insumoForm, saidaForm,
    isInsumoDialogOpen, setIsInsumoDialogOpen,
    isSaidaDialogOpen, setIsSaidaDialogOpen,
    editingInsumo, selectedInsumo,
    onSubmitInsumo, onSubmitSaida,
    handleEditInsumo, handleDeleteInsumo, handleSaida,
    isTecnico,
  } = useSupplyActions(reload);

  // Para fluxo de saída: lista de técnicos + OS ativas do técnico escolhido
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nome: string }>>([]);
  const [osAtivas, setOsAtivas] = useState<Array<{ ordem_servico_id: string; numero_os: string; ticket_titulo: string }>>([]);
  const [meuTecnicoId, setMeuTecnicoId] = useState<string>("");

  const watchedTecnicoId = saidaForm.watch("tecnico_id");
  const watchedTipo = saidaForm.watch("tipo");

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

  // Auto-abrir dialog de saída quando navega de Minhas OS via ?os=<id>
  useEffect(() => {
    if (!osIdParam) return;
    saidaForm.reset({
      tipo: "insumo", insumo_id: undefined, kit_id: undefined,
      quantidade: 1, tecnico_id: meuTecnicoId || "", ordem_servico_id: osIdParam, observacoes: "",
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
              <Button><Plus className="h-4 w-4 mr-2" />Novo Insumo</Button>
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
                    <FormField control={insumoForm.control} name="unidade" render={({ field }) => (<FormItem><FormLabel>Unidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="preco" render={({ field }) => (<FormItem><FormLabel>Preço</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="localizacao" render={({ field }) => (<FormItem><FormLabel>Localização</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={insumoForm.control} name="estoque_minimo" render={({ field }) => (<FormItem><FormLabel>Estoque Mínimo</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={insumoForm.control} name="estoque_critico" render={({ field }) => (<FormItem><FormLabel>Estoque Crítico</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
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

              <FormField control={saidaForm.control} name="ordem_servico_id" render={({ field }) => (
                <FormItem><FormLabel>Ordem de Serviço</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!watchedTecnicoId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={watchedTecnicoId ? "Selecione a OS" : "Escolha o técnico primeiro"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {osAtivas.length === 0 && <div className="p-2 text-sm text-muted-foreground">Nenhuma OS aceita/em execução</div>}
                      {osAtivas.map(os => (
                        <SelectItem key={os.ordem_servico_id} value={os.ordem_servico_id}>
                          {os.numero_os} — {os.ticket_titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

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
              return (
                <Card key={insumo.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">{getCategoriaIcon(insumo.categoria)}<CardTitle className="text-lg">{insumo.nome}</CardTitle></div>
                      {!isTecnico && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditInsumo(insumo)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteInsumo(insumo.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
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
                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleSaida(insumo)} disabled={insumo.quantidade === 0}>
                      <ArrowDownIcon className="h-4 w-4 mr-1" />Registrar Saída
                    </Button>
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
    </div>
  );
}
