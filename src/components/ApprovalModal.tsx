import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (observacoes?: string) => void;
  type: 'approve' | 'reject';
  loading?: boolean;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  open,
  onClose,
  onConfirm,
  type,
  loading = false,
}) => {
  const [observacoes, setObservacoes] = useState('');

  const handleConfirm = () => {
    onConfirm(observacoes);
    setObservacoes('');
  };

  const handleClose = () => {
    setObservacoes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'approve' ? 'Aprovar RME' : 'Rejeitar RME'}
          </DialogTitle>
          <DialogDescription>
            {type === 'approve'
              ? 'Confirma a aprovação deste relatório? Você pode adicionar observações.'
              : 'Informe o motivo da rejeição. Este campo é obrigatório.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="observacoes">
            {type === 'approve' ? 'Observações (opcional)' : 'Motivo da rejeição *'}
          </Label>
          <Textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder={
              type === 'approve'
                ? 'Adicione observações se necessário...'
                : 'Descreva o motivo da rejeição...'
            }
            rows={4}
            required={type === 'reject'}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (type === 'reject' && !observacoes.trim())}
            variant={type === 'approve' ? 'default' : 'destructive'}
          >
            {loading
              ? 'Processando...'
              : type === 'approve'
              ? 'Aprovar'
              : 'Rejeitar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
