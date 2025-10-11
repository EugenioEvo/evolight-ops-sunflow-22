import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const QRCodeScanner = ({ onScanSuccess, onClose }: QRCodeScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setScanning(true);
      setError('');

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          toast({
            title: 'QR Code detectado!',
            description: 'Processando informações...',
          });
          onScanSuccess(decodedText);
          stopScanner();
        },
        () => {
          // Error callback - silent failures during scan
        }
      );
    } catch (err: any) {
      console.error('Erro ao iniciar scanner:', err);
      setError('Erro ao acessar câmera. Verifique as permissões.');
      toast({
        title: 'Erro na câmera',
        description: 'Não foi possível acessar a câmera. Verifique as permissões do navegador.',
        variant: 'destructive',
      });
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (err) {
      console.error('Erro ao parar scanner:', err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear QR Code
            </CardTitle>
            <CardDescription>
              Aponte a câmera para o QR Code do equipamento
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          id="qr-reader"
          className="w-full rounded-lg overflow-hidden border-2 border-primary"
        />
        
        {scanning && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando QR Code...
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Permita o acesso à câmera quando solicitado pelo navegador
        </div>
      </CardContent>
    </Card>
  );
};
