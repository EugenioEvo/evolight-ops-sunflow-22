import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ticket, 
  Plus, 
  Search, 
  Clock, 
  User, 
  MapPin, 
  Wrench, 
  AlertTriangle,
  CheckCircle,
  Calendar
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const ticketSchema = z.object({
  titulo: z.string().min(5, "Título deve ter pelo menos 5 caracteres"),
  cliente: z.string().min(2, "Cliente é obrigatório"),
  endereco: z.string().min(5, "Endereço é obrigatório"),
  tipo: z.enum(["manutencao", "instalacao", "inspecao", "reparo", "emergencia"]),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  equipamentos: z.string().optional(),
  dataAgendamento: z.string().min(1, "Data de agendamento é obrigatória"),
  tecnicoResponsavel: z.string().optional(),
  observacoes: z.string().optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

interface TicketData extends TicketForm {
  id: number;
  status: "aberto" | "em_andamento" | "pausado" | "concluido" | "cancelado";
  dataAbertura: string;
  dataVencimento: string;
  tempoEstimado: string;
}

const Tickets = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);

  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      titulo: "",
      cliente: "",
      endereco: "",
      tipo: "manutencao",
      prioridade: "media",
      descricao: "",
      equipamentos: "",
      dataAgendamento: "",
      tecnicoResponsavel: "",
      observacoes: "",
    },
  });

  // Mock data - será substituído pelo Supabase
  const [tickets, setTickets] = useState<TicketData[]>([
    {
      id: 1,
      titulo: "Manutenção Preventiva Inversor Principal",
      cliente: "Solar Tech Ltda",
      endereco: "Av. Paulista, 1000 - São Paulo, SP",
      tipo: "manutencao",
      prioridade: "alta",
      descricao: "Realizar manutenção preventiva no inversor principal e verificar conexões",
      equipamentos: "Inversor SUN2000-60KTL-M0",
      dataAgendamento: "2024-01-15",
      tecnicoResponsavel: "João Silva",
      observacoes: "Cliente solicitou horário após 14h",
      status: "aberto",
      dataAbertura: "2024-01-10",
      dataVencimento: "2024-01-15",
      tempoEstimado: "2h"
    },
    {
      id: 2,
      titulo: "Inspeção Módulos Fotovoltaicos",
      cliente: "Green Energy Corp",
      endereco: "Rua das Flores, 500 - São Paulo, SP",
      tipo: "inspecao",
      prioridade: "media",
      descricao: "Inspeção visual e termográfica dos módulos fotovoltaicos",
      equipamentos: "Módulos Canadian Solar 450W",
      dataAgendamento: "2024-01-12",
      tecnicoResponsavel: "Maria Santos",
      observacoes: "",
      status: "em_andamento",
      dataAbertura: "2024-01-08",
      dataVencimento: "2024-01-12",
      tempoEstimado: "1h 30min"
    },
    {
      id: 3,
      titulo: "Instalação Sistema de Monitoramento",
      cliente: "EcoSolar Brasil",
      endereco: "Av. Faria Lima, 2000 - São Paulo, SP",
      tipo: "instalacao",
      prioridade: "baixa",
      descricao: "Instalar sistema de monitoramento remoto",
      equipamentos: "Gateway de Comunicação",
      dataAgendamento: "2024-01-20",
      tecnicoResponsavel: "Pedro Costa",
      observacoes: "Aguardando entrega do equipamento",
      status: "concluido",
      dataAbertura: "2024-01-05",
      dataVencimento: "2024-01-20",
      tempoEstimado: "4h"
    }
  ]);

  const onSubmit = (data: TicketForm) => {
    if (editingTicket) {
      const updatedTicket: TicketData = { 
        ...data, 
        id: editingTicket.id,
        status: editingTicket.status,
        dataAbertura: editingTicket.dataAbertura,
        dataVencimento: data.dataAgendamento,
        tempoEstimado: "2h" // Calcular baseado no tipo
      };
      setTickets(prev => prev.map(ticket => 
        ticket.id === editingTicket.id ? updatedTicket : ticket
      ));
    } else {
      const newTicket: TicketData = {
        id: Date.now(),
        ...data,
        status: "aberto",
        dataAbertura: new Date().toISOString().split('T')[0],
        dataVencimento: data.dataAgendamento,
        tempoEstimado: "2h" // Calcular baseado no tipo
      };
      setTickets(prev => [...prev, newTicket]);
    }
    
    form.reset();
    setIsDialogOpen(false);
    setEditingTicket(null);
  };

  const handleEdit = (ticket: TicketData) => {
    setEditingTicket(ticket);
    form.reset(ticket);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setTickets(prev => prev.filter(ticket => ticket.id !== id));
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "todos") return matchesSearch;
    return matchesSearch && ticket.status === activeTab;
  });

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "critica": return "bg-red-500 text-white";
      case "alta": return "bg-red-100 text-red-800";
      case "media": return "bg-yellow-100 text-yellow-800";
      case "baixa": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aberto": return "bg-blue-100 text-blue-800";
      case "em_andamento": return "bg-orange-100 text-orange-800";
      case "pausado": return "bg-gray-100 text-gray-800";
      case "concluido": return "bg-green-100 text-green-800";
      case "cancelado": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "manutencao": return <Wrench className="h-4 w-4" />;
      case "instalacao": return <Plus className="h-4 w-4" />;
      case "inspecao": return <Search className="h-4 w-4" />;
      case "reparo": return <Wrench className="h-4 w-4" />;
      case "emergencia": return <AlertTriangle className="h-4 w-4" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  const getStatusCounts = () => {
    return {
      todos: tickets.length,
      aberto: tickets.filter(t => t.status === "aberto").length,
      em_andamento: tickets.filter(t => t.status === "em_andamento").length,
      pausado: tickets.filter(t => t.status === "pausado").length,
      concluido: tickets.filter(t => t.status === "concluido").length,
      cancelado: tickets.filter(t => t.status === "cancelado").length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Tickets</h1>
          <p className="text-muted-foreground">Abra e gerencie chamados de manutenção</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-solar shadow-solar">
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTicket ? "Editar Ticket" : "Novo Ticket"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Título do Ticket</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Manutenção preventiva inversor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome do cliente" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataAgendamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Agendamento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <Input {...field} placeholder="Endereço completo do local" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
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
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                            <SelectItem value="instalacao">Instalação</SelectItem>
                            <SelectItem value="inspecao">Inspeção</SelectItem>
                            <SelectItem value="reparo">Reparo</SelectItem>
                            <SelectItem value="emergencia">Emergência</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="prioridade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tecnicoResponsavel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Técnico Responsável</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome do técnico" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="equipamentos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipamentos Envolvidos</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Inversor, Módulos, Estrutura" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Problema/Serviço</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva detalhadamente o problema ou serviço a ser realizado" />
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
                        <Textarea {...field} placeholder="Informações adicionais, horários preferenciais, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="bg-gradient-solar">
                    {editingTicket ? "Atualizar" : "Criar Ticket"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingTicket(null);
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

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="todos" onClick={() => setActiveTab("todos")}>
            Todos ({statusCounts.todos})
          </TabsTrigger>
          <TabsTrigger value="aberto" onClick={() => setActiveTab("aberto")}>
            Abertos ({statusCounts.aberto})
          </TabsTrigger>
          <TabsTrigger value="em_andamento" onClick={() => setActiveTab("em_andamento")}>
            Em Andamento ({statusCounts.em_andamento})
          </TabsTrigger>
          <TabsTrigger value="pausado" onClick={() => setActiveTab("pausado")}>
            Pausados ({statusCounts.pausado})
          </TabsTrigger>
          <TabsTrigger value="concluido" onClick={() => setActiveTab("concluido")}>
            Concluídos ({statusCounts.concluido})
          </TabsTrigger>
          <TabsTrigger value="cancelado" onClick={() => setActiveTab("cancelado")}>
            Cancelados ({statusCounts.cancelado})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid gap-4">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start space-x-3">
                        {getTipoIcon(ticket.tipo)}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{ticket.titulo}</h3>
                          <p className="text-sm text-muted-foreground">{ticket.cliente}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Badge className={getPrioridadeColor(ticket.prioridade)}>
                            {ticket.prioridade}
                          </Badge>
                          <Badge className={getStatusColor(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{ticket.endereco}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Agendado: {new Date(ticket.dataAgendamento).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>Estimado: {ticket.tempoEstimado}</span>
                        </div>
                      </div>

                      {ticket.tecnicoResponsavel && (
                        <div className="flex items-center space-x-2 text-sm">
                          <User className="h-4 w-4" />
                          <span>Técnico: {ticket.tecnicoResponsavel}</span>
                        </div>
                      )}
                      
                      <p className="text-sm">{ticket.descricao}</p>
                      
                      {ticket.equipamentos && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Equipamentos:</strong> {ticket.equipamentos}
                        </p>
                      )}

                      {ticket.observacoes && (
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          <strong>Observações:</strong> {ticket.observacoes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(ticket)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(ticket.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTickets.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum ticket encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente ajustar sua busca" : "Comece abrindo seu primeiro ticket"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tickets;