import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface ApprovePrestadorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prestador: { id: string; nome: string; email: string; categoria: string } | null;
  onApproved: () => void;
}

type ApproveRole = 'tecnico_campo' | 'supervisao' | 'eletromecanico' | 'sup_eletromecanico';

const CATEGORIA_TO_ROLE: Record<string, ApproveRole> = {
  tecnico: 'tecnico_campo',
  supervisao: 'supervisao',
  eletromecanico: 'eletromecanico',
  sup_eletromecanico: 'sup_eletromecanico',
};

export const ApprovePrestadorDialog = ({ open, onOpenChange, prestador, onApproved }: ApprovePrestadorDialogProps) => {
  const defaultRole: ApproveRole = CATEGORIA_TO_ROLE[prestador?.categoria ?? ''] ?? 'tecnico_campo';
  const [role, setRole] = useState<ApproveRole>(defaultRole);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!prestador) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('approve-prestador', {
        body: {
          prestador_id: prestador.id,
          role,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      toast.success(data?.message || 'Prestador aprovado com sucesso.');
      onApproved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao aprovar prestador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar prestador</DialogTitle>
          <DialogDescription>
            Vamos criar uma conta de acesso para <strong>{prestador?.nome}</strong> e enviar um convite para
            <span className="inline-flex items-center gap-1 mx-1"><Mail className="h-3 w-3" /><strong>{prestador?.email}</strong></span>
            definir a senha.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <Label>Atribuir papel no sistema</Label>
          <RadioGroup value={role} onValueChange={v => setRole(v as ApproveRole)}>
            <div className="flex items-center space-x-3 p-3 rounded-lg border min-h-[44px]">
              <RadioGroupItem value="tecnico_campo" id="r-tec" />
              <Label htmlFor="r-tec" className="flex-1 cursor-pointer">
                <div className="font-medium">Técnico de Campo (O&amp;M)</div>
                <div className="text-xs text-muted-foreground">Recebe OS, executa serviço, preenche RME.</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border min-h-[44px]">
              <RadioGroupItem value="supervisao" id="r-sup" />
              <Label htmlFor="r-sup" className="flex-1 cursor-pointer">
                <div className="font-medium">Supervisor (O&amp;M)</div>
                <div className="text-xs text-muted-foreground">Acesso completo: aprova RMEs, gerencia tickets, OS, agenda.</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border min-h-[44px]">
              <RadioGroupItem value="eletromecanico" id="r-ele" />
              <Label htmlFor="r-ele" className="flex-1 cursor-pointer">
                <div className="font-medium">Eletromecânico (EPC)</div>
                <div className="text-xs text-muted-foreground">Visualiza RDOs em que aparece como equipe.</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border min-h-[44px]">
              <RadioGroupItem value="sup_eletromecanico" id="r-sup-ele" />
              <Label htmlFor="r-sup-ele" className="flex-1 cursor-pointer">
                <div className="font-medium">Sup. Eletromecânico (EPC)</div>
                <div className="text-xs text-muted-foreground">Cria/edita RDOs e gerencia equipe da obra.</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aprovar e enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
