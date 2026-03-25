import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const PresenceConfirmation = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const osId = searchParams.get('os_id');
    const token = searchParams.get('token');

    if (!osId || !token) {
      setStatus('error');
      setMessage('Parâmetros inválidos. Link de confirmação está incompleto.');
      return;
    }

    const confirmPresence = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const confirmUrl = `${supabaseUrl}/functions/v1/confirm-presence?os_id=${osId}&token=${token}`;
        
        const response = await fetch(confirmUrl);
        const html = await response.text();

        // The edge function returns HTML directly — render it
        if (response.ok && html.includes('Presença Confirmada')) {
          setStatus('success');
          setMessage('Sua presença foi confirmada com sucesso! A equipe foi notificada.');
        } else if (html.includes('já confirmada')) {
          setStatus('success');
          setMessage('Esta ordem de serviço já teve a presença confirmada anteriormente.');
        } else {
          setStatus('error');
          // Extract error message from HTML if possible
          const match = html.match(/<p class="message">(.*?)<\/p>/);
          setMessage(match?.[1] || 'Não foi possível confirmar a presença. O link pode ter expirado.');
        }
      } catch (error) {
        console.error('Erro ao confirmar presença:', error);
        setStatus('error');
        setMessage('Erro de conexão. Verifique sua internet e tente novamente.');
      }
    };

    confirmPresence();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <h1 className="text-2xl font-bold mb-2">Processando...</h1>
              <p className="text-muted-foreground">Confirmando sua presença</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h1 className="text-2xl font-bold mb-2 text-green-700">
                Presença Confirmada!
              </h1>
              <p className="text-muted-foreground">{message}</p>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-2xl font-bold mb-2 text-red-700">
                Erro na Confirmação
              </h1>
              <p className="text-muted-foreground">{message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PresenceConfirmation;
