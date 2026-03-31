import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  useTechnicianData,
  useTechnicianMutations,
  TechnicianCard,
  TechnicianEditDialog,
} from "@/features/technicians";

const Tecnicos = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "engenharia" || profile?.role === "supervisao";
  const { tecnicos, loading, reload } = useTechnicianData(isAdmin);
  const {
    editDialogOpen, setEditDialogOpen, selectedTecnico,
    handleEdit, handleUpdate, handleToggleActive,
  } = useTechnicianMutations(reload);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Técnicos de Campo</h1>
        <p className="text-muted-foreground">Gerencie os técnicos que podem ser atribuídos a tickets</p>
      </div>

      {tecnicos.length === 0 ? (
        <Card><CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Nenhum técnico cadastrado. Converta um usuário para técnico para começar.
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tecnicos.map((tecnico) => (
            <TechnicianCard
              key={tecnico.id}
              tecnico={tecnico}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      <TechnicianEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tecnico={selectedTecnico}
        onSubmit={handleUpdate}
      />
    </div>
  );
};

export default Tecnicos;
