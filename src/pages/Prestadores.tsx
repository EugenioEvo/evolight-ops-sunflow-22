import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Mail, Phone, MapPin, Edit, Trash2, GraduationCap, Eye, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const prestadorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  endereco: z.string().min(5, "Endereço é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório"),
  cep: z.string().min(8, "CEP deve ter 8 dígitos"),
  categoria: z.enum(["engenharia", "supervisao", "tecnico"]),
  especialidades: z.string().optional(),
  certificacoes: z.string().optional(),
  experiencia: z.number().min(0, "Experiência deve ser positiva"),
  salario: z.number().min(0, "Salário deve ser positivo"),
  dataAdmissao: z.string(),
});

type PrestadorForm = z.infer<typeof prestadorSchema>;

interface Prestador extends PrestadorForm {
  id: number;
  status: string;
}

const Prestadores = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<any>(null);

  const form = useForm<PrestadorForm>({
    resolver: zodResolver(prestadorSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      cpf: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      categoria: "tecnico",
      especialidades: "",
      certificacoes: "",
      experiencia: 0,
      salario: 0,
      dataAdmissao: "",
    },
  });

  // Mock data - será substituído pelo Supabase
  const [prestadores, setPrestadores] = useState<Prestador[]>([
    {
      id: 1,
      nome: "Dr. Carlos Mendes",
      email: "carlos@evolight.com",
      telefone: "(11) 99999-1111",
      cpf: "123.456.789-01",
      endereco: "Rua A, 100",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01234-567",
      categoria: "engenharia",
      especialidades: "Sistemas Fotovoltaicos, Análise de Performance",
      certificacoes: "CREA-SP, Certificação ABNT",
      experiencia: 8,
      salario: 12000,
      dataAdmissao: "2022-01-15",
      status: "ativo"
    },
    {
      id: 2,
      nome: "Ana Paula Costa",
      email: "ana@evolight.com",
      telefone: "(11) 99999-2222",
      cpf: "987.654.321-01",
      endereco: "Rua B, 200",
      cidade: "São Paulo",
      estado: "SP",
      cep: "02345-678",
      categoria: "supervisao",
      especialidades: "Gestão de Equipes, Planejamento de Manutenção",
      certificacoes: "PMP, Green Belt",
      experiencia: 6,
      salario: 8000,
      dataAdmissao: "2022-03-20",
      status: "ativo"
    },
    {
      id: 3,
      nome: "João Santos",
      email: "joao@evolight.com",
      telefone: "(11) 99999-3333",
      cpf: "456.789.123-01",
      endereco: "Rua C, 300",
      cidade: "São Paulo",
      estado: "SP",
      cep: "03456-789",
      categoria: "tecnico",
      especialidades: "Manutenção de Inversores, Limpeza de Painéis",
      certificacoes: "NR-35, NR-10",
      experiencia: 4,
      salario: 4500,
      dataAdmissao: "2023-01-10",
      status: "ativo"
    }
  ]);

  const onSubmit = (data: PrestadorForm) => {
    if (editingPrestador) {
      const updatedPrestador: Prestador = { ...data, id: editingPrestador.id, status: "ativo" };
      setPrestadores(prev => prev.map(prestador => 
        prestador.id === editingPrestador.id ? updatedPrestador : prestador
      ));
    } else {
      const newPrestador: Prestador = {
        id: Date.now(),
        ...data,
        status: "ativo"
      };
      setPrestadores(prev => [...prev, newPrestador]);
    }
    
    form.reset();
    setIsDialogOpen(false);
    setEditingPrestador(null);
  };

  const handleEdit = (prestador: any) => {
    setEditingPrestador(prestador);
    form.reset(prestador);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setPrestadores(prev => prev.filter(prestador => prestador.id !== id));
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case "engenharia": return "bg-blue-100 text-blue-800";
      case "supervisao": return "bg-orange-100 text-orange-800";
      case "tecnico": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case "engenharia": return GraduationCap;
      case "supervisao": return Eye;
      case "tecnico": return Wrench;
      default: return Users;
    }
  };

  const filteredPrestadores = prestadores.filter(prestador => {
    const matchesSearch = prestador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prestador.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prestador.especialidades.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    return matchesSearch && prestador.categoria === activeTab;
  });

  const categoryCounts = {
    todos: prestadores.length,
    engenharia: prestadores.filter(p => p.categoria === "engenharia").length,
    supervisao: prestadores.filter(p => p.categoria === "supervisao").length,
    tecnico: prestadores.filter(p => p.categoria === "tecnico").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prestadores de Serviço</h1>
          <p className="text-muted-foreground">Gerencie a equipe da Evolight</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar">
              <Plus className="h-4 w-4 mr-2" />
              Novo Prestador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrestador ? "Editar Prestador" : "Novo Prestador"}
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
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
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
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
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
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
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
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
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
                            <SelectItem value="engenharia">Engenharia</SelectItem>
                            <SelectItem value="supervisao">Supervisão</SelectItem>
                            <SelectItem value="tecnico">Técnico de Campo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="experiencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experiência (anos)</FormLabel>
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
                  name="especialidades"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidades</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Sistemas Fotovoltaicos, Inversores..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certificacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificações</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: CREA, NR-10, NR-35..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salário (R$)</FormLabel>
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
                    name="dataAdmissao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Admissão</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingPrestador ? "Atualizar" : "Salvar"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingPrestador(null);
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
            placeholder="Buscar prestadores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos">
            Todos ({categoryCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="engenharia">
            Engenharia ({categoryCounts.engenharia})
          </TabsTrigger>
          <TabsTrigger value="supervisao">
            Supervisão ({categoryCounts.supervisao})
          </TabsTrigger>
          <TabsTrigger value="tecnico">
            Técnicos ({categoryCounts.tecnico})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredPrestadores.map((prestador) => {
              const IconComponent = getCategoriaIcon(prestador.categoria);
              return (
                <Card key={prestador.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center space-x-3">
                          <IconComponent className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{prestador.nome}</h3>
                          <Badge className={getCategoriaColor(prestador.categoria)}>
                            {prestador.categoria === "engenharia" ? "Engenharia" :
                             prestador.categoria === "supervisao" ? "Supervisão" : "Técnico"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {prestador.experiencia} anos
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span>{prestador.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4" />
                            <span>{prestador.telefone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>{prestador.cidade}, {prestador.estado}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm">
                            <span className="font-medium">Especialidades:</span> {prestador.especialidades}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Certificações:</span> {prestador.certificacoes}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Admissão:</span> {new Date(prestador.dataAdmissao).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(prestador)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(prestador.id)}
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

          {filteredPrestadores.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum prestador encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente ajustar sua busca" : "Comece cadastrando um prestador de serviço"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Prestadores;