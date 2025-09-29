import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Package, PillIcon, Wrench, Trash2, Edit, ArrowUpIcon, ArrowDownIcon, Users, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const insumoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  unidade: z.string().min(1, "Unidade é obrigatória"),
  preco: z.number().min(0, "Preço deve ser positivo").optional(),
  estoque_minimo: z.number().min(0, "Estoque mínimo deve ser positivo"),
  estoque_critico: z.number().min(0, "Estoque crítico deve ser positivo"),
  localizacao: z.string().optional(),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
});

const movimentacaoSchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  quantidade: z.number().min(1, "Quantidade deve ser maior que zero"),
  responsavel_id: z.string().min(1, "Responsável é obrigatório"),
  motivo: z.string().optional(),
  observacoes: z.string().optional(),
});

const responsavelSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.enum(["funcionario", "prestador", "fornecedor"]),
  contato: z.string().optional(),
  observacoes: z.string().optional(),
});

type InsumoForm = z.infer<typeof insumoSchema>;
type MovimentacaoForm = z.infer<typeof movimentacaoSchema>;
type ResponsavelForm = z.infer<typeof responsavelSchema>;

interface Insumo extends InsumoForm {
  id: string;
  quantidade: number;
  created_at: string;
  updated_at: string;
}

interface Movimentacao {
  id: string;
  insumo_id: string;
  responsavel_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  motivo?: string;
  observacoes?: string;
  data_movimentacao: string;
  created_at: string;
  responsaveis?: {
    nome: string;
    tipo: string;
  };
}

interface Responsavel extends ResponsavelForm {
  id: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function Insumos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isInsumoDialogOpen, setIsInsumoDialogOpen] = useState(false);
  const [isMovimentacaoDialogOpen, setIsMovimentacaoDialogOpen] = useState(false);
  const [isResponsavelDialogOpen, setIsResponsavelDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [movimentacaoTipo, setMovimentacaoTipo] = useState<"entrada" | "saida">("entrada");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const insumoForm = useForm<InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      nome: "",
      categoria: "",
      unidade: "unidade",
      estoque_minimo: 10,
      estoque_critico: 5,
      localizacao: "",
      fornecedor: "",
      observacoes: "",
    },
  });

  const movimentacaoForm = useForm<MovimentacaoForm>({
    resolver: zodResolver(movimentacaoSchema),
    defaultValues: {
      tipo: "entrada",
      quantidade: 1,
      responsavel_id: "",
      motivo: "",
      observacoes: "",
    },
  });

  const responsavelForm = useForm<ResponsavelForm>({
    resolver: zodResolver(responsavelSchema),
    defaultValues: {
      nome: "",
      tipo: "funcionario",
      contato: "",
      observacoes: "",
    },
  });

  // Load data from database
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load insumos
      const { data: insumosData, error: insumosError } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');
      
      if (insumosError) throw insumosError;
      
      // Load responsaveis
      const { data: responsaveisData, error: responsaveisError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (responsaveisError) throw responsaveisError;
      
      // Load movimentacoes with responsaveis
      const { data: movimentacoesData, error: movimentacoesError } = await supabase
        .from('movimentacoes')
        .select(`
          *,
          responsaveis (nome, tipo)
        `)
        .order('data_movimentacao', { ascending: false });
      
      if (movimentacoesError) throw movimentacoesError;
      
      setInsumos(insumosData || []);
      setResponsaveis((responsaveisData || []) as Responsavel[]);
      setMovimentacoes((movimentacoesData || []) as Movimentacao[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados. Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitInsumo = async (data: InsumoForm) => {
    try {
      if (editingInsumo) {
        const { error } = await supabase
          .from('insumos')
          .update(data as any)
          .eq('id', editingInsumo.id);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Insumo atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('insumos')
          .insert([data as any]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Insumo criado com sucesso!",
        });
      }
      
      loadData();
      setIsInsumoDialogOpen(false);
      setEditingInsumo(null);
      insumoForm.reset();
    } catch (error) {
      console.error('Error saving insumo:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar insumo.",
        variant: "destructive",
      });
    }
  };

  const onSubmitMovimentacao = async (data: MovimentacaoForm) => {
    try {
      if (!selectedInsumo) return;
      
      // Check if trying to remove more than available stock
      if (data.tipo === "saida" && data.quantidade > selectedInsumo.quantidade) {
        toast({
          title: "Erro",
          description: "Quantidade de saída maior que estoque disponível.",
          variant: "destructive",
        });
        return;
      }
      
      const { error } = await supabase
        .from('movimentacoes')
        .insert([{
          ...data,
          insumo_id: selectedInsumo.id,
        } as any]);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `${data.tipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso!`,
      });
      
      loadData();
      setIsMovimentacaoDialogOpen(false);
      setSelectedInsumo(null);
      movimentacaoForm.reset();
    } catch (error) {
      console.error('Error saving movimentacao:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar movimentação.",
        variant: "destructive",
      });
    }
  };

  const onSubmitResponsavel = async (data: ResponsavelForm) => {
    try {
      const { error } = await supabase
        .from('responsaveis')
        .insert([data as any]);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Responsável cadastrado com sucesso!",
      });
      
      loadData();
      setIsResponsavelDialogOpen(false);
      responsavelForm.reset();
    } catch (error) {
      console.error('Error saving responsavel:', error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar responsável.",
        variant: "destructive",
      });
    }
  };

  const handleEditInsumo = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    insumoForm.reset({
      nome: insumo.nome,
      categoria: insumo.categoria,
      unidade: insumo.unidade,
      preco: insumo.preco,
      estoque_minimo: insumo.estoque_minimo,
      estoque_critico: insumo.estoque_critico,
      localizacao: insumo.localizacao,
      fornecedor: insumo.fornecedor,
      observacoes: insumo.observacoes,
    });
    setIsInsumoDialogOpen(true);
  };

  const handleDeleteInsumo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Insumo excluído com sucesso!",
      });
      
      loadData();
    } catch (error) {
      console.error('Error deleting insumo:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir insumo.",
        variant: "destructive",
      });
    }
  };

  const handleMovimentacao = (insumo: Insumo, tipo: "entrada" | "saida") => {
    setSelectedInsumo(insumo);
    setMovimentacaoTipo(tipo);
    movimentacaoForm.setValue("tipo", tipo);
    setIsMovimentacaoDialogOpen(true);
  };

  const getEstoqueStatus = (quantidade: number, estoque_minimo: number, estoque_critico: number) => {
    if (quantidade <= estoque_critico) return "critico";
    if (quantidade <= estoque_minimo) return "baixo";
    return "normal";
  };

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case "medicamentos":
        return <PillIcon className="h-4 w-4" />;
      case "equipamentos":
        return <Wrench className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case "medicamentos":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "equipamentos":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "suprimentos":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "limpeza":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const filteredInsumos = insumos.filter((insumo) => {
    const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "estoque-baixo") {
      const status = getEstoqueStatus(insumo.quantidade, insumo.estoque_minimo, insumo.estoque_critico);
      return matchesSearch && (status === "baixo" || status === "critico");
    }
    return matchesSearch && insumo.categoria === activeTab;
  });

  const categoriaCounts = {
    todos: insumos.length,
    medicamentos: insumos.filter(i => i.categoria === "medicamentos").length,
    equipamentos: insumos.filter(i => i.categoria === "equipamentos").length,
    suprimentos: insumos.filter(i => i.categoria === "suprimentos").length,
    limpeza: insumos.filter(i => i.categoria === "limpeza").length,
    "estoque-baixo": insumos.filter(i => {
      const status = getEstoqueStatus(i.quantidade, i.estoque_minimo, i.estoque_critico);
      return status === "baixo" || status === "critico";
    }).length,
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestão de Insumos</h1>
        <div className="flex gap-2">
          <Dialog open={isResponsavelDialogOpen} onOpenChange={setIsResponsavelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Novo Responsável
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Responsável</DialogTitle>
              </DialogHeader>
              <Form {...responsavelForm}>
                <form onSubmit={responsavelForm.handleSubmit(onSubmitResponsavel)} className="space-y-4">
                  <FormField
                    control={responsavelForm.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={responsavelForm.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="funcionario">Funcionário</SelectItem>
                            <SelectItem value="prestador">Prestador</SelectItem>
                            <SelectItem value="fornecedor">Fornecedor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={responsavelForm.control}
                    name="contato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contato</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={responsavelForm.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsResponsavelDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Cadastrar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isInsumoDialogOpen} onOpenChange={setIsInsumoDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Insumo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingInsumo ? "Editar Insumo" : "Novo Insumo"}</DialogTitle>
              </DialogHeader>
              <Form {...insumoForm}>
                <form onSubmit={insumoForm.handleSubmit(onSubmitInsumo)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={insumoForm.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={insumoForm.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="medicamentos">Medicamentos</SelectItem>
                              <SelectItem value="equipamentos">Equipamentos</SelectItem>
                              <SelectItem value="suprimentos">Suprimentos</SelectItem>
                              <SelectItem value="limpeza">Limpeza</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={insumoForm.control}
                      name="unidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={insumoForm.control}
                      name="preco"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={insumoForm.control}
                      name="localizacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localização</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={insumoForm.control}
                      name="estoque_minimo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Mínimo</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={insumoForm.control}
                      name="estoque_critico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Crítico</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={insumoForm.control}
                    name="fornecedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornecedor</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={insumoForm.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsInsumoDialogOpen(false);
                        setEditingInsumo(null);
                        insumoForm.reset();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingInsumo ? "Atualizar" : "Criar"}
                    </Button>
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
            <DialogTitle>
              {movimentacaoTipo === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
              {selectedInsumo && ` - ${selectedInsumo.nome}`}
            </DialogTitle>
          </DialogHeader>
          <Form {...movimentacaoForm}>
            <form onSubmit={movimentacaoForm.handleSubmit(onSubmitMovimentacao)} className="space-y-4">
              <FormField
                control={movimentacaoForm.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                    {selectedInsumo && movimentacaoTipo === "saida" && (
                      <p className="text-sm text-muted-foreground">
                        Estoque atual: {selectedInsumo.quantidade} {selectedInsumo.unidade}
                      </p>
                    )}
                  </FormItem>
                )}
              />
              
              <FormField
                control={movimentacaoForm.control}
                name="responsavel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {responsaveis.map((responsavel) => (
                          <SelectItem key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome} ({responsavel.tipo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={movimentacaoForm.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Motivo da movimentação" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={movimentacaoForm.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsMovimentacaoDialogOpen(false);
                    setSelectedInsumo(null);
                    movimentacaoForm.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar {movimentacaoTipo === "entrada" ? "Entrada" : "Saída"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="todos">
              Todos ({categoriaCounts.todos})
            </TabsTrigger>
            <TabsTrigger value="medicamentos">
              Medicamentos ({categoriaCounts.medicamentos})
            </TabsTrigger>
            <TabsTrigger value="equipamentos">
              Equipamentos ({categoriaCounts.equipamentos})
            </TabsTrigger>
            <TabsTrigger value="suprimentos">
              Suprimentos ({categoriaCounts.suprimentos})
            </TabsTrigger>
            <TabsTrigger value="limpeza">
              Limpeza ({categoriaCounts.limpeza})
            </TabsTrigger>
            <TabsTrigger value="estoque-baixo" className="text-red-600 dark:text-red-400">
              Estoque Baixo ({categoriaCounts["estoque-baixo"]})
            </TabsTrigger>
            <TabsTrigger value="movimentacoes">
              <History className="h-4 w-4 mr-2" />
              Movimentações
            </TabsTrigger>
          </TabsList>
          
          <Input
            placeholder="Buscar insumos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <TabsContent value="movimentacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((movimentacao) => {
                    const insumo = insumos.find(i => i.id === movimentacao.insumo_id);
                    return (
                      <TableRow key={movimentacao.id}>
                        <TableCell>
                          {new Date(movimentacao.data_movimentacao).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>{insumo?.nome || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={movimentacao.tipo === "entrada" ? "default" : "destructive"}
                            className="capitalize"
                          >
                            {movimentacao.tipo === "entrada" ? (
                              <ArrowUpIcon className="h-3 w-3 mr-1" />
                            ) : (
                              <ArrowDownIcon className="h-3 w-3 mr-1" />
                            )}
                            {movimentacao.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {movimentacao.quantidade} {insumo?.unidade || ''}
                        </TableCell>
                        <TableCell>
                          {movimentacao.responsaveis?.nome || 'N/A'}
                        </TableCell>
                        <TableCell>{movimentacao.motivo || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
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
                      <div className="flex items-center gap-2">
                        {getCategoriaIcon(insumo.categoria)}
                        <CardTitle className="text-lg">{insumo.nome}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditInsumo(insumo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInsumo(insumo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Badge className={getCategoriaColor(insumo.categoria)}>
                      {insumo.categoria}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{insumo.quantidade}</span>
                      <Badge
                        variant={
                          estoqueStatus === "critico"
                            ? "destructive"
                            : estoqueStatus === "baixo"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {estoqueStatus === "critico"
                          ? "Crítico"
                          : estoqueStatus === "baixo"
                          ? "Baixo"
                          : "Normal"}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Unidade: {insumo.unidade}</div>
                      {insumo.preco && <div>Preço: R$ {insumo.preco.toFixed(2)}</div>}
                      {insumo.localizacao && <div>Local: {insumo.localizacao}</div>}
                      {insumo.fornecedor && <div>Fornecedor: {insumo.fornecedor}</div>}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleMovimentacao(insumo, "entrada")}
                      >
                        <ArrowUpIcon className="h-4 w-4 mr-1" />
                        Entrada
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleMovimentacao(insumo, "saida")}
                        disabled={insumo.quantidade === 0}
                      >
                        <ArrowDownIcon className="h-4 w-4 mr-1" />
                        Saída
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
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Tente ajustar os filtros de busca." 
                  : "Comece adicionando alguns insumos ao sistema."}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}