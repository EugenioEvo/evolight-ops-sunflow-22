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

    // Redirecionar para o edge function
    const baseUrl = window.location.origin;
    const confirmUrl = `${baseUrl}/supabase/functions/v1/confirm-presence?os_id=${osId}&token=${token}`;
    
    window.location.href = confirmUrl;
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h1 className="text-2xl font-bold mb-2">Processando...</h1>
            <p className="text-muted-foreground">
              Redirecionando para confirmação de presença
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-8 text-center">
          {status === 'success' ? (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h1 className="text-2xl font-bold mb-2 text-green-700">
                Presença Confirmada!
              </h1>
            </>
          ) : (
            <>
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
              <h1 className="text-2xl font-bold mb-2 text-red-700">
                Erro na Confirmação
              </h1>
            </>
          )}
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresenceConfirmation;
