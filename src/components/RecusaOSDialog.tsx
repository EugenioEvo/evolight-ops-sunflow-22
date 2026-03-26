import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle } from "lucide-react";

interface RecusaOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => Promise<void>;
  numeroOS: string;
  loading?: boolean;
}

export const RecusaOSDialog = ({
  open,
  onOpenChange,
  onConfirm,
  numeroOS,
  loading,
}: RecusaOSDialogProps) => {
  const [motivo, setMotivo] = useState("");

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    await onConfirm(motivo.trim());
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Recusar OS {numeroOS}
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da recusa. A equipe de gestão será notificada e poderá reagendar ou reatribuir a OS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da recusa *</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Conflito de agenda, distância inviável, falta de equipamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!motivo.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recusando...
              </>
            ) : (
              "Confirmar Recusa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
