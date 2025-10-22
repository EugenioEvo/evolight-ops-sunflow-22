import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Bell, Shield, User, Database } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Configuracoes = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    rme: true,
    os: true,
  });

  const handleSave = () => {
    toast({
      title: "Configurações salvas",
      description: "Suas preferências foram atualizadas com sucesso.",
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
          Configurações
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid gap-6">
        {/* Perfil do Usuário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil do Usuário
            </CardTitle>
            <CardDescription>
              Informações básicas da sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input 
                id="name" 
                defaultValue={profile?.nome || ""} 
                disabled 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                defaultValue={profile?.email || ""} 
                disabled 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input 
                id="phone" 
                defaultValue={profile?.telefone || ""} 
                disabled 
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Para alterar suas informações, entre em contato com o administrador.
            </p>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure como você deseja receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notif">Notificações por Email</Label>
                <p className="text-sm text-muted-foreground">
                  Receba atualizações por email
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={notifications.email}
                onCheckedChange={(checked) => 
                  setNotifications({ ...notifications, email: checked })
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notif">Notificações Push</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações em tempo real
                </p>
              </div>
              <Switch
                id="push-notif"
                checked={notifications.push}
                onCheckedChange={(checked) => 
                  setNotifications({ ...notifications, push: checked })
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rme-notif">Notificações de RME</Label>
                <p className="text-sm text-muted-foreground">
                  Alertas sobre aprovações de RME
                </p>
              </div>
              <Switch
                id="rme-notif"
                checked={notifications.rme}
                onCheckedChange={(checked) => 
                  setNotifications({ ...notifications, rme: checked })
                }
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="os-notif">Notificações de OS</Label>
                <p className="text-sm text-muted-foreground">
                  Alertas sobre ordens de serviço
                </p>
              </div>
              <Switch
                id="os-notif"
                checked={notifications.os}
                onCheckedChange={(checked) => 
                  setNotifications({ ...notifications, os: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Configurações de segurança da conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Alterar Senha</Label>
              <p className="text-sm text-muted-foreground">
                Para alterar sua senha, você será redirecionado para o fluxo de recuperação de senha.
              </p>
              <Button variant="outline" className="w-full sm:w-auto">
                Solicitar Alteração de Senha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sistema */}
        {(profile?.role === 'admin' || profile?.role === 'area_tecnica') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sistema
              </CardTitle>
              <CardDescription>
                Configurações gerais do sistema (Apenas Administradores)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Input 
                  id="timezone" 
                  defaultValue="America/Sao_Paulo" 
                  disabled 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">Idioma</Label>
                <Input 
                  id="language" 
                  defaultValue="Português (Brasil)" 
                  disabled 
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Configurações avançadas do sistema estão disponíveis apenas para super administradores.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
