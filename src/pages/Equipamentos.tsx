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
import { Zap, Plus, Search, Calendar, Shield, Edit, Trash2, Battery, Sun, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const equipamentoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  modelo: z.string().min(1, "Modelo é obrigatório"),
  fabricante: z.string().min(1, "Fabricante é obrigatório"),
  numeroSerie: z.string().min(1, "Número de série é obrigatório"),
  tipo: z.enum(["inversor", "painel", "bateria", "monitoring", "estrutura", "outros"]),
  capacidade: z.string().optional(),
  tensao: z.string().optional(),
  corrente: z.string().optional(),
  dataInstalacao: z.string(),
  garantia: z.number().min(0, "Garantia deve ser positiva"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  status: z.enum(["operacional", "manutencao", "defeito", "inativo"]),
  observacoes: z.string().optional(),
});

type EquipamentoForm = z.infer<typeof equipamentoSchema>;

interface Equipamento extends Omit<EquipamentoForm, 'status'> {
  id: number;
  status: "operacional" | "manutencao" | "defeito" | "inativo";
}

const Equipamentos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<any>(null);

  const form = useForm<EquipamentoForm>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: {
      nome: "",
      modelo: "",
      fabricante: "",
      numeroSerie: "",
      tipo: "inversor",
      capacidade: "",
      tensao: "",
      corrente: "",
      dataInstalacao: "",
      garantia: 0,
      cliente: "",
      localizacao: "",
      status: "operacional",
      observacoes: "",
    },
  });

  // Mock data - será substituído pelo Supabase
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([
    {
      id: 1,
      nome: "Inversor Principal A1",
      modelo: "SUN2000-60KTL-M0",
      fabricante: "Huawei",
      numeroSerie: "HW2023001",
      tipo: "inversor",
      capacidade: "60 kW",
      tensao: "380V",
      corrente: "90A",
      dataInstalacao: "2023-01-15",
      garantia: 5,
      cliente: "Solar Tech Ltda",
      localizacao: "Telhado - Setor A",
      status: "operacional",
      observacoes: "Monitoramento 24/7 ativo"
    },
    {
      id: 2,
      nome: "Painel Solar Conjunto B",
      modelo: "HiKu7 Mono",
      fabricante: "Canadian Solar",
      numeroSerie: "CS2023045",
      tipo: "painel",
      capacidade: "665 W",
      tensao: "45.5V",
      corrente: "14.6A",
      dataInstalacao: "2023-01-20",
      garantia: 25,
      cliente: "Green Energy Corp",
      localizacao: "Telhado - Setor B",
      status: "operacional",
      observacoes: "120 painéis no total"
    },
    {
      id: 3,
      nome: "Sistema de Monitoramento",
      modelo: "SmartLogger 3000A",
      fabricante: "Huawei",
      numeroSerie: "SL2023010",
      tipo: "monitoring",
      capacidade: "N/A",
      tensao: "12V",
      corrente: "2A",
      dataInstalacao: "2023-02-01",
      garantia: 3,
      cliente: "Solar Tech Ltda",
      localizacao: "Sala Técnica",
      status: "operacional",
      observacoes: "Conectado via 4G"
    }
  ]);

  const onSubmit = (data: EquipamentoForm) => {
    if (editingEquipamento) {
      const updatedEquipamento: Equipamento = { 
        ...data, 
        id: editingEquipamento.id,
        status: data.status || "operacional"
      };
      setEquipamentos(prev => prev.map(equipamento => 
        equipamento.id === editingEquipamento.id ? updatedEquipamento : equipamento
      ));
    } else {
      const newEquipamento: Equipamento = {
        id: Date.now(),
        ...data,
        status: data.status || "operacional"
      };
      setEquipamentos(prev => [...prev, newEquipamento]);
    }
    
    form.reset();
    setIsDialogOpen(false);
    setEditingEquipamento(null);
  };

  const handleEdit = (equipamento: any) => {
    setEditingEquipamento(equipamento);
    form.reset(equipamento);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setEquipamentos(prev => prev.filter(equipamento => equipamento.id !== id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operacional": return "bg-green-100 text-green-800";
      case "manutencao": return "bg-yellow-100 text-yellow-800";
      case "defeito": return "bg-red-100 text-red-800";
      case "inativo": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "inversor": return Zap;
      case "painel": return Sun;
      case "bateria": return Battery;
      case "monitoring": return Activity;
      default: return Zap;
    }
  };

  // Mock clientes para o select
  const clientes = [
    "Solar Tech Ltda",
    "Green Energy Corp",
    "EcoSolar Brasil",
    "Sunshine Power"
  ];

  const filteredEquipamentos = equipamentos.filter(equipamento => {
    const matchesSearch = equipamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipamento.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipamento.fabricante.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipamento.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    return matchesSearch && equipamento.tipo === activeTab;
  });

  const tipoCounts = {
    todos: equipamentos.length,
    inversor: equipamentos.filter(e => e.tipo === "inversor").length,
    painel: equipamentos.filter(e => e.tipo === "painel").length,
    bateria: equipamentos.filter(e => e.tipo === "bateria").length,
    monitoring: equipamentos.filter(e => e.tipo === "monitoring").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Equipamentos</h1>
          <p className="text-muted-foreground">Gerencie equipamentos solares</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar">
              <Plus className="h-4 w-4 mr-2" />
              Novo Equipamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}
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
                        <FormLabel>Nome do Equipamento</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
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
                            <SelectItem value="inversor">Inversor</SelectItem>
                            <SelectItem value="painel">Painel Solar</SelectItem>
                            <SelectItem value="bateria">Bateria</SelectItem>
                            <SelectItem value="monitoring">Monitoramento</SelectItem>
                            <SelectItem value="estrutura">Estrutura</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fabricante"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fabricante</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="numeroSerie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Série</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="capacidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacidade</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 60 kW" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tensao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 380V" />
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
                        <FormLabel>Corrente</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 90A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente) => (
                              <SelectItem key={cliente} value={cliente}>
                                {cliente}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="localizacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localização</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Telhado - Setor A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="dataInstalacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Instalação</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="garantia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantia (anos)</FormLabel>
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="operacional">Operacional</SelectItem>
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                            <SelectItem value="defeito">Defeito</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    {editingEquipamento ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingEquipamento(null);
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
            placeholder="Buscar equipamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="todos">
            Todos ({tipoCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="inversor">
            Inversores ({tipoCounts.inversor})
          </TabsTrigger>
          <TabsTrigger value="painel">
            Painéis ({tipoCounts.painel})
          </TabsTrigger>
          <TabsTrigger value="bateria">
            Baterias ({tipoCounts.bateria})
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            Monitoramento ({tipoCounts.monitoring})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredEquipamentos.map((equipamento) => {
              const IconComponent = getTipoIcon(equipamento.tipo);
              return (
                <Card key={equipamento.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center space-x-3">
                          <IconComponent className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{equipamento.nome}</h3>
                          <Badge className={getStatusColor(equipamento.status)}>
                            {equipamento.status === "operacional" ? "Operacional" :
                             equipamento.status === "manutencao" ? "Manutenção" :
                             equipamento.status === "defeito" ? "Defeito" : "Inativo"}
                          </Badge>
                          {equipamento.capacidade && (
                            <Badge variant="outline" className="text-xs">
                              {equipamento.capacidade}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Fabricante:</span>
                            <p>{equipamento.fabricante}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Modelo:</span>
                            <p>{equipamento.modelo}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Série:</span>
                            <p>{equipamento.numeroSerie}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Cliente:</span>
                            <p>{equipamento.cliente}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{new Date(equipamento.dataInstalacao).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span>{equipamento.garantia} anos</span>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Localização:</span>
                            <p>{equipamento.localizacao}</p>
                          </div>
                          {equipamento.tensao && (
                            <div>
                              <span className="font-medium text-muted-foreground">Tensão/Corrente:</span>
                              <p>{equipamento.tensao} / {equipamento.corrente}</p>
                            </div>
                          )}
                        </div>
                        
                        {equipamento.observacoes && (
                          <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                            {equipamento.observacoes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(equipamento)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(equipamento.id)}
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

          {filteredEquipamentos.length === 0 && (
            <div className="text-center py-12">
              <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente ajustar sua busca" : "Comece cadastrando um equipamento"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Equipamentos;