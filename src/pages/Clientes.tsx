import React from 'react';
import { Pencil, Trash2, Building2, Phone, Mail, MapPin, FileText, Plus, Search, Edit, Upload, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { useClientData } from '@/features/clients/hooks/useClientData';
import { useClientMutations } from '@/features/clients/hooks/useClientMutations';
import { ESTADOS_BR } from '@/features/clients/types';
import { SyncClientesButton } from '@/features/clients/components/SyncClientesButton';

export default function Clientes() {
  const { loading, searchTerm, setSearchTerm, filteredClientes, fetchClientes } = useClientData();
  const { form, isDialogOpen, setIsDialogOpen, editingClient, setEditingClient, onSubmit, handleEdit, handleDelete } = useClientMutations(fetchClientes);
  const [isImportOpen, setIsImportOpen] = React.useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes da empresa</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SyncClientesButton onSyncComplete={fetchClientes} />
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />Importar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-solar shadow-solar"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  {editingClient ? 'Atualize as informações do cliente abaixo.' : 'Preencha os dados para cadastrar um novo cliente.'}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="empresa" render={({ field }) => (
                      <FormItem><FormLabel>Nome da Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cnpj_cpf" render={({ field }) => (
                      <FormItem><FormLabel>CNPJ/CPF</FormLabel><FormControl>
                        <Input {...field} placeholder="00.000.000/0000-00" onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 11) { value = value.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
                          else { value = value.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); }
                          field.onChange(value);
                        }} />
                      </FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input type="email" placeholder="cliente@email.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="telefone" render={({ field }) => (
                      <FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl>
                        <Input {...field} placeholder="(00) 00000-0000" maxLength={15} onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          value = value.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
                          field.onChange(value);
                        }} />
                      </FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="endereco" render={({ field }) => (
                    <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="cidade" render={({ field }) => (
                      <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="estado" render={({ field }) => (
                      <FormItem><FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>{ESTADOS_BR.map(estado => <SelectItem key={estado} value={estado}>{estado}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cep" render={({ field }) => (
                      <FormItem><FormLabel>CEP</FormLabel><FormControl>
                        <Input {...field} placeholder="00000-000" maxLength={9} onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          value = value.replace(/^(\d{5})(\d)/, '$1-$2');
                          field.onChange(value);
                        }} />
                      </FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="ufv_solarz" render={({ field }) => (
                      <FormItem><FormLabel>UFV/SolarZ (Opcional)</FormLabel><FormControl><Input {...field} placeholder="Identificador da usina ou projeto" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="prioridade" render={({ field }) => (
                      <FormItem><FormLabel>Prioridade</FormLabel><FormControl>
                        <Input type="number" min={0} {...field} value={field.value ?? 5} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 5)} placeholder="Quanto menor, maior a prioridade" />
                      </FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="observacoes" render={({ field }) => (
                    <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="bg-gradient-solar">{editingClient ? "Atualizar" : "Salvar"}</Button>
                    <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingClient(null); form.reset(); }}>Cancelar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <BulkImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImportComplete={fetchClientes} />

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar clientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Badge variant="outline" className="text-sm">{filteredClientes.length} cliente(s)</Badge>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando clientes...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredClientes.map((cliente) => (
              <Card key={cliente.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="font-medium text-foreground">{cliente.empresa}</span>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                          <Star className="h-3 w-3" />P{cliente.prioridade ?? 5}
                        </Badge>
                        {cliente.ufv_solarz && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">UFV/SolarZ: {cliente.ufv_solarz}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /><span>CNPJ/CPF: {cliente.cnpj_cpf}</span></div>
                          <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{cliente.endereco}</span></div>
                          <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">📍</span><span>{cliente.cidade}, {cliente.estado} - {cliente.cep}</span></div>
                          {cliente.profile && (
                            <>
                              <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{cliente.profile.email}</span></div>
                              {cliente.profile.telefone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{cliente.profile.telefone}</span></div>}
                            </>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Badge variant={cliente.status === 'ativo' ? 'default' : 'secondary'} className="text-xs">{cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(cliente.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
