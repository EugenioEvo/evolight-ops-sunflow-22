import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Eye, Calendar, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrdemServico {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  pdf_url: string | null;
  ticket_id: string;
  tickets: {
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    prioridade: string;
    clientes: {
      empresa: string;
    };
  };
}

const MinhasOS = () => {
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const { toast } = useToast();

  const isTecnico = profile?.role === "tecnico_campo";

  useEffect(() => {
    if (isTecnico) {
      loadOrdensServico();
    }
  }, [isTecnico]);

  const loadOrdensServico = async () => {
    try {
      setLoading(true);

      // Primeiro, buscar o ID do técnico baseado no profile_id
      const { data: tecnicoData, error: tecnicoError } = await supabase
        .from("tecnicos")
        .select("id")
        .eq("profile_id", profile?.id)
        .single();

      if (tecnicoError) throw tecnicoError;

      // Buscar ordens de serviço do técnico
      const { data: osData, error: osError } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          tickets (
            numero_ticket,
            titulo,
            endereco_servico,
            prioridade,
            clientes (
              empresa
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

      // Extrair o path do arquivo da URL
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minhas Ordens de Serviço</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie suas ordens de serviço atribuídas
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ordensServico.map((os) => (
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
                  <Badge variant={getPrioridadeColor(os.tickets.prioridade)}>
                    {os.tickets.prioridade}
                  </Badge>
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
                      Emitida em: {format(new Date(os.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
                </div>

                <Button
                  onClick={() => handleVerOS(os)}
                  className="w-full"
                  disabled={!os.pdf_url}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver OS em PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MinhasOS;
