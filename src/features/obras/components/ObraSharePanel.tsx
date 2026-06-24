import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Trash2, ShieldOff, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useObraActiveShareToken, useObraShareMutations, buildObraPublicUrl } from '../hooks/useObraShare';

interface Props { obraId: string }

export function ObraSharePanel({ obraId }: Props) {
  const tokenQ = useObraActiveShareToken(obraId);
  const { generate, revoke } = useObraShareMutations(obraId);

  const active = tokenQ.data;
  const publicUrl = active ? buildObraPublicUrl(active.token) : '';

  const handleGenerate = async () => {
    try {
      const created = await generate.mutateAsync();
      const url = buildObraPublicUrl(created.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link público gerado e copiado!');
      } catch {
        toast.success('Link público gerado.');
      }
    } catch (e: any) {
      toast.error('Não foi possível gerar o link', { description: e?.message });
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar — copie manualmente.');
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Revogar o link público? Quem tiver o link atual perderá o acesso.')) return;
    try {
      await revoke.mutateAsync();
      toast.success('Link revogado.');
    } catch (e: any) {
      toast.error('Não foi possível revogar', { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Link público de visualização
          {active && <Badge variant="outline" className="ml-2">Ativo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Compartilhe esta página de avanço da obra com o cliente sem exigir cadastro.
          O acesso é somente leitura e pode ser revogado a qualquer momento.
        </p>

        {tokenQ.isLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : active ? (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button onClick={handleCopy} variant="secondary" className="min-h-11">
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} variant="outline" disabled={generate.isPending} className="min-h-11">
                {generate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Gerar novo link
              </Button>
              <Button onClick={handleRevoke} variant="destructive" disabled={revoke.isPending} className="min-h-11">
                {revoke.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldOff className="h-4 w-4 mr-1" />}
                Revogar link
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleGenerate} disabled={generate.isPending} className="min-h-11">
            {generate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
            Gerar link público
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
