import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Search, AlertTriangle, TrendingUp, TrendingDown, Edit, Trash2, Wrench, Zap, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const insumoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  codigo: z.string().min(1, "Código é obrigatório"),
  categoria: z.enum(["componente", "ferramenta", "material", "consumivel", "epi"]),
  unidade: z.string().min(1, "Unidade é obrigatória"),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
  precoUnitario: z.number().min(0, "Preço deve ser positivo"),
  estoqueMinimo: z.number().min(0, "Estoque mínimo deve ser positivo"),
  estoqueAtual: z.number().min(0, "Estoque atual deve ser positivo"),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  observacoes: z.string().optional(),
});

type InsumoForm = z.infer<typeof insumoSchema>;

interface Insumo extends InsumoForm {
  id: number;
}

const Insumos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<any>(null);

  const form = useForm<InsumoForm>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      nome: "",
      codigo: "",
      categoria: "componente",
      unidade: "",
      fornecedor: "",
      precoUnitario: 0,
      estoqueMinimo: 0,
      estoqueAtual: 0,
      localizacao: "",
      observacoes: "",
    },
  });

  // Mock data - será substituído pelo Supabase
  const [insumos, setInsumos] = useState<Insumo[]>([
    {
      id: 1,
      nome: "Fusível DC 32A",
      codigo: "FUS-DC-32A",
      categoria: "componente",
      unidade: "un",
      fornecedor: "Schneider Electric",
      precoUnitario: 45.90,
      estoqueMinimo: 10,
      estoqueAtual: 25,
      localizacao: "Almoxarifado A - Prateleira 3",
      observacoes: "Para sistemas de 1000V DC"
    },
    {
      id: 2,
      nome: "Chave Philips 3/8",
      codigo: "FER-PHIL-38",
      categoria: "ferramenta",
      unidade: "un",
      fornecedor: "Gedore",
      precoUnitario: 89.50,
      estoqueMinimo: 5,
      estoqueAtual: 3,
      localizacao: "Almoxarifado B - Gaveta 12",
      observacoes: "Uso específico para conectores MC4"
    },
    {
      id: 3,
      nome: "Cabo DC 6mm² Preto",
      codigo: "CAB-DC-6MM-PT",
      categoria: "material",
      unidade: "m",
      fornecedor: "Prysmian",
      precoUnitario: 8.75,
      estoqueMinimo: 100,
      estoqueAtual: 450,
      localizacao: "Almoxarifado C - Bobinas",
      observacoes: "Cabo solar certificado TUV"
    },
    {
      id: 4,
      nome: "Luva de Proteção Classe 0",
      codigo: "EPI-LUV-CL0",
      categoria: "epi",
      unidade: "par",
      fornecedor: "Proteção Solar",
      precoUnitario: 125.00,
      estoqueMinimo: 20,
      estoqueAtual: 8,
      localizacao: "Almoxarifado EPI",
      observacoes: "Válida até 12/2024"
    },
    {
      id: 5,
      nome: "Álcool Isopropílico",
      codigo: "CONS-ALC-ISO",
      categoria: "consumivel",
      unidade: "L",
      fornecedor: "Química Solar",
      precoUnitario: 28.90,
      estoqueMinimo: 5,
      estoqueAtual: 12,
      localizacao: "Almoxarifado D - Químicos",
      observacoes: "Para limpeza de conectores"
    }
  ]);

  const onSubmit = (data: InsumoForm) => {
    if (editingInsumo) {
      const updatedInsumo: Insumo = { ...data, id: editingInsumo.id };
      setInsumos(prev => prev.map(insumo => 
        insumo.id === editingInsumo.id ? updatedInsumo : insumo
      ));
    } else {
      const newInsumo: Insumo = {
        id: Date.now(),
        ...data,
      };
      setInsumos(prev => [...prev, newInsumo]);
    }
    
    form.reset();
    setIsDialogOpen(false);
    setEditingInsumo(null);
  };

  const handleEdit = (insumo: any) => {
    setEditingInsumo(insumo);
    form.reset(insumo);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setInsumos(prev => prev.filter(insumo => insumo.id !== id));
  };

  const getEstoqueStatus = (atual: number, minimo: number) => {
    if (atual <= minimo * 0.5) return { status: "critico", color: "bg-red-100 text-red-800" };
    if (atual <= minimo) return { status: "baixo", color: "bg-yellow-100 text-yellow-800" };
    return { status: "normal", color: "bg-green-100 text-green-800" };
  };

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case "componente": return Zap;
      case "ferramenta": return Wrench;
      case "material": return Package;
      case "consumivel": return Package;
      case "epi": return Shield;
      default: return Package;
    }
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case "componente": return "bg-blue-100 text-blue-800";
      case "ferramenta": return "bg-orange-100 text-orange-800";
      case "material": return "bg-green-100 text-green-800";
      case "consumivel": return "bg-purple-100 text-purple-800";
      case "epi": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredInsumos = insumos.filter(insumo => {
    const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         insumo.fornecedor.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    if (activeTab === "baixo-estoque") {
      return matchesSearch && insumo.estoqueAtual <= insumo.estoqueMinimo;
    }
    return matchesSearch && insumo.categoria === activeTab;
  });

  const categoriaCounts = {
    todos: insumos.length,
    componente: insumos.filter(i => i.categoria === "componente").length,
    ferramenta: insumos.filter(i => i.categoria === "ferramenta").length,
    material: insumos.filter(i => i.categoria === "material").length,
    consumivel: insumos.filter(i => i.categoria === "consumivel").length,
    epi: insumos.filter(i => i.categoria === "epi").length,
    "baixo-estoque": insumos.filter(i => i.estoqueAtual <= i.estoqueMinimo).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Insumos</h1>
          <p className="text-muted-foreground">Controle de estoque e materiais</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar">
              <Plus className="h-4 w-4 mr-2" />
              Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInsumo ? "Editar Insumo" : "Novo Insumo"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Insumo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
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
                            <SelectItem value="componente">Componente</SelectItem>
                            <SelectItem value="ferramenta">Ferramenta</SelectItem>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="consumivel">Consumível</SelectItem>
                            <SelectItem value="epi">EPI</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="unidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: un, m, kg, L" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="precoUnitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Unitário (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estoqueMinimo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Mínimo</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="estoqueAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Atual</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="localizacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Almoxarifado A - Prateleira 3" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingInsumo ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingInsumo(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar insumos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="todos">
            Todos ({categoriaCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="componente">
            Componentes ({categoriaCounts.componente})
          </TabsTrigger>
          <TabsTrigger value="ferramenta">
            Ferramentas ({categoriaCounts.ferramenta})
          </TabsTrigger>
          <TabsTrigger value="material">
            Materiais ({categoriaCounts.material})
          </TabsTrigger>
          <TabsTrigger value="consumivel">
            Consumíveis ({categoriaCounts.consumivel})
          </TabsTrigger>
          <TabsTrigger value="epi">
            EPIs ({categoriaCounts.epi})
          </TabsTrigger>
          <TabsTrigger value="baixo-estoque" className="text-destructive">
            Baixo Estoque ({categoriaCounts["baixo-estoque"]})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredInsumos.map((insumo) => {
              const IconComponent = getCategoriaIcon(insumo.categoria);
              const estoqueStatus = getEstoqueStatus(insumo.estoqueAtual, insumo.estoqueMinimo);
              const valorTotal = insumo.estoqueAtual * insumo.precoUnitario;
              
              return (
                <Card key={insumo.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center space-x-3">
                          <IconComponent className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{insumo.nome}</h3>
                          <Badge className={getCategoriaColor(insumo.categoria)}>
                            {insumo.categoria === "componente" ? "Componente" :
                             insumo.categoria === "ferramenta" ? "Ferramenta" :
                             insumo.categoria === "material" ? "Material" :
                             insumo.categoria === "consumivel" ? "Consumível" : "EPI"}
                          </Badge>
                          <Badge className={estoqueStatus.color}>
                            {estoqueStatus.status === "critico" ? "Crítico" :
                             estoqueStatus.status === "baixo" ? "Baixo" : "Normal"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Código:</span>
                            <p className="font-mono">{insumo.codigo}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Fornecedor:</span>
                            <p>{insumo.fornecedor}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Preço Unit.:</span>
                            <p>R$ {insumo.precoUnitario.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Valor Total:</span>
                            <p className="font-semibold">R$ {valorTotal.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="text-sm text-muted-foreground">Estoque Atual</p>
                              <p className="text-lg font-bold">{insumo.estoqueAtual} {insumo.unidade}</p>
                            </div>
                            {insumo.estoqueAtual > insumo.estoqueMinimo ? (
                              <TrendingUp className="h-5 w-5 text-success" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-destructive" />
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="text-sm text-muted-foreground">Mínimo</p>
                              <p className="text-lg font-bold">{insumo.estoqueMinimo} {insumo.unidade}</p>
                            </div>
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                          </div>
                          
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Localização</p>
                            <p className="font-medium">{insumo.localizacao}</p>
                          </div>
                        </div>
                        
                        {insumo.observacoes && (
                          <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                            {insumo.observacoes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(insumo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(insumo.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredInsumos.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum insumo encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente ajustar sua busca" : "Comece cadastrando um insumo"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Insumos;