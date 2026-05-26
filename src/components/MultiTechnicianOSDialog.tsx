import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTechnicianAvailability } from "@/hooks/useTechnicianAvailability";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { computeScheduleEnd, formatScheduledWindow } from "@/utils/scheduleWindow";

interface Prestador {
  id: string;
  nome: string;
  email: string;
}

interface ClienteOption {
  id: string;
  empresa: string | null;
  cnpj_cpf?: string | null;
  ufv_solarz: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
}

interface MultiTechnicianOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When undefined → standalone mode: dialog creates an implicit ticket. */
  ticketId?: string;
  ticket?: any;
  prestadores: Prestador[];
  /** Required when ticketId is undefined (standalone). */
  clientes?: ClienteOption[];
  /** IDs de prestadores já alocados (modo "adicionar técnicos"): aparecem marcados e desabilitados. */
  alreadyAssignedPrestadorIds?: string[];
  /** Força o modo de adicionar/trocar responsável mesmo se a lista de alocados ainda estiver vazia por falha de mapeamento. */
  addMode?: boolean;
  onSuccess?: () => void;
}

export const MultiTechnicianOSDialog = ({
  open,
  onOpenChange,
  ticketId,
  ticket,
  prestadores,
  clientes = [],
  alreadyAssignedPrestadorIds = [],
  addMode = false,
  onSuccess,
}: MultiTechnicianOSDialogProps) => {
  const { user } = useAuth();
  const isStandalone = !ticketId;
  const isAddMode = addMode || alreadyAssignedPrestadorIds.length > 0;
  const assignedPrestadorIds = useMemo(() => {
    if (!isAddMode) return alreadyAssignedPrestadorIds;
    return Array.from(new Set([
      ...alreadyAssignedPrestadorIds,
      ticket?.tecnico_responsavel_id,
    ].filter(Boolean))) as string[];
  }, [alreadyAssignedPrestadorIds, isAddMode, ticket?.tecnico_responsavel_id]);

  const [loading, setLoading] = useState(false);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [selectedPrestadores, setSelectedPrestadores] = useState<string[]>([]);
  const [tecnicoResponsavelId, setTecnicoResponsavelId] = useState<string>("");
  const [initialTecnicoResponsavelId, setInitialTecnicoResponsavelId] = useState<string>("");
  /** Horas previstas POR técnico (sempre por técnico — usado pelo BI Carga de Trabalho) */
  const [horasPorTecnico, setHorasPorTecnico] = useState<Record<string, number>>({});
  /** Horas iniciais carregadas das OS existentes (add-mode) — base para detectar mudanças. */
  const [initialHorasPorTecnico, setInitialHorasPorTecnico] = useState<Record<string, number>>({});
  /** Mapa prestadorId → id da OS existente (add-mode), para updates. */
  const [osIdPorPrestador, setOsIdPorPrestador] = useState<Record<string, string>>({});
  const DESCRICAO_HINT = "Situação da planta (kwp, qtd de módulos, potência) e descrição dos serviços a serem realizados.";
  const [formData, setFormData] = useState({
    descricao_servicos: DESCRICAO_HINT,
    tipo_trabalho: [] as string[],
  });

  // Standalone-only fields (implicit ticket creation)
  const [standaloneData, setStandaloneData] = useState({
    cliente_id: "",
    endereco_servico: "",
    data_servico: new Date().toISOString().slice(0, 10),
    horario_previsto_inicio: "08:00",
  });

  const { availabilityMap, checkAvailability, loading: checkingAvailability } = useTechnicianAvailability();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedPrestadores([]);
      setTecnicoResponsavelId("");
      setInitialTecnicoResponsavelId("");
      setHorasPorTecnico({});
      setInitialHorasPorTecnico({});
      setOsIdPorPrestador({});
      setFormData({ descricao_servicos: DESCRICAO_HINT, tipo_trabalho: [] });
      setStandaloneData({
        cliente_id: "",
        endereco_servico: "",
        data_servico: new Date().toISOString().slice(0, 10),
        horario_previsto_inicio: "08:00",
      });
    }
  }, [open]);

  // Pre-select assigned tech (ticket-based mode) — runs only when the dialog
  // transitions from closed → open. Avoids resetting user's choice on every
  // re-render when parent re-creates the alreadyAssignedPrestadorIds array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && !isStandalone) {
      if (isAddMode) {
        const initialResponsavel = ticket?.tecnico_responsavel_id || assignedPrestadorIds[0] || "";
        setSelectedPrestadores([...assignedPrestadorIds]);
        setTecnicoResponsavelId(initialResponsavel);
        setInitialTecnicoResponsavelId(initialResponsavel);
      } else if (ticket?.tecnico_responsavel_id) {
        setSelectedPrestadores([ticket.tecnico_responsavel_id]);
        setTecnicoResponsavelId(ticket.tecnico_responsavel_id);
        setInitialTecnicoResponsavelId(ticket.tecnico_responsavel_id);
      }
    }
  }, [open]);

  // Pre-fill description from ticket when dialog opens
  useEffect(() => {
    if (open && ticket?.descricao) {
      setFormData(prev => ({ ...prev, descricao_servicos: ticket.descricao }));
    }
  }, [open, ticket?.descricao]);

  // Add-mode: carregar horas previstas atuais (duracao_estimada_min) das OS já existentes
  // do ticket, mapeando por prestador_id, para permitir edição/recálculo.
  useEffect(() => {
    if (!open || isStandalone || !isAddMode || !ticketId) return;
    (async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, duracao_estimada_min, tecnicos!inner(prestador_id)')
        .eq('ticket_id', ticketId);
      if (error || !data) return;
      const horas: Record<string, number> = {};
      const osMap: Record<string, string> = {};
      for (const os of data as any[]) {
        const pid = os.tecnicos?.prestador_id;
        if (!pid) continue;
        const h = os.duracao_estimada_min ? os.duracao_estimada_min / 60 : 1;
        horas[pid] = h;
        osMap[pid] = os.id;
      }
      setHorasPorTecnico(prev => ({ ...horas, ...prev })); // não sobrescreve edits do usuário
      setInitialHorasPorTecnico(horas);
      setOsIdPorPrestador(osMap);
    })();
  }, [open, isStandalone, isAddMode, ticketId]);

  useEffect(() => {
    const date = isStandalone ? standaloneData.data_servico : ticket?.data_servico;
    const startTime = isStandalone ? standaloneData.horario_previsto_inicio : ticket?.horario_previsto_inicio;
    const maxHoras = Math.max(1, ...selectedPrestadores.map(id => horasPorTecnico[id] || 1));
    if (open && date && startTime) {
      const [h, m] = startTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(h + maxHoras, m, 0, 0);
      const endTime = endDate.toTimeString().slice(0, 5);
      checkAvailability(prestadores, date, startTime, endTime);
    }
  }, [open, ticket, prestadores, isStandalone, standaloneData.data_servico, standaloneData.horario_previsto_inicio, selectedPrestadores, horasPorTecnico]);

  // Auto-fill endereco when cliente picked (standalone)
  useEffect(() => {
    if (isStandalone && standaloneData.cliente_id) {
      const c = clientes.find(x => x.id === standaloneData.cliente_id);
      if (c) {
        const endereco = [c.endereco, c.cidade, c.estado].filter(Boolean).join(", ");
        if (endereco && !standaloneData.endereco_servico) {
          setStandaloneData(prev => ({ ...prev, endereco_servico: endereco }));
        }
      }
    }
  }, [standaloneData.cliente_id, isStandalone, clientes]);

  // Keep tecnicoResponsavelId valid: if it's no longer in selectedPrestadores, clear or default
  useEffect(() => {
    if (tecnicoResponsavelId && !selectedPrestadores.includes(tecnicoResponsavelId)) {
      setTecnicoResponsavelId(selectedPrestadores[0] || "");
    } else if (!tecnicoResponsavelId && selectedPrestadores.length > 0) {
      setTecnicoResponsavelId(selectedPrestadores[0]);
    }
  }, [selectedPrestadores, tecnicoResponsavelId]);

  const responsavelOptions = useMemo(
    () => prestadores.filter(p => selectedPrestadores.includes(p.id)),
    [prestadores, selectedPrestadores]
  );

  const handleTogglePrestador = (prestadorId: string, checked: boolean) => {
    const availability = availabilityMap.get(prestadorId);
    if (availability && !availability.available && checked) {
      toast.error("Este técnico possui conflito de agenda no horário selecionado");
      return;
    }
    setSelectedPrestadores(prev =>
      checked ? [...prev, prestadorId] : prev.filter(id => id !== prestadorId)
    );
  };

  // Em add-mode, técnicos previamente alocados que o usuário desmarcou
  const removedPrestadorIds = useMemo(
    () => (isAddMode ? assignedPrestadorIds.filter(id => !selectedPrestadores.includes(id)) : []),
    [isAddMode, assignedPrestadorIds, selectedPrestadores]
  );

  const handleTipoTrabalhoChange = (tipo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tipo_trabalho: checked ? [...prev.tipo_trabalho, tipo] : prev.tipo_trabalho.filter(t => t !== tipo),
    }));
  };

  // Técnicos que efetivamente serão alvo de geração: em add-mode, somente os NOVOS
  const newSelectedPrestadores = isAddMode
    ? selectedPrestadores.filter(id => !assignedPrestadorIds.includes(id))
    : selectedPrestadores;

  // Detecta troca de Técnico Responsável (add-mode): permite salvar mesmo sem novos técnicos.
  const responsavelChanged = isAddMode
    && !!tecnicoResponsavelId
    && tecnicoResponsavelId !== initialTecnicoResponsavelId;

  const validate = (): string | null => {
    if (isAddMode) {
      // Em add-mode aceitamos: novos técnicos OU troca de responsável OU remoção de técnicos
      if (newSelectedPrestadores.length === 0 && !responsavelChanged && removedPrestadorIds.length === 0) {
        return "Selecione novos técnicos, remova alguém ou troque o Técnico Responsável";
      }
      if (selectedPrestadores.length === 0) return "O ticket precisa ter ao menos um técnico alocado";
      if (!tecnicoResponsavelId) return "Selecione o Técnico Responsável";
      if (removedPrestadorIds.includes(tecnicoResponsavelId)) {
        return "O Técnico Responsável não pode ser removido. Troque o responsável antes.";
      }
    } else {
      if (selectedPrestadores.length === 0) return "Selecione ao menos um técnico";
      if (!tecnicoResponsavelId) return "Selecione o Técnico Responsável";
      if (formData.tipo_trabalho.length === 0) return "Selecione ao menos um tipo de trabalho";
      if (!formData.descricao_servicos.trim()) return "Informe a descrição dos serviços solicitados";
    }
    if (isStandalone) {
      if (!standaloneData.cliente_id) return "Selecione um cliente";
      if (!standaloneData.endereco_servico.trim()) return "Informe o endereço do serviço";
      if (!standaloneData.data_servico) return "Informe a data do serviço";
      // Trava: data não pode ser anterior a hoje
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const ds = new Date(standaloneData.data_servico + 'T00:00:00');
      if (ds < hoje) return "A data do serviço não pode ser anterior a hoje";
    }
    return null;
  };

  const ensureTicketId = async (): Promise<string> => {
    if (!isStandalone) return ticketId!;
    if (!user?.id) throw new Error("Usuário não autenticado");

    const cliente = clientes.find(c => c.id === standaloneData.cliente_id);
    const titulo = `OS Direta - ${cliente?.empresa || "Cliente"} - ${standaloneData.data_servico}`;

    // [VERIFICADO] - Standard typed Supabase insert.
    // Implicit ticket: status='aprovado' (created by staff, skips approval),
    // tecnico_responsavel_id from explicit "Técnico Responsável" selection.
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        titulo,
        descricao: formData.descricao_servicos,
        cliente_id: standaloneData.cliente_id,
        endereco_servico: standaloneData.endereco_servico,
        equipamento_tipo: 'outros',
        prioridade: 'media',
        status: 'aprovado',
        tecnico_responsavel_id: tecnicoResponsavelId,
        data_servico: standaloneData.data_servico,
        horario_previsto_inicio: standaloneData.horario_previsto_inicio || null,
        created_by: user.id,
      } as any)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const effectiveTicketId = await ensureTicketId();

      // ───── Remoção de técnicos previamente alocados (deselect) ─────
      // Para cada técnico desmarcado: dispara ICS CANCEL, notifica em-app
      // e remove a OS associada. Bloqueia se houver RME vinculado.
      let removedCount = 0;
      if (removedPrestadorIds.length > 0) {
        const { data: osRows, error: osErr } = await supabase
          .from('ordens_servico')
          .select('id, numero_os, tecnico_id, tecnicos!inner(id, prestador_id, profiles!inner(user_id, nome)), rme_relatorios(id)')
          .eq('ticket_id', effectiveTicketId)
          .in('tecnicos.prestador_id', removedPrestadorIds);
        if (osErr) throw osErr;

        const blocked = (osRows || []).find((os: any) => (os.rme_relatorios || []).length > 0);
        if (blocked) {
          toast.error(`Não é possível remover: a OS ${(blocked as any).numero_os} possui RME vinculado.`);
          setLoading(false);
          return;
        }

        for (const os of (osRows || []) as any[]) {
          // 1) ICS CANCEL — cobre técnicos pendentes e aceitos (a edge function
          //    só anexa o .ics se a OS tinha calendar_invite_sent_at)
          try {
            await supabase.functions.invoke('send-calendar-invite', {
              body: { os_id: os.id, action: 'cancel' },
            });
          } catch (e) {
            console.warn('send-calendar-invite cancel falhou:', e);
          }

          // 2) Notificação in-app ao técnico removido
          const tecUserId = os.tecnicos?.profiles?.user_id;
          if (tecUserId) {
            await supabase.from('notificacoes').insert({
              user_id: tecUserId,
              tipo: 'os_cancelada',
              titulo: 'Ordem de Serviço Cancelada',
              mensagem: `Sua alocação à OS ${os.numero_os} foi removida pelo gestor.`,
              link: '/minhas-os',
            });
          }

          // 3) Limpar dependências e excluir a OS
          await supabase.from('horas_previstas_os').delete().eq('ordem_servico_id', os.id);
          const { error: delErr } = await supabase.from('ordens_servico').delete().eq('id', os.id);
          if (delErr) {
            console.error('Erro ao remover OS:', delErr);
            toast.error(`Falha ao remover OS ${os.numero_os}: ${delErr.message}`);
          } else {
            removedCount++;
          }
        }

        if (removedCount > 0) {
          toast.success(`${removedCount} técnico(s) removido(s) — cancelamento enviado.`);
        }
      }

      // Ticket-based: garante que o ticket carregue o Técnico Responsável escolhido.
      // Inclui add-mode (item 4): se o usuário trocou o responsável, propagamos.
      const shouldUpdateTicketResponsavel = !isStandalone && (
        !isAddMode || responsavelChanged
      );
      if (shouldUpdateTicketResponsavel) {
        await supabase
          .from('tickets')
          .update({ tecnico_responsavel_id: tecnicoResponsavelId })
          .eq('id', effectiveTicketId);
      }

      // Item 4 — Cascata da troca de responsável (apenas em add-mode):
      // 1) Atualiza tecnico_responsavel_id em todas as OSs do ticket.
      // 2) Reatribui RMEs em rascunho/rejeitado/pendente para o tecnico do novo responsável.
      //    RMEs aprovados ficam intactos (regra de negócio).
      // Cobre tanto adição/retirada de técnicos como troca explícita de responsável.
      if (isAddMode && responsavelChanged) {
        try {
          // 1) propaga em todas as OSs
          await supabase
            .from('ordens_servico')
            .update({ tecnico_responsavel_id: tecnicoResponsavelId })
            .eq('ticket_id', effectiveTicketId);

          // 2) Resolver tecnico_id do novo responsável via FK direta tecnicos.prestador_id
          //    (mais confiável do que matching por email, conforme memória tecnicos-prestadores-fk-link)
          const { data: novoTecnico } = await supabase
            .from('tecnicos')
            .select('id')
            .eq('prestador_id', tecnicoResponsavelId)
            .maybeSingle();
          if (novoTecnico?.id) {
            await supabase
              .from('rme_relatorios')
              .update({ tecnico_id: novoTecnico.id })
              .eq('ticket_id', effectiveTicketId)
              .in('status', ['rascunho', 'rejeitado', 'pendente']);
          }
          toast.success('Técnico Responsável atualizado e RMEs em andamento reatribuídos.');
        } catch (e: any) {
          console.error('Erro ao propagar troca de responsável:', e);
          toast.error('OSs criadas, mas houve falha ao reatribuir RMEs. Verifique manualmente.');
        }
      }

      // Em add-mode geramos OS apenas para os técnicos NOVOS
      const targetPrestadores = isAddMode ? newSelectedPrestadores : selectedPrestadores;

      for (const prestadorId of targetPrestadores) {
        try {
          const horasTec = horasPorTecnico[prestadorId] || 1;
          const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
            body: {
              ticketId: effectiveTicketId,
              equipe: [],
              servico_solicitado: formData.descricao_servicos,
              inspetor_responsavel: 'TODOS',
              tipo_trabalho: formData.tipo_trabalho,
              tecnico_override_id: prestadorId,
              tecnico_responsavel_id: tecnicoResponsavelId,
              horas_previstas: horasTec,
            },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Erro ao gerar OS');
          successCount++;
        } catch (err: any) {
          console.error(`Erro ao gerar OS para prestador ${prestadorId}:`, err);
          errorCount++;
        }
      }

      // Em add-mode com apenas troca de responsável (sem novos técnicos),
      // não houve geração de OS — mas a operação foi bem-sucedida.
      const onlyMutateNoOS = isAddMode && newSelectedPrestadores.length === 0 && (responsavelChanged || removedCount > 0);
      if (successCount > 0 || onlyMutateNoOS) {
        if (successCount > 0) {
          toast.success(`${successCount} OS gerada(s) com sucesso!${errorCount > 0 ? ` ${errorCount} falha(s).` : ''}`);
        }
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error('Nenhuma OS foi gerada. Verifique os erros.');
      }
    } catch (error: any) {
      console.error('Erro ao gerar OS múltiplas:', error);
      toast.error(error.message || 'Erro ao gerar Ordens de Serviço');
    } finally {
      setLoading(false);
    }
  };

  const hasDateInfo = isStandalone
    ? !!(standaloneData.data_servico && standaloneData.horario_previsto_inicio)
    : !!(ticket?.data_servico && ticket?.horario_previsto_inicio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isStandalone
              ? "Nova Ordem de Serviço"
              : isAddMode
                ? "Adicionar Técnicos à OS"
                : "Gerar Ordem de Serviço"}
          </DialogTitle>
          <DialogDescription>
            {isStandalone
              ? "Crie uma OS diretamente. Um ticket será criado automaticamente para acompanhamento."
              : isAddMode
                ? "Selecione novos técnicos para alocar a este ticket. Será gerada uma nova OS para cada técnico adicionado, mantendo os já existentes."
                : "Selecione um ou mais técnicos para gerar OS individuais para cada um."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Standalone-only: Cliente / Endereço / Data / Hora */}
          {isStandalone && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente <span className="text-destructive">*</span></Label>
                  {(() => {
                    const selected = clientes.find(c => c.id === standaloneData.cliente_id);
                    const fmtLabel = (c: ClienteOption) => {
                      const doc = c.cnpj_cpf?.trim();
                      const nome = c.empresa || "Sem nome";
                      const ufv = c.ufv_solarz ? ` — ${c.ufv_solarz}` : "";
                      return `${doc ? doc + " · " : ""}${nome}${ufv}`;
                    };
                    return (
                      <Popover open={clienteSearchOpen} onOpenChange={setClienteSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="cliente"
                            variant="outline"
                            role="combobox"
                            aria-expanded={clienteSearchOpen}
                            className="w-full justify-between font-normal"
                          >
                            <span className="truncate">
                              {selected ? fmtLabel(selected) : "Selecione o cliente"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command
                            filter={(value, search) => {
                              const v = value.toLowerCase();
                              const s = search.toLowerCase().replace(/[^\w]/g, "");
                              const vNorm = v.replace(/[^\w]/g, "");
                              return v.includes(search.toLowerCase()) || vNorm.includes(s) ? 1 : 0;
                            }}
                          >
                            <CommandInput placeholder="Buscar por nome, CNPJ ou CPF..." />
                            <CommandList>
                              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                              <CommandGroup>
                                {clientes.map(c => {
                                  const label = fmtLabel(c);
                                  const searchValue = `${c.empresa || ""} ${c.cnpj_cpf || ""} ${c.ufv_solarz || ""}`.trim();
                                  return (
                                    <CommandItem
                                      key={c.id}
                                      value={searchValue}
                                      onSelect={() => {
                                        setStandaloneData(prev => ({ ...prev, cliente_id: c.id }));
                                        setClienteSearchOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", standaloneData.cliente_id === c.id ? "opacity-100" : "opacity-0")} />
                                      <span className="truncate">{label}</span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço do Serviço <span className="text-destructive">*</span></Label>
                  <Input
                    id="endereco"
                    value={standaloneData.endereco_servico}
                    onChange={(e) => setStandaloneData(prev => ({ ...prev, endereco_servico: e.target.value }))}
                    placeholder="Endereço completo"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="data_servico">Data <span className="text-destructive">*</span></Label>
                  <Input
                    id="data_servico" type="date"
                    value={standaloneData.data_servico}
                    onChange={(e) => setStandaloneData(prev => ({ ...prev, data_servico: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora_inicio">Hora Início</Label>
                  <Input
                    id="hora_inicio" type="time"
                    value={standaloneData.horario_previsto_inicio}
                    onChange={(e) => setStandaloneData(prev => ({ ...prev, horario_previsto_inicio: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* Técnicos */}
          <div className="space-y-2">
            <Label>Técnicos <span className="text-destructive">*</span></Label>
            {!hasDateInfo && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Sem data/horário definidos. A verificação de conflito de agenda está desabilitada.
                </AlertDescription>
              </Alert>
            )}
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {prestadores.map(prestador => {
                const availability = availabilityMap.get(prestador.id);
                const isSelected = selectedPrestadores.includes(prestador.id);
                const hasConflict = availability && !availability.available;
                const hasEmail = prestador.email && prestador.email.trim() !== '';
                return (
                  <div
                    key={prestador.id}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${hasConflict ? 'opacity-70' : ''}`}
                  >
                    <Checkbox
                      id={`tech-${prestador.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleTogglePrestador(prestador.id, checked as boolean)}
                      disabled={(!isSelected && (!!hasConflict || !hasEmail))}
                    />
                    <label htmlFor={`tech-${prestador.id}`} className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2">
                      <span className={!hasEmail ? 'text-destructive' : ''}>{prestador.nome}</span>
                      {!hasEmail && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />Sem email
                        </Badge>
                      )}
                      {isAddMode && assignedPrestadorIds.includes(prestador.id) && isSelected && (
                        <Badge variant="outline" className="text-[10px]">Já alocado</Badge>
                      )}
                      {isAddMode && assignedPrestadorIds.includes(prestador.id) && !isSelected && (
                        <Badge variant="destructive" className="text-[10px]">Será removido</Badge>
                      )}
                    </label>
                    <div className="flex-shrink-0">
                      {checkingAvailability ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : hasDateInfo && availability ? (
                        availability.available ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" />Disponível
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" />Ocupado
                          </Badge>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {isAddMode ? (
              newSelectedPrestadores.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {newSelectedPrestadores.length} novo(s) técnico(s) será(ão) adicionado(s) — 1 OS para cada.
                </p>
              )
            ) : (
              selectedPrestadores.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedPrestadores.length} técnico(s) selecionado(s) — será gerada 1 OS para cada
                </p>
              )
            )}
          </div>

          {/* Add-mode: Horas Previstas por Técnico (existentes + novos) + Horário Programado */}
          {isAddMode && selectedPrestadores.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Horas Previstas por Técnico <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">
                  Ajuste a duração de cada técnico (existente ou novo). Alterações em técnicos já alocados recalculam a janela de execução da OS correspondente.
                </p>
                <div className="border rounded-md divide-y">
                  {selectedPrestadores.map(pid => {
                    const p = prestadores.find(x => x.id === pid);
                    const horas = horasPorTecnico[pid] ?? 1;
                    const date = ticket?.data_servico;
                    const startTime = ticket?.horario_previsto_inicio;
                    let hint: string | null = null;
                    if (hasDateInfo && date && startTime && horas > 0) {
                      const s = computeScheduleEnd(date, startTime, Math.round(horas * 60));
                      const [, mo, d] = s.endDate.split('-');
                      hint = `Encerra ${d}/${mo} às ${s.endTime}`;
                    }
                    const initial = initialHorasPorTecnico[pid];
                    const isExisting = assignedPrestadorIds.includes(pid);
                    const changed = typeof initial === 'number' && Math.abs(initial - horas) > 0.001;
                    return (
                      <div key={pid} className="flex items-center gap-3 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate flex items-center gap-2">
                            {p?.nome || pid}
                            {!isExisting && (
                              <Badge variant="outline" className="text-[10px]">Novo</Badge>
                            )}
                            {changed && (
                              <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Alterado
                              </Badge>
                            )}
                          </p>
                        </div>
                        <Input
                          type="number" min={0.5} max={24} step={0.5}
                          className="w-20 h-9"
                          value={horasPorTecnico[pid] ?? 1}
                          onChange={(e) => setHorasPorTecnico(prev => ({ ...prev, [pid]: Number(e.target.value) || 1 }))}
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                        {hint && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">→ {hint}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasDateInfo && (() => {
                const date = ticket?.data_servico;
                const startTime = ticket?.horario_previsto_inicio;
                const maxHoras = Math.max(1, ...selectedPrestadores.map(id => horasPorTecnico[id] || 1));
                const sched = computeScheduleEnd(date, startTime, Math.round(maxHoras * 60));
                const startHHMM = (startTime || '').slice(0, 5);
                const endHHMM = (sched.endTime || '').slice(0, 5);
                const display = formatScheduledWindow(date, startHHMM, endHHMM, sched.endDate);
                const [, em, ed] = sched.endDate.split('-');
                const endHint = `Encerra ${ed}/${em} às ${endHHMM} (técnico com maior duração: ${maxHoras}h)`;
                return (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <strong>Horário Programado:</strong> {display}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{endHint}</p>
                    {sched.outOfWindowWarning && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ Hora de início fora da janela útil (08:00–18:00). Reprogramado para o próximo slot válido.
                      </p>
                    )}
                    {sched.crossedDay && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ A duração ultrapassa a janela útil — o serviço se estende para o próximo dia útil.
                      </p>
                    )}
                    {sched.weekendWarning && (
                      <p className="text-xs text-destructive">
                        ⚠ A data selecionada cai em fim de semana. O serviço foi automaticamente movido para a próxima segunda-feira.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Grid: Esquerda (Horas + Horário Programado) | Direita (Tipo + Responsável) */}
          {!isAddMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coluna esquerda */}
              <div className="space-y-4">
                {/* Horas previstas POR técnico (BI Carga de Trabalho) */}
                {selectedPrestadores.length > 0 && (
                  <div className="space-y-2">
                    <Label>Horas Previstas por Técnico <span className="text-destructive">*</span></Label>
                    <p className="text-xs text-muted-foreground">
                      Previsão de horas para realização do trabalho. Necessário incluir pausas.
                    </p>
                    <div className="border rounded-md divide-y">
                      {selectedPrestadores.map(pid => {
                        const p = prestadores.find(x => x.id === pid);
                        const horas = horasPorTecnico[pid] ?? 1;
                        const date = isStandalone ? standaloneData.data_servico : ticket?.data_servico;
                        const startTime = isStandalone ? standaloneData.horario_previsto_inicio : ticket?.horario_previsto_inicio;
                        let hint: string | null = null;
                        if (hasDateInfo && date && startTime && horas > 0) {
                          const s = computeScheduleEnd(date, startTime, Math.round(horas * 60));
                          const [y, mo, d] = s.endDate.split('-');
                          hint = `Encerra ${d}/${mo} às ${s.endTime}`;
                        }
                        const initial = initialHorasPorTecnico[pid];
                        const changed = isAddMode && typeof initial === 'number' && Math.abs(initial - horas) > 0.001;
                        return (
                          <div key={pid} className="flex items-center gap-3 p-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {p?.nome || pid}
                                {changed && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">Alterado</Badge>
                                )}
                              </p>
                            </div>
                            <Input
                              type="number" min={0.5} max={24} step={0.5}
                              className="w-20 h-9"
                              value={horasPorTecnico[pid] ?? 1}
                              onChange={(e) => setHorasPorTecnico(prev => ({ ...prev, [pid]: Number(e.target.value) || 1 }))}
                            />
                            <span className="text-xs text-muted-foreground">h</span>
                            {hint && (
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">→ {hint}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preview do Horário Programado calculado pela janela útil (técnico com maior duração) */}
                {hasDateInfo && selectedPrestadores.length > 0 && (() => {
                  const date = isStandalone ? standaloneData.data_servico : ticket?.data_servico;
                  const startTime = isStandalone ? standaloneData.horario_previsto_inicio : ticket?.horario_previsto_inicio;
                  const maxHoras = Math.max(1, ...selectedPrestadores.map(id => horasPorTecnico[id] || 1));
                  const sched = computeScheduleEnd(date, startTime, Math.round(maxHoras * 60));
                  const startHHMM = (startTime || '').slice(0, 5);
                  const endHHMM = (sched.endTime || '').slice(0, 5);
                  const display = formatScheduledWindow(date, startHHMM, endHHMM, sched.endDate);
                  const [ey, em, ed] = sched.endDate.split('-');
                  const endHint = `Encerra ${ed}/${em} às ${endHHMM} (técnico com maior duração: ${maxHoras}h)`;
                  return (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <strong>Horário Programado:</strong> {display}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{endHint}</p>
                      {sched.outOfWindowWarning && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠ Hora de início fora da janela útil (08:00–18:00). Reprogramado para o próximo slot válido.
                        </p>
                      )}
                      {sched.crossedDay && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠ A duração ultrapassa a janela útil — o serviço se estende para o próximo dia útil.
                        </p>
                      )}
                      {sched.weekendWarning && (
                        <p className="text-xs text-destructive">
                          ⚠ A data selecionada cai em fim de semana. O serviço foi automaticamente movido para a próxima segunda-feira.
                        </p>
                      )}
                    </div>
                  );
                })()}

              </div>

              {/* Coluna direita */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Trabalho <span className="text-destructive">*</span></Label>
                  <div className="flex gap-6 flex-wrap">
                    {['internet', 'eletrica', 'limpeza'].map(tipo => (
                      <div key={tipo} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tipo-${tipo}`}
                          checked={formData.tipo_trabalho.includes(tipo)}
                          onCheckedChange={(checked) => handleTipoTrabalhoChange(tipo, checked as boolean)}
                        />
                        <label htmlFor={`tipo-${tipo}`} className="text-sm font-medium">
                          {tipo === 'eletrica' ? 'ELÉTRICA' : tipo.toUpperCase()}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel">Técnico Responsável <span className="text-destructive">*</span></Label>
                  <Select
                    value={tecnicoResponsavelId}
                    onValueChange={setTecnicoResponsavelId}
                    disabled={responsavelOptions.length === 0}
                  >
                    <SelectTrigger id="responsavel">
                      <SelectValue placeholder={responsavelOptions.length === 0 ? "Selecione técnicos acima" : "Escolha o responsável"} />
                    </SelectTrigger>
                    <SelectContent>
                      {responsavelOptions.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Responsável principal pelo serviço. Se recusar, o próximo a aceitar assume.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Descrição (full-width, abaixo) */}
          {!isAddMode && (
            <div className="space-y-2">
              <Label htmlFor="descricao_servicos">Descrição Serviços Solicitados <span className="text-destructive">*</span></Label>
              <Textarea
                id="descricao_servicos"
                rows={3}
                value={formData.descricao_servicos}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao_servicos: e.target.value }))}
                placeholder="Situação da planta (kwp, qtd de módulos, potência) e descrição dos serviços a serem realizados."
              />
            </div>
          )}


          <div className="p-4 bg-warning/10 border border-warning/30 rounded-md">
            <p className="text-xs">
              <strong>ATENÇÃO:</strong> A OS deve ser preenchida e grampeada junto com o RME.
              Não será permitido RME sem a OS grampeada e/ou vinculada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          {isAddMode ? (
            <Button
              onClick={handleSubmit}
              disabled={loading || (newSelectedPrestadores.length === 0 && !responsavelChanged && removedPrestadorIds.length === 0)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(() => {
                const parts: string[] = [];
                if (newSelectedPrestadores.length > 0) parts.push(`Adicionar ${newSelectedPrestadores.length} técnico${newSelectedPrestadores.length > 1 ? 's' : ''}`);
                if (removedPrestadorIds.length > 0) parts.push(`Remover ${removedPrestadorIds.length}`);
                if (responsavelChanged) parts.push('Trocar responsável');
                return parts.length ? parts.join(' + ') : 'Salvar alterações';
              })()}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading || selectedPrestadores.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar {selectedPrestadores.length > 1 ? `${selectedPrestadores.length} OS` : 'OS'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
