import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Save, Loader2, Plus, X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkOrderCreate } from "@/features/work-orders";

const workOrderSchema = z.object({
  data_programada: z.date({ required_error: "Data obrigatória" }),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),
  cliente_id: z.string().min(1, "Selecione um cliente"),
  site_name: z.string().min(1, "Nome da usina obrigatório"),
  servico_solicitado: z.string().min(1, "Tipo de serviço obrigatório"),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  inspetor_responsavel: z.string().min(1, "Responsável obrigatório"),
  notes: z.string().optional(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

const serviceTypes = [
  { value: "preventiva", label: "Preventiva" }, { value: "corretiva", label: "Corretiva" },
  { value: "emergencia", label: "Emergência" }, { value: "limpeza", label: "Limpeza" },
  { value: "eletrica", label: "Elétrica" }, { value: "internet", label: "Internet" },
  { value: "outros", label: "Outros" },
];

const workTypes = [
  { value: "limpeza", label: "Limpeza" }, { value: "eletrica", label: "Elétrica" }, { value: "internet", label: "Internet" },
];

const WorkOrderCreate = () => {
  const {
    loading, clientes, selectedWorkTypes, teamMembers, newMember, setNewMember,
    ufvSolarzList, addTeamMember, removeTeamMember, toggleWorkType, submitWorkOrder, navigate,
  } = useWorkOrderCreate();

  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      data_programada: new Date(), hora_inicio: "08:00", hora_fim: "17:00",
      cliente_id: "", site_name: "", servico_solicitado: "", descricao: "", inspetor_responsavel: "", notes: "",
    },
  });

  const handleUfvSolarzChange = (ufvSolarz: string) => {
    form.setValue("site_name", ufvSolarz);
    const cliente = clientes.find(c => c.ufv_solarz === ufvSolarz);
    if (cliente) form.setValue("cliente_id", cliente.id);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1><p className="text-muted-foreground">Preencha os dados para criar uma nova OS</p></div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submitWorkOrder)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Informações Gerais</CardTitle><CardDescription>Data, cliente e localização</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="data_programada" render={({ field }) => (
                  <FormItem><FormLabel>Data Programada *</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-12", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} /></PopoverContent>
                    </Popover><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-2">
                  <FormField control={form.control} name="hora_inicio" render={({ field }) => (
                    <FormItem><FormLabel>Hora Início</FormLabel><FormControl><Input type="time" {...field} className="h-12" /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="hora_fim" render={({ field }) => (
                    <FormItem><FormLabel>Hora Fim</FormLabel><FormControl><Input type="time" {...field} className="h-12" /></FormControl></FormItem>
                  )} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="site_name" render={({ field }) => (
                  <FormItem><FormLabel>UFV/SolarZ *</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); handleUfvSolarzChange(v); }} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Selecione a UFV/SolarZ" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ufvSolarzList.length === 0 && <SelectItem value="__loading" disabled>Carregando...</SelectItem>}
                        {ufvSolarzList.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cliente_id" render={({ field }) => (
                  <FormItem><FormLabel>Cliente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clientes.length === 0 && <SelectItem value="__loading" disabled>Carregando...</SelectItem>}
                        {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.empresa}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Descrição do Serviço</CardTitle><CardDescription>Tipo e detalhes do trabalho</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="servico_solicitado" render={({ field }) => (
                <FormItem><FormLabel>Serviço Solicitado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                    <SelectContent>{serviceTypes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <FormLabel>Tipo de Trabalho *</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {workTypes.map(wt => (
                    <label key={wt.value} className={cn("flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all", selectedWorkTypes.includes(wt.value) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                      <Checkbox checked={selectedWorkTypes.includes(wt.value)} onCheckedChange={() => toggleWorkType(wt.value)} />
                      <span className="font-medium">{wt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <FormField control={form.control} name="descricao" render={({ field }) => (
                <FormItem><FormLabel>Descrição Detalhada *</FormLabel><FormControl><Textarea {...field} placeholder="Descreva detalhadamente o serviço..." className="min-h-[120px] resize-none" /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Equipe Responsável</CardTitle><CardDescription>Responsável e membros da equipe</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="inspetor_responsavel" render={({ field }) => (
                <FormItem><FormLabel>Inspetor Responsável *</FormLabel><FormControl><Input {...field} placeholder="Nome do responsável" className="h-12" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <FormLabel>Membros da Equipe</FormLabel>
                <div className="flex gap-2">
                  <Input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="Nome do membro" className="h-12"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTeamMember(); } }} />
                  <Button type="button" onClick={addTeamMember} size="icon" className="h-12 w-12"><Plus className="h-5 w-5" /></Button>
                </div>
                {teamMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {teamMembers.map(m => (
                      <Badge key={m} variant="secondary" className="py-1.5 px-3">{m}
                        <button type="button" onClick={() => removeTeamMember(m)} className="ml-2 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} placeholder="Observações adicionais..." className="min-h-[80px] resize-none" /></FormControl></FormItem>
              )} />
            </CardContent>
          </Card>
        </form>
      </Form>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 h-12" onClick={() => navigate("/work-orders")}>Cancelar</Button>
          <Button className="flex-1 h-12" onClick={form.handleSubmit(submitWorkOrder)} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Criar OS</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderCreate;
