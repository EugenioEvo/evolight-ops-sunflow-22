import { useMemo } from "react";
import { Plus, Package, Wrench, Trash2, Edit, ArrowUpIcon, ArrowDownIcon, Users, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VirtualizedTable, Column } from "@/components/VirtualizedTable";
import { useVirtualization } from "@/hooks/useVirtualization";
import { useSupplyData, useSupplyActions, getEstoqueStatus } from "@/features/supplies";
import type { Movimentacao, Insumo } from "@/features/supplies";

const getCategoriaIcon = (categoria: string) => {
  switch (categoria) {
    case "inversores": case "equipamentos_medicao": case "ferramentas":
      return <Wrench className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
};

const getCategoriaColor = (categoria: string) => {
  const colors: Record<string, string> = {
    paineis_solares: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    inversores: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    estruturas_montagem: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    cabos_conectores: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    equipamentos_medicao: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    ferramentas: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    componentes_eletricos: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    manutencao: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };
  return colors[categoria] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
};

interface MovimentacoesTableProps {
  movimentacoes: Movimentacao[];
  insumos: Insumo[];
}

const MovimentacoesTable = ({ movimentacoes, insumos }: MovimentacoesTableProps) => {
  const { shouldVirtualize, maxHeight, overscan } = useVirtualization(movimentacoes.length, { threshold: 30 });
  const columns: Column<Movimentacao>[] = useMemo(() => [
    { key: 'data', header: 'Data', width: '180px', cell: (mov) => new Date(mov.data_movimentacao).toLocaleString('pt-BR') },
    { key: 'insumo', header: 'Insumo', width: '200px', cell: (mov) => insumos.find(i => i.id === mov.insumo_id)?.nome || 'N/A' },
    { key: 'tipo', header: 'Tipo', width: '120px', cell: (mov) => (
      <Badge variant={mov.tipo === "entrada" ? "default" : "destructive"} className="capitalize">
        {mov.tipo === "entrada" ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
        {mov.tipo}
      </Badge>
    )},
    { key: 'quantidade', header: 'Quantidade', width: '120px', cell: (mov) => `${mov.quantidade} ${insumos.find(i => i.id === mov.insumo_id)?.unidade || ''}` },
    { key: 'responsavel', header: 'Responsável', width: '150px', cell: (mov) => mov.responsaveis?.nome || 'N/A' },
    { key: 'motivo', header: 'Motivo', cell: (mov) => mov.motivo || '-' },
  ], [insumos]);

  return <VirtualizedTable data={movimentacoes} columns={columns} maxHeight={shouldVirtualize ? maxHeight : 400} overscan={overscan} emptyMessage="Nenhuma movimentação registrada" />;
};

export default function Insumos() {
  const {
    insumos, movimentacoes, responsaveis, loading, searchTerm, setSearchTerm,
    activeTab, setActiveTab, filteredInsumos, categoriaCounts, reload,
  } = useSupplyData();

  const {
    insumoForm, movimentacaoForm, responsavelForm,
    isInsumoDialogOpen, setIsInsumoDialogOpen,
    isMovimentacaoDialogOpen, setIsMovimentacaoDialogOpen,
    isResponsavelDialogOpen, setIsResponsavelDialogOpen,
    editingInsumo, selectedInsumo, movimentacaoTipo,
    onSubmitInsumo, onSubmitMovimentacao, onSubmitResponsavel,
    handleEditInsumo, handleDeleteInsumo, handleMovimentacao,
  } = useSupplyActions(reload);

  if (loading) {
    return <div className="container mx-auto py-8"><div className="flex items-center justify-center h-64"><div className="text-lg">Carregando...</div></div></div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Insumos</h1>
        <div className="flex gap-2">
          <Dialog open={isResponsavelDialogOpen} onOpenChange={setIsResponsavelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-2" />Novo Responsável</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Responsável</DialogTitle></DialogHeader>
              <Form {...responsavelForm}>
                <form onSubmit={responsavelForm.handleSubmit(onSubmitResponsavel)} className="space-y-4">
                  <FormField control={responsavelForm.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={responsavelForm.control} name="tipo" render={({ field }) => (<FormItem><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="funcionario">Funcionário</SelectItem><SelectItem value="prestador">Prestador</SelectItem><SelectItem value="fornecedor">Fornecedor</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={responsavelForm.control} name="contato" render={({ field }) => (<FormItem><FormLabel>Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={responsavelForm.control} name="observacoes" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsResponsavelDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Cadastrar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

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
                    <FormField control={insumoForm.control} name="categoria" render={({ field }) => (<FormItem><FormLabel>Categoria</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="paineis_solares">Painéis Solares</SelectItem><SelectItem value="inversores">Inversores</SelectItem><SelectItem value="estruturas_montagem">Estruturas de Montagem</SelectItem><SelectItem value="cabos_conectores">Cabos e Conectores</SelectItem><SelectItem value="equipamentos_medicao">Equipamentos de Medição</SelectItem><SelectItem value="ferramentas">Ferramentas</SelectItem><SelectItem value="componentes_eletricos">Componentes Elétricos</SelectItem><SelectItem value="manutencao">Manutenção</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
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
                  <FormField control={insumoForm.control} name="observacoes" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { setIsInsumoDialogOpen(false); insumoForm.reset(); }}>Cancelar</Button>
                    <Button type="submit">{editingInsumo ? "Atualizar" : "Criar"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Movement Dialog */}
      <Dialog open={isMovimentacaoDialogOpen} onOpenChange={setIsMovimentacaoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movimentacaoTipo === "entrada" ? "Registrar Entrada" : "Registrar Saída"}{selectedInsumo && ` - ${selectedInsumo.nome}`}</DialogTitle>
          </DialogHeader>
          <Form {...movimentacaoForm}>
            <form onSubmit={movimentacaoForm.handleSubmit(onSubmitMovimentacao)} className="space-y-4">
              <FormField control={movimentacaoForm.control} name="quantidade" render={({ field }) => (
                <FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage />
                  {selectedInsumo && movimentacaoTipo === "saida" && <p className="text-sm text-muted-foreground">Estoque atual: {selectedInsumo.quantidade} {selectedInsumo.unidade}</p>}
                </FormItem>
              )} />
              <FormField control={movimentacaoForm.control} name="responsavel_id" render={({ field }) => (
                <FormItem><FormLabel>Responsável</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger></FormControl><SelectContent>{responsaveis.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nome} ({r.tipo})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={movimentacaoForm.control} name="motivo" render={({ field }) => (<FormItem><FormLabel>Motivo</FormLabel><FormControl><Input {...field} placeholder="Motivo da movimentação" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={movimentacaoForm.control} name="observacoes" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsMovimentacaoDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Registrar {movimentacaoTipo === "entrada" ? "Entrada" : "Saída"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="todos">Todos ({categoriaCounts.todos})</TabsTrigger>
            <TabsTrigger value="paineis_solares">Painéis ({categoriaCounts.paineis_solares})</TabsTrigger>
            <TabsTrigger value="inversores">Inversores ({categoriaCounts.inversores})</TabsTrigger>
            <TabsTrigger value="estruturas_montagem">Estruturas ({categoriaCounts.estruturas_montagem})</TabsTrigger>
            <TabsTrigger value="cabos_conectores">Cabos ({categoriaCounts.cabos_conectores})</TabsTrigger>
            <TabsTrigger value="equipamentos_medicao">Medição ({categoriaCounts.equipamentos_medicao})</TabsTrigger>
            <TabsTrigger value="ferramentas">Ferramentas ({categoriaCounts.ferramentas})</TabsTrigger>
            <TabsTrigger value="componentes_eletricos">Componentes ({categoriaCounts.componentes_eletricos})</TabsTrigger>
            <TabsTrigger value="manutencao">Manutenção ({categoriaCounts.manutencao})</TabsTrigger>
            <TabsTrigger value="estoque-baixo" className="text-red-600 dark:text-red-400">Estoque Baixo ({categoriaCounts["estoque-baixo"]})</TabsTrigger>
            <TabsTrigger value="movimentacoes"><History className="h-4 w-4 mr-2" />Movimentações</TabsTrigger>
          </TabsList>
          <Input placeholder="Buscar insumos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
        </div>

        <TabsContent value="movimentacoes" className="space-y-4">
          <Card><CardHeader><CardTitle>Histórico de Movimentações ({movimentacoes.length})</CardTitle></CardHeader>
            <CardContent><MovimentacoesTable movimentacoes={movimentacoes} insumos={insumos} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInsumos.map((insumo) => {
              const estoqueStatus = getEstoqueStatus(insumo.quantidade, insumo.estoque_minimo, insumo.estoque_critico);
              return (
                <Card key={insumo.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">{getCategoriaIcon(insumo.categoria)}<CardTitle className="text-lg">{insumo.nome}</CardTitle></div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditInsumo(insumo)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteInsumo(insumo.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Badge className={getCategoriaColor(insumo.categoria)}>{insumo.categoria}</Badge>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleMovimentacao(insumo, "entrada")}>
                        <ArrowUpIcon className="h-4 w-4 mr-1" />Entrada
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleMovimentacao(insumo, "saida")} disabled={insumo.quantidade === 0}>
                        <ArrowDownIcon className="h-4 w-4 mr-1" />Saída
                      </Button>
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
    </div>
  );
}
