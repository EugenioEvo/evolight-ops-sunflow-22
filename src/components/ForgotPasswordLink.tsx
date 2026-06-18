import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const ForgotPasswordLink = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('client-password-recovery', {
        body: {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });

      if (error) throw error;

      // E-mail não existe nem em auth nem em clientes → encaminha p/ cadastro de prestador
      if (data && (data as { notFound?: boolean }).notFound) {
        toast({
          title: 'E-mail não cadastrado',
          description:
            'Não encontramos este e-mail. Você será redirecionado para o cadastro de prestador.',
        });
        setOpen(false);
        setTimeout(() => navigate('/candidatar-se'), 800);
        return;
      }

      setSent(true);
      toast({
        title: 'Solicitação recebida',
        description:
          'Se este e-mail estiver cadastrado, enviaremos instruções em instantes. Verifique sua caixa de entrada (e o spam).',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar e-mail';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSent(false); setEmail(''); } }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline w-full text-center mt-2"
        >
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recuperar Senha</DialogTitle>
          <DialogDescription>
            {sent
              ? 'Um e-mail com instruções foi enviado. Verifique sua caixa de entrada.'
              : 'Informe seu e-mail para receber um link de redefinição de senha.'}
          </DialogDescription>
        </DialogHeader>
        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
          </form>
        ) : (
          <Button className="w-full" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
