import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';

const PendingApproval = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto p-4 rounded-full bg-amber-100 dark:bg-amber-900/30 w-fit mb-4">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Olá <span className="font-medium text-foreground">{profile?.nome}</span>, seu cadastro foi recebido e está aguardando aprovação de um administrador.
          </p>
          <p className="text-sm text-muted-foreground">
            Você receberá acesso ao sistema assim que seu cadastro for aprovado. Isso pode levar algumas horas.
          </p>
          <Button variant="outline" onClick={signOut} className="mt-6">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
