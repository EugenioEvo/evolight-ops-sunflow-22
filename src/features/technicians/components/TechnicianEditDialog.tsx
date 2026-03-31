import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Tecnico } from "../types";

interface TechnicianEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnico: Tecnico | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const TechnicianEditDialog = ({ open, onOpenChange, tecnico, onSubmit }: TechnicianEditDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar Técnico</DialogTitle>
      </DialogHeader>
      {tecnico && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={tecnico.profiles.nome} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="especialidades">Especialidades (separadas por vírgula)</Label>
            <Input
              id="especialidades"
              name="especialidades"
              defaultValue={tecnico.especialidades?.join(", ")}
              placeholder="Ex: Elétrica, Hidráulica, HVAC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regiao_atuacao">Região de Atuação</Label>
            <Input
              id="regiao_atuacao"
              name="regiao_atuacao"
              defaultValue={tecnico.regiao_atuacao}
              placeholder="Ex: São Paulo - Zona Sul"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registro_profissional">Registro Profissional</Label>
            <Input
              id="registro_profissional"
              name="registro_profissional"
              defaultValue={tecnico.registro_profissional}
              placeholder="Ex: CREA 123456"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      )}
    </DialogContent>
  </Dialog>
);
