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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTechnicianAvailability } from "@/hooks/useTechnicianAvailability";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";

interface Prestador {
  id: string;
  nome: string;
  email: string;
}

interface ClienteOption {
  id: string;
  empresa: string | null;
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
  onSuccess,
}: MultiTechnicianOSDialogProps) => {
  const { user } = useAuth();
  const isStandalone = !ticketId;
  const isAddMode = alreadyAssignedPrestadorIds.length > 0;

  const [loading, setLoading] = useState(false);
  const [selectedPrestadores, setSelectedPrestadores] = useState<string[]>([]);
  const [tecnicoResponsavelId, setTecnicoResponsavelId] = useState<string>("");
  /** Horas previstas POR técnico (sempre por técnico — usado pelo BI Carga de Trabalho) */
  const [horasPorTecnico, setHorasPorTecnico] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    descricao_servicos: "MANUTENÇÃO",
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
      setHorasPorTecnico({});
      setFormData({ descricao_servicos: "MANUTENÇÃO", tipo_trabalho: [] });
      setStandaloneData({
        cliente_id: "",
        endereco_servico: "",
        data_servico: new Date().toISOString().slice(0, 10),
        horario_previsto_inicio: "08:00",
      });
    }
  }, [open]);

  // Pre-select assigned tech (ticket-based mode) — pre-selects the already assigned ones
  // when in "add mode" so the user clearly sees who is already allocated.
  useEffect(() => {
    if (open && !isStandalone) {
      if (isAddMode) {
        setSelectedPrestadores([...alreadyAssignedPrestadorIds]);
        setTecnicoResponsavelId(ticket?.tecnico_responsavel_id || alreadyAssignedPrestadorIds[0] || "");
      } else if (ticket?.tecnico_responsavel_id) {
        setSelectedPrestadores([ticket.tecnico_responsavel_id]);
        setTecnicoResponsavelId(ticket.tecnico_responsavel_id);
      }
    }
  }, [open, ticket, isStandalone, isAddMode, alreadyAssignedPrestadorIds]);

  // Availability check — usa max(horas) entre os técnicos selecionados como janela
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
    // Em modo "adicionar técnicos", os já alocados são fixos
    if (isAddMode && alreadyAssignedPrestadorIds.includes(prestadorId)) return;
    const availability = availabilityMap.get(prestadorId);
    if (availability && !availability.available && checked) {
      toast.error("Este técnico possui conflito de agenda no horário selecionado");
      return;
    }
    setSelectedPrestadores(prev =>
      checked ? [...prev, prestadorId] : prev.filter(id => id !== prestadorId)
    );
  };

  const handleTipoTrabalhoChange = (tipo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tipo_trabalho: checked ? [...prev.tipo_trabalho, tipo] : prev.tipo_trabalho.filter(t => t !== tipo),
    }));
  };

  // Técnicos que efetivamente serão alvo de geração: em add-mode, somente os NOVOS
  const newSelectedPrestadores = isAddMode
    ? selectedPrestadores.filter(id => !alreadyAssignedPrestadorIds.includes(id))
    : selectedPrestadores;

  // Detecta troca de Técnico Responsável (add-mode): permite salvar mesmo sem novos técnicos.
  const responsavelChanged = isAddMode
    && !!tecnicoResponsavelId
    && !!ticket?.tecnico_responsavel_id
    && tecnicoResponsavelId !== ticket.tecnico_responsavel_id;

  const validate = (): string | null => {
    if (isAddMode) {
      // Em add-mode aceitamos: novos técnicos OU apenas troca de responsável
      if (newSelectedPrestadores.length === 0 && !responsavelChanged) {
        return "Selecione novos técnicos ou troque o Técnico Responsável";
      }
      if (!tecnicoResponsavelId) return "Selecione o Técnico Responsável";
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
      if (isAddMode && responsavelChanged) {
        try {
          // 1) propaga em todas as OSs
          await supabase
            .from('ordens_servico')
            .update({ tecnico_responsavel_id: tecnicoResponsavelId })
            .eq('ticket_id', effectiveTicketId);

          // 2) busca o tecnico_id do novo responsável (via prestador → email → tecnicos)
          const { data: novoPrestador } = await supabase
            .from('prestadores')
            .select('email')
            .eq('id', tecnicoResponsavelId)
            .maybeSingle();
          if (novoPrestador?.email) {
            const { data: novoTecnico } = await supabase
              .from('tecnicos')
              .select('id, profiles!inner(email)')
              .ilike('profiles.email', novoPrestador.email)
              .maybeSingle();
            if (novoTecnico?.id) {
              await supabase
                .from('rme_relatorios')
                .update({ tecnico_id: novoTecnico.id })
                .eq('ticket_id', effectiveTicketId)
                .in('status', ['rascunho', 'rejeitado', 'pendente']);
            }
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
      const onlyResponsavelChange = isAddMode && responsavelChanged && newSelectedPrestadores.length === 0;
      if (successCount > 0 || onlyResponsavelChange) {
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
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente <span className="text-destructive">*</span></Label>
                <Select
                  value={standaloneData.cliente_id}
                  onValueChange={(v) => setStandaloneData(prev => ({ ...prev, cliente_id: v }))}
                >
                  <SelectTrigger id="cliente"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.empresa || "Sem nome"}{c.ufv_solarz ? ` — ${c.ufv_solarz}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      disabled={!!hasConflict || !hasEmail || (isAddMode && alreadyAssignedPrestadorIds.includes(prestador.id))}
                    />
                    <label htmlFor={`tech-${prestador.id}`} className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2">
                      <span className={!hasEmail ? 'text-destructive' : ''}>{prestador.nome}</span>
                      {!hasEmail && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />Sem email
                        </Badge>
                      )}
                      {isAddMode && alreadyAssignedPrestadorIds.includes(prestador.id) && (
                        <Badge variant="outline" className="text-[10px]">Já alocado</Badge>
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

          {/* Horas previstas POR técnico (BI Carga de Trabalho) */}
          {selectedPrestadores.length > 0 && !isAddMode && (
            <div className="space-y-2">
              <Label>Horas Previstas por Técnico <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                Meta de horas que cada técnico deve gastar nesta OS. Usado pelo BI Carga de Trabalho (Meta × Realizado).
              </p>
              <div className="border rounded-md divide-y">
                {selectedPrestadores.map(pid => {
                  const p = prestadores.find(x => x.id === pid);
                  return (
                    <div key={pid} className="flex items-center justify-between gap-3 p-2">
                      <span className="text-sm flex-1">{p?.nome || pid}</span>
                      <Input
                        type="number" min={0.5} max={24} step={0.5}
                        className="w-24 h-9"
                        value={horasPorTecnico[pid] ?? 1}
                        onChange={(e) => setHorasPorTecnico(prev => ({ ...prev, [pid]: Number(e.target.value) || 1 }))}
                      />
                      <span className="text-xs text-muted-foreground w-6">h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflict details */}
          {Array.from(availabilityMap.values())
            .filter(a => !a.available && a.conflictDetails)
            .map(a => {
              const prest = prestadores.find(p => p.id === a.prestadorId);
              return (
                <Alert key={a.prestadorId} variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>{prest?.nome}</strong>: Conflito com {a.conflictDetails}
                  </AlertDescription>
                </Alert>
              );
            })}

          {/* Tipo / Responsável / Descrição — apenas no modo "gerar OS" inicial */}
          {!isAddMode && (
            <>
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

              <div className="space-y-2">
                <Label htmlFor="descricao_servicos">Descrição Serviços Solicitados <span className="text-destructive">*</span></Label>
                <Textarea
                  id="descricao_servicos"
                  rows={3}
                  value={formData.descricao_servicos}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao_servicos: e.target.value }))}
                  placeholder="Descreva os serviços a serem executados"
                />
              </div>
            </>
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
            <Button onClick={handleSubmit} disabled={loading || newSelectedPrestadores.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar {newSelectedPrestadores.length > 1 ? `${newSelectedPrestadores.length} técnicos` : 'técnico'}
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
