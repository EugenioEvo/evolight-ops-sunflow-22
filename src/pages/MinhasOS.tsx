import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Eye, Calendar, MapPin, User, Play, Edit, Phone, Navigation } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface OrdemServico {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  pdf_url: string | null;
  ticket_id: string;
  tickets: {
    id: string;
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    prioridade: string;
    status: string;
    data_inicio_execucao: string | null;
    clientes: {
      empresa: string;
      profiles?: {
        telefone?: string;
      };
    };
  };
}

const MinhasOS = () => {
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isTecnico = profile?.role === "tecnico_campo";

  useEffect(() => {
    if (isTecnico) {
      loadOrdensServico();
    }
  }, [isTecnico]);

  const loadOrdensServico = async () => {
    try {
      setLoading(true);

      const { data: tecnicoData, error: tecnicoError } = await supabase
        .from("tecnicos")
        .select("id")
        .eq("profile_id", profile?.id)
        .single();

      if (tecnicoError) throw tecnicoError;

      const { data: osData, error: osError } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          data_programada,
          hora_inicio,
          hora_fim,
          tickets (
            id,
            numero_ticket,
            titulo,
            endereco_servico,
            prioridade,
            status,
            data_inicio_execucao,
            clientes (
              empresa,
              profiles!clientes_profile_id_fkey(telefone)
            )
          )
        `)
        .eq("tecnico_id", tecnicoData.id)
        .order("data_emissao", { ascending: false });

      if (osError) throw osError;

      setOrdensServico(osData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ordens de serviço",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarExecucao = async (os: OrdemServico) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          status: "em_execucao",
          data_inicio_execucao: new Date().toISOString()
        })
        .eq("id", os.ticket_id);

      if (error) throw error;

      toast({
        title: "Execução iniciada!",
        description: "A ordem de serviço foi iniciada com sucesso.",
      });

      loadOrdensServico();
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar execução",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePreencherRME = (os: OrdemServico) => {
    navigate(`/rme?os=${os.id}`);
  };

  const handleVerOS = async (os: OrdemServico) => {
    try {
      if (!os.pdf_url) {
        toast({
          title: "PDF não disponível",
          description: "A ordem de serviço ainda não tem PDF gerado.",
          variant: "destructive",
        });
        return;
      }

      const filePath = os.pdf_url.split('/ordens-servico/')[1];
      
      if (!filePath) {
        throw new Error("Caminho do arquivo não encontrado");
      }

      const { data, error } = await supabase.storage
        .from("ordens-servico")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao abrir PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLigarCliente = (telefone?: string) => {
    if (!telefone) {
      toast({
        title: "Telefone não disponível",
        description: "Este cliente não possui telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  const handleAbrirMapa = (endereco: string) => {
    const encodedAddress = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "critica":
        return "destructive";
      case "alta":
        return "default";
      case "media":
        return "secondary";
      case "baixa":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadge = (status: string) => {
    const labels: Record<string, { label: string; variant: any }> = {
      'ordem_servico_gerada': { label: 'Pendente', variant: 'outline' },
      'em_execucao': { label: 'Em Execução', variant: 'default' },
      'concluido': { label: 'Concluído', variant: 'secondary' },
    };
    return labels[status] || { label: status, variant: 'outline' };
  };

  const renderOSCard = (os: OrdemServico) => {
    const statusBadge = getStatusBadge(os.tickets.status);
    const isPendente = os.tickets.status === 'ordem_servico_gerada';
    const emExecucao = os.tickets.status === 'em_execucao';
    const concluido = os.tickets.status === 'concluido';

    return (
      <Card key={os.id} className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {os.numero_os}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Ticket: {os.tickets.numero_ticket}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge variant={getPrioridadeColor(os.tickets.prioridade)}>
                {os.tickets.prioridade}
              </Badge>
              <Badge variant={statusBadge.variant as any}>
                {statusBadge.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">{os.tickets.titulo}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">{os.tickets.clientes.empresa}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{os.tickets.endereco_servico}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Emitida: {format(new Date(os.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {os.data_programada && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Programada: {format(new Date(os.data_programada), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
            {os.tickets.data_inicio_execucao && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Iniciada: {format(new Date(os.tickets.data_inicio_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleLigarCliente(os.tickets.clientes.profiles?.telefone)}
              className="flex-1"
            >
              <Phone className="h-4 w-4 mr-1" />
              Ligar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAbrirMapa(os.tickets.endereco_servico)}
              className="flex-1"
            >
              <Navigation className="h-4 w-4 mr-1" />
              Mapa
            </Button>
          </div>

          {/* Botões de Ação Principal */}
          <div className="space-y-2">
            {isPendente && (
              <Button
                onClick={() => handleIniciarExecucao(os)}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Execução
              </Button>
            )}

            {emExecucao && (
              <Button
                onClick={() => handlePreencherRME(os)}
                className="w-full"
              >
                <Edit className="h-4 w-4 mr-2" />
                Preencher RME
              </Button>
            )}

            <Button
              onClick={() => handleVerOS(os)}
              variant="outline"
              className="w-full"
              disabled={!os.pdf_url}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver OS em PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!isTecnico) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Esta página é exclusiva para técnicos de campo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendentes = ordensServico.filter(os => os.tickets.status === 'ordem_servico_gerada');
  const emExecucao = ordensServico.filter(os => os.tickets.status === 'em_execucao');
  const concluidas = ordensServico.filter(os => os.tickets.status === 'concluido');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minhas Ordens de Serviço</h1>
        <p className="text-muted-foreground">
          Gerencie suas ordens de serviço por status
        </p>
      </div>

      {ordensServico.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Você ainda não possui ordens de serviço atribuídas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes" className="relative">
              Pendentes
              {pendentes.length > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {pendentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="execucao" className="relative">
              Em Execução
              {emExecucao.length > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {emExecucao.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              Concluídas
              {concluidas.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {concluidas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-6">
            {pendentes.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Nenhuma OS pendente no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendentes.map(renderOSCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="execucao" className="mt-6">
            {emExecucao.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Nenhuma OS em execução no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {emExecucao.map(renderOSCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="mt-6">
            {concluidas.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Nenhuma OS concluída ainda.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {concluidas.map(renderOSCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default MinhasOS;
