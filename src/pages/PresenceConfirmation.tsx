import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Sun, Calendar, User, FileText, Download, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import html2canvas from 'html2canvas';

interface OSDetails {
  numeroOS?: string;
  servico?: string;
  data?: string;
  tecnico?: string;
}

const PresenceConfirmation = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [osDetails, setOsDetails] = useState<OSDetails>({});
  const [confirmedAt] = useState(() => new Date().toLocaleString('pt-BR'));
  const receiptRef = useRef<HTMLDivElement>(null);

  const token = searchParams.get('token') || '';
  const verificationCode = token.slice(-8).toUpperCase();

  useEffect(() => {
    const osId = searchParams.get('os_id');

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

        const extractField = (label: string) => {
          const match = html.match(new RegExp(`<strong>${label}:<\\/strong>\\s*(.+?)\\s*<\\/p>`));
          return match?.[1]?.trim();
        };

        const details: OSDetails = {
          numeroOS: extractField('OS'),
          servico: extractField('Serviço'),
          data: extractField('Data'),
          tecnico: extractField('Técnico'),
        };
        setOsDetails(details);

        if (response.ok && html.includes('Presença Confirmada')) {
          setStatus('success');
          setMessage('Sua presença foi confirmada com sucesso! A equipe foi notificada.');
        } else if (html.includes('já confirmada') || html.includes('já teve a presença')) {
          setStatus('already');
          setMessage('Esta ordem de serviço já teve a presença confirmada anteriormente.');
        } else {
          setStatus('error');
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
  }, [searchParams, token]);

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `recibo-${osDetails.numeroOS || 'presenca'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Erro ao gerar recibo:', err);
    }
  };

  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `recibo-${osDetails.numeroOS || 'presenca'}.png`, { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({
            title: 'Comprovante de Presença',
            text: `Presença confirmada - OS ${osDetails.numeroOS || ''}`,
            files: [file],
          });
        }
      }, 'image/png');
    } catch (err) {
      console.error('Erro ao compartilhar recibo:', err);
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-solar">
      {/* Header */}
      <header className="flex items-center justify-center gap-2 pt-8 pb-4">
        <Sun className="h-8 w-8 text-primary-foreground" />
        <span className="text-2xl font-bold text-primary-foreground tracking-tight">
          SunFlow
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <Card className="max-w-md w-full shadow-solar border-0 animate-fade-in">
          <CardContent className="p-8 text-center space-y-5">
            {status === 'loading' && (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-5">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-foreground">Processando...</h1>
                <p className="text-muted-foreground text-sm">Confirmando sua presença na ordem de serviço</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-success/10 p-5 animate-fade-in">
                    <CheckCircle className="h-12 w-12 text-success" />
                  </div>
                </div>
                <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
                  Confirmado
                </Badge>
                <h1 className="text-xl font-bold text-foreground">Presença Confirmada!</h1>
                <p className="text-muted-foreground text-sm">{message}</p>

                {(osDetails.numeroOS || osDetails.data || osDetails.tecnico) && (
                  <div className="bg-muted rounded-lg p-4 text-left space-y-2.5 mt-2 border border-border">
                    {osDetails.numeroOS && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">OS:</span>
                        <span className="font-medium text-foreground">{osDetails.numeroOS}</span>
                      </div>
                    )}
                    {osDetails.servico && (
                      <div className="flex items-center gap-2 text-sm">
                        <Sun className="h-4 w-4 text-secondary shrink-0" />
                        <span className="text-muted-foreground">Serviço:</span>
                        <span className="font-medium text-foreground">{osDetails.servico}</span>
                      </div>
                    )}
                    {osDetails.data && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">Data:</span>
                        <span className="font-medium text-foreground">{osDetails.data}</span>
                      </div>
                    )}
                    {osDetails.tecnico && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-success shrink-0" />
                        <span className="text-muted-foreground">Técnico:</span>
                        <span className="font-medium text-foreground">{osDetails.tecnico}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleDownloadReceipt} className="flex-1 gap-2" variant="default">
                    <Download className="h-4 w-4" />
                    Baixar Comprovante
                  </Button>
                  {canShare && (
                    <Button onClick={handleShareReceipt} variant="outline" className="gap-2">
                      <Share2 className="h-4 w-4" />
                      Compartilhar
                    </Button>
                  )}
                </div>
              </>
            )}

            {status === 'already' && (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-secondary/10 p-5 animate-fade-in">
                    <CheckCircle className="h-12 w-12 text-secondary" />
                  </div>
                </div>
                <Badge className="bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/20">
                  Já confirmado
                </Badge>
                <h1 className="text-xl font-bold text-foreground">Presença já registrada</h1>
                <p className="text-muted-foreground text-sm">{message}</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center">
                  <div className="rounded-full bg-destructive/10 p-5 animate-fade-in">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                </div>
                <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
                  Erro
                </Badge>
                <h1 className="text-xl font-bold text-foreground">Erro na Confirmação</h1>
                <p className="text-muted-foreground text-sm">{message}</p>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Hidden receipt for capture */}
      {status === 'success' && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div
            ref={receiptRef}
            style={{
              width: 400,
              padding: 32,
              backgroundColor: '#ffffff',
              fontFamily: 'Arial, sans-serif',
              color: '#1a2a3a',
            }}
          >
            {/* Receipt header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0066FF', marginBottom: 4 }}>
                ☀ SunFlow
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#555' }}>
                Comprovante de Presença
              </div>
              <div style={{ height: 2, background: 'linear-gradient(90deg, #0066FF, #FF9900)', margin: '12px 0' }} />
            </div>

            {/* Receipt details */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16, borderLeft: '4px solid #0066FF' }}>
              {osDetails.numeroOS && (
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: '#777' }}>OS: </span>
                  <strong>{osDetails.numeroOS}</strong>
                </div>
              )}
              {osDetails.servico && (
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: '#777' }}>Serviço: </span>
                  <strong>{osDetails.servico}</strong>
                </div>
              )}
              {osDetails.data && (
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: '#777' }}>Data: </span>
                  <strong>{osDetails.data}</strong>
                </div>
              )}
              {osDetails.tecnico && (
                <div style={{ fontSize: 14, marginBottom: 0 }}>
                  <span style={{ color: '#777' }}>Técnico: </span>
                  <strong>{osDetails.tecnico}</strong>
                </div>
              )}
            </div>

            {/* Confirmation stamp */}
            <div style={{ textAlign: 'center', background: '#f0fdf4', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>
                Presença confirmada
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                em {confirmedAt}
              </div>
            </div>

            {/* Verification code */}
            {verificationCode && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: '#999' }}>Código de verificação: </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0066FF', letterSpacing: 2 }}>
                  {verificationCode}
                </span>
              </div>
            )}

            {/* Footer */}
            <div style={{ height: 2, background: 'linear-gradient(90deg, #0066FF, #FF9900)', margin: '12px 0' }} />
            <div style={{ textAlign: 'center', fontSize: 11, color: '#999' }}>
              Evolight Solar O&M
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center pb-6">
        <p className="text-xs text-primary-foreground/70">
          Powered by <span className="font-semibold">SunFlow</span> · Evolight Solar O&M
        </p>
      </footer>
    </div>
  );
};

export default PresenceConfirmation;
