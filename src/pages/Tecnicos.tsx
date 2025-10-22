import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, UserX, MapPin, Award } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
}

interface Tecnico {
  id: string;
  profile_id: string;
  especialidades: string[];
  regiao_atuacao: string;
  registro_profissional: string;
  profiles: Profile;
}

const Tecnicos = () => {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  const isAdmin = profile?.role === "admin" || profile?.role === "area_tecnica";

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar técnicos
      const { data: tecnicosData, error: tecnicosError } = await supabase
        .from("tecnicos")
        .select(`
          *,
          profiles:profile_id (
            id,
            nome,
            email,
            telefone,
            ativo
          )
        `)
        .order("created_at", { ascending: false });

      if (tecnicosError) throw tecnicosError;

      setTecnicos(tecnicosData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTecnico = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTecnico) return;

    const formData = new FormData(e.currentTarget);
    const especialidades = formData
      .get("especialidades")
      ?.toString()
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    try {
      const { error } = await supabase
        .from("tecnicos")
        .update({
          especialidades,
          regiao_atuacao: formData.get("regiao_atuacao")?.toString(),
          registro_profissional: formData.get("registro_profissional")?.toString(),
        })
        .eq("id", selectedTecnico.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Técnico atualizado com sucesso",
      });

      setEditDialogOpen(false);
      setSelectedTecnico(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar técnico",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (tecnico: Tecnico) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: !tecnico.profiles.ativo })
        .eq("id", tecnico.profile_id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Técnico ${tecnico.profiles.ativo ? "desativado" : "ativado"} com sucesso`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
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
        <h1 className="text-3xl font-bold">Técnicos de Campo</h1>
        <p className="text-muted-foreground">
          Gerencie os técnicos que podem ser atribuídos a tickets
        </p>
      </div>

      {tecnicos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Nenhum técnico cadastrado. Converta um usuário para técnico para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tecnicos.map((tecnico) => (
            <Card key={tecnico.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {tecnico.profiles.nome}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {tecnico.profiles.email}
                    </p>
                    {tecnico.profiles.telefone && (
                      <p className="text-sm text-muted-foreground">
                        {tecnico.profiles.telefone}
                      </p>
                    )}
                  </div>
                  <Badge variant={tecnico.profiles.ativo ? "default" : "secondary"}>
                    {tecnico.profiles.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {tecnico.regiao_atuacao && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{tecnico.regiao_atuacao}</span>
                  </div>
                )}

                {tecnico.registro_profissional && (
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span>{tecnico.registro_profissional}</span>
                  </div>
                )}

                {tecnico.especialidades && tecnico.especialidades.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Especialidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {tecnico.especialidades.map((esp, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {esp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTecnico(tecnico);
                      setEditDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant={tecnico.profiles.ativo ? "destructive" : "default"}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleActive(tecnico)}
                  >
                    {tecnico.profiles.ativo ? (
                      <>
                        <UserX className="h-4 w-4 mr-1" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Ativar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para editar técnico */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Técnico</DialogTitle>
          </DialogHeader>
          {selectedTecnico && (
            <form onSubmit={handleUpdateTecnico} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={selectedTecnico.profiles.nome} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="especialidades">
                  Especialidades (separadas por vírgula)
                </Label>
                <Input
                  id="especialidades"
                  name="especialidades"
                  defaultValue={selectedTecnico.especialidades?.join(", ")}
                  placeholder="Ex: Elétrica, Hidráulica, HVAC"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="regiao_atuacao">Região de Atuação</Label>
                <Input
                  id="regiao_atuacao"
                  name="regiao_atuacao"
                  defaultValue={selectedTecnico.regiao_atuacao}
                  placeholder="Ex: São Paulo - Zona Sul"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registro_profissional">Registro Profissional</Label>
                <Input
                  id="registro_profissional"
                  name="registro_profissional"
                  defaultValue={selectedTecnico.registro_profissional}
                  placeholder="Ex: CREA 123456"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tecnicos;
