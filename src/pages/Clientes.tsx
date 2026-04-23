import { Building2, Search, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pagination } from '@/components/Pagination';
import { useClientData } from '@/features/clients/hooks/useClientData';
import { useClientMutations } from '@/features/clients/hooks/useClientMutations';
import { SyncClientesButton } from '@/features/clients/components/SyncClientesButton';
import { ClientCard } from '@/features/clients/components/ClientCard';
import { ClientDetailsDialog } from '@/features/clients/components/ClientDetailsDialog';

export default function Clientes() {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    clientes,
    page,
    setPage,
    pageSize,
    totalCount,
    totalPages,
    includeInactive,
    setIncludeInactive,
    refetch,
  } = useClientData();

  const {
    form,
    saving,
    isDialogOpen,
    setIsDialogOpen,
    editingClient,
    openClient,
    closeDialog,
    onSubmit,
  } = useClientMutations(refetch);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Clientes</h1>
          <p className="text-muted-foreground">
            Carteira sincronizada do Solarz e Conta Azul. Novos cadastros são feitos
            diretamente nesses sistemas.
          </p>
        </div>
        <SyncClientesButton onSyncComplete={refetch} />
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, CNPJ, cidade ou ID Solarz..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
          />
          <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
            Mostrar removidos
          </Label>
        </div>
        <Badge variant="outline" className="text-sm flex items-center gap-1">
          <Star className="h-3 w-3" />
          {totalCount.toLocaleString('pt-BR')} cliente(s)
        </Badge>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p>Carregando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-base">Nenhum cliente encontrado</p>
              <p className="text-xs mt-2">
                Ajuste a busca ou rode a sincronização com Solarz/Conta Azul.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clientes.map((cliente) => (
              <ClientCard key={cliente.id} cliente={cliente} onOpen={() => openClient(cliente)} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalCount}
          itemsPerPage={pageSize}
        />
      </div>

      <ClientDetailsDialog
        open={isDialogOpen}
        onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeDialog())}
        cliente={editingClient}
        form={form}
        saving={saving}
        onSubmit={onSubmit}
      />
    </div>
  );
}
