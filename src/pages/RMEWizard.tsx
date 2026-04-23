import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Check, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { downloadRMEPDF, type RMEPDFData } from "@/utils/generateRMEPDF";
import { StepIdentification, StepServiceShift, StepChecklists, StepEvidence, StepToolsEPIs, StepSignatures, RMEInsumosPanel } from "@/components/rme-wizard";

export interface RMEFormData {
  id?: string;
  ordem_servico_id: string;
  ticket_id: string;
  tecnico_id: string;
  data_execucao: string;
  data_fim_execucao: string;
  weekday: string;
  site_name: string;
  collaboration: string[];
  micro_number: string;
  inverter_number: string;
  service_type: string[];
  shift: string;
  start_time: string;
  end_time: string;
  images_posted: boolean;
  modules_cleaned_qty: number;
  string_box_qty: number;
  condicoes_encontradas: string;
  servicos_executados: string;
  materiais_utilizados: Array<{ descricao: string; quantidade: number; tinha_estoque: boolean }>;
  signatures: {
    responsavel?: { nome: string; at: string };
    gerente_manutencao?: { nome: string; at: string };
    gerente_projeto?: { nome: string; at: string };
  };
  // Photo URLs persisted to rme_relatorios.fotos_antes / fotos_depois
  fotos_antes: string[];
  fotos_depois: string[];
  // Canvas signatures (DataURL) for technician & client
  assinatura_tecnico: string;
  assinatura_cliente: string;
  nome_cliente_assinatura: string;
  /** Unified status: rascunho | pendente | aprovado | rejeitado */
  status: string;
  client_name: string;
  address: string;
  ufv_solarz?: string;
}

interface WorkOrderInfo {
  id: string;
  numero_os: string;
  site_name: string | null;
  ticket_id: string;
  tecnico_responsavel_id?: string | null;
  tickets: { id: string; endereco_servico: string; clientes: { empresa: string; ufv_solarz: string | null } };
}

export interface TechnicianOption {
  id: string; // tecnicos.id
  nome: string;
  email: string;
}

const STEPS = [
  { id: 1, title: "Identificação", shortTitle: "ID" },
  { id: 2, title: "Serviço e Turno", shortTitle: "Turno" },
  { id: 3, title: "Checklists", shortTitle: "Check" },
  { id: 4, title: "Evidências", shortTitle: "Fotos" },
  { id: 5, title: "Ferramentas e EPIs", shortTitle: "EPIs" },
  { id: 6, title: "Notas e Assinaturas", shortTitle: "Final" },
];

const getWeekday = (date: Date): string => ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][date.getDay()];

const defaultFormData: RMEFormData = {
  ordem_servico_id: "", ticket_id: "", tecnico_id: "",
  data_execucao: new Date().toISOString().split("T")[0],
  data_fim_execucao: new Date().toISOString().split("T")[0],
  weekday: getWeekday(new Date()),
  site_name: "", collaboration: [], micro_number: "", inverter_number: "",
  service_type: [], shift: "manha", start_time: "08:00", end_time: "17:00",
  images_posted: false, modules_cleaned_qty: 0, string_box_qty: 0,
  condicoes_encontradas: "", servicos_executados: "", materiais_utilizados: [],
  signatures: {},
  fotos_antes: [], fotos_depois: [],
  assinatura_tecnico: "", assinatura_cliente: "", nome_cliente_assinatura: "",
  status: "rascunho", client_name: "", address: "", ufv_solarz: "",
};

const RMEWizard = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const osId = searchParams.get("os");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderInfo | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [tecnicoNome, setTecnicoNome] = useState("");
  const [formData, setFormData] = useState<RMEFormData>(defaultFormData);
  const [availableTechnicians, setAvailableTechnicians] = useState<TechnicianOption[]>([]);
  const [isResponsavel, setIsResponsavel] = useState(false);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);

  const isNewRME = id === "new";

  useEffect(() => { loadTecnicoId(); }, [profile]);
  useEffect(() => {
    if (isNewRME && osId) loadWorkOrder(osId);
    else if (!isNewRME && id) loadExistingRME(id);
  }, [id, osId, isNewRME]);

  // Re-evaluate responsável when tecnicoId resolves after the OS/RME has been loaded
  useEffect(() => {
    if (currentTicketId) loadGroupContext(currentTicketId);
  }, [currentTicketId, tecnicoId, profile?.email]);

  // Realtime: refresh available technicians whenever sibling OS aceite_tecnico changes
  // (e.g. another technician accepts/rejects after this wizard was opened).
  useEffect(() => {
    if (!currentTicketId) return;
    const channel = supabase
      .channel(`rme-wizard-os-${currentTicketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ordens_servico", filter: `ticket_id=eq.${currentTicketId}` },
        () => { loadGroupContext(currentTicketId); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ordens_servico", filter: `ticket_id=eq.${currentTicketId}` },
        () => { loadGroupContext(currentTicketId); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentTicketId]);

  const loadTecnicoId = async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase.from("tecnicos").select("id, profiles(nome)").eq("profile_id", profile.id).maybeSingle();
    if (data) { setTecnicoId(data.id); setTecnicoNome((data.profiles as any)?.nome || ""); }
  };

  /**
   * Loads the accepted technicians for the current ticket via a SECURITY DEFINER RPC,
   * so the responsible technician can still see sibling technicians after they accept
   * their own OS even when direct profile joins are restricted by RLS.
   */
  const loadGroupContext = async (ticketId: string) => {
    const { data, error } = await supabase.rpc("get_ticket_rme_group_context", {
      p_ticket_id: ticketId,
    });

    if (error) {
      console.warn("loadGroupContext failed:", error);
      setAvailableTechnicians([]);
      setIsResponsavel(false);
      return;
    }

    const techs: TechnicianOption[] = (data || []).map((row: any) => ({
      id: row.tecnico_id,
      nome: row.nome || "Sem nome",
      email: row.email || "",
    }));

    setAvailableTechnicians(techs);

    const responsavelEmail = data?.[0]?.responsavel_email;
    setIsResponsavel(
      !!responsavelEmail &&
        !!profile?.email &&
        responsavelEmail.toLowerCase() === profile.email.toLowerCase()
    );
  };

  const loadWorkOrder = async (workOrderId: string) => {
    try {
      setLoading(true);
      // If an RME already exists for this OS, redirect to edit it (avoid unique-constraint conflict)
      const { data: existingRme } = await supabase
        .from("rme_relatorios")
        .select("id")
        .eq("ordem_servico_id", workOrderId)
        .maybeSingle();
      if (existingRme?.id) {
        navigate(`/rme-wizard/${existingRme.id}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.from("ordens_servico").select("id, numero_os, site_name, ticket_id, tickets(id, endereco_servico, clientes(empresa, cliente_ufvs(nome)))").eq("id", workOrderId).single();
      if (error) throw error;
      const anyData: any = data;
      if (anyData?.tickets?.clientes) {
        const ufvs = Array.isArray(anyData.tickets.clientes.cliente_ufvs) ? anyData.tickets.clientes.cliente_ufvs : [];
        const names = ufvs.map((u: any) => u?.nome).filter(Boolean);
        anyData.tickets.clientes.ufv_solarz = names.length ? names.join(', ') : null;
      }
      setWorkOrder(anyData as unknown as WorkOrderInfo);
      const clienteNome = anyData?.tickets?.clientes?.empresa || "";
      setFormData(prev => ({ ...prev, ordem_servico_id: anyData.id, ticket_id: anyData.ticket_id, site_name: anyData.site_name || "", client_name: clienteNome, address: anyData?.tickets?.endereco_servico || "", ufv_solarz: anyData?.tickets?.clientes?.ufv_solarz || "", nome_cliente_assinatura: prev.nome_cliente_assinatura || clienteNome }));
      setCurrentTicketId(anyData.ticket_id);
      await loadGroupContext(anyData.ticket_id);
    } catch (error: any) {
      toast({ title: "Erro ao carregar OS", description: error.message, variant: "destructive" });
      navigate("/work-orders");
    } finally { setLoading(false); }
  };

  const loadExistingRME = async (rmeId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("rme_relatorios").select("*, tecnicos(id, profiles(nome)), ordens_servico(id, numero_os, site_name, ticket_id, tickets(id, endereco_servico, clientes(empresa, cliente_ufvs(nome))))").eq("id", rmeId).single();
      if (error) throw error;
      const os = data.ordens_servico as any;
      const tecnico = data.tecnicos as any;
      setWorkOrder(os);
      setTecnicoNome(tecnico?.profiles?.nome || "");
      setFormData({
        id: data.id, ordem_servico_id: data.ordem_servico_id, ticket_id: data.ticket_id, tecnico_id: data.tecnico_id,
        data_execucao: data.data_execucao?.split("T")[0] || "",
        data_fim_execucao: data.data_execucao?.split("T")[0] || "",
        weekday: data.weekday || "",
        site_name: data.site_name || os?.site_name || "",
        collaboration: Array.isArray(data.collaboration) ? (data.collaboration as string[]) : [],
        micro_number: data.micro_number || "", inverter_number: data.inverter_number || "",
        service_type: Array.isArray(data.service_type) ? (data.service_type as string[]) : [],
        shift: data.shift || "manha", start_time: data.start_time || "08:00", end_time: data.end_time || "17:00",
        images_posted: data.images_posted || false, modules_cleaned_qty: data.modules_cleaned_qty || 0, string_box_qty: data.string_box_qty || 0,
        condicoes_encontradas: data.condicoes_encontradas || "", servicos_executados: data.servicos_executados || "",
        materiais_utilizados: Array.isArray(data.materiais_utilizados) ? (data.materiais_utilizados as any[]) : [],
        signatures: (data.signatures as any) || {},
        fotos_antes: Array.isArray(data.fotos_antes) ? data.fotos_antes : [],
        fotos_depois: Array.isArray(data.fotos_depois) ? data.fotos_depois : [],
        assinatura_tecnico: data.assinatura_tecnico || "",
        assinatura_cliente: data.assinatura_cliente || "",
        nome_cliente_assinatura: data.nome_cliente_assinatura || "",
        status: data.status || "rascunho",
        client_name: os?.tickets?.clientes?.empresa || "", address: os?.tickets?.endereco_servico || "", ufv_solarz: os?.tickets?.clientes?.ufv_solarz || "",
      });
      const { data: items } = await supabase.from("rme_checklist_items").select("*").eq("rme_id", rmeId).order("category").order("item_key");
      setChecklistItems(items || []);
      setCurrentTicketId(data.ticket_id);
      await loadGroupContext(data.ticket_id);
    } catch (error: any) {
      toast({ title: "Erro ao carregar RME", description: error.message, variant: "destructive" });
      navigate("/work-orders");
    } finally { setLoading(false); }
  };

  const updateFormData = useCallback((updates: Partial<RMEFormData>) => { setFormData(prev => ({ ...prev, ...updates })); }, []);

  // RME locked when not in editable state (rascunho/rejeitado).
  const isLocked = formData.status !== "rascunho" && formData.status !== "rejeitado";

  const saveRME = async (finalize = false) => {
    if (isLocked) {
      toast({ title: "RME bloqueado para edição", description: "Aguarde a avaliação. Edição só é liberada se o avaliador recusar.", variant: "destructive" });
      return null;
    }
    if (!tecnicoId && !formData.tecnico_id) { toast({ title: "Erro", description: "Técnico não identificado", variant: "destructive" }); return null; }
    setSaving(true);
    try {
      const payload = {
        ordem_servico_id: formData.ordem_servico_id, ticket_id: formData.ticket_id, tecnico_id: formData.tecnico_id || tecnicoId,
        data_execucao: formData.data_execucao, weekday: formData.weekday, site_name: formData.site_name,
        collaboration: formData.collaboration, micro_number: formData.micro_number, inverter_number: formData.inverter_number,
        service_type: formData.service_type, shift: formData.shift, start_time: formData.start_time, end_time: formData.end_time,
        images_posted: formData.images_posted, modules_cleaned_qty: formData.modules_cleaned_qty, string_box_qty: formData.string_box_qty,
        condicoes_encontradas: formData.condicoes_encontradas || "A preencher", servicos_executados: formData.servicos_executados || "A preencher",
        materiais_utilizados: formData.materiais_utilizados, signatures: formData.signatures,
        fotos_antes: formData.fotos_antes,
        fotos_depois: formData.fotos_depois,
        assinatura_tecnico: formData.assinatura_tecnico || null,
        assinatura_cliente: formData.assinatura_cliente || null,
        nome_cliente_assinatura: formData.nome_cliente_assinatura || null,
        status: finalize ? "pendente" : (formData.status === "rejeitado" ? "rejeitado" : "rascunho"),
      };
      let rmeId = formData.id;
      if (rmeId) {
        const { error } = await supabase.from("rme_relatorios").update(payload).eq("id", rmeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("rme_relatorios").insert([payload]).select().single();
        if (error) throw error;
        rmeId = data.id;
        setFormData(prev => ({ ...prev, id: rmeId }));
        await supabase.rpc("populate_rme_checklist", { p_rme_id: rmeId });
        const { data: items } = await supabase.from("rme_checklist_items").select("*").eq("rme_id", rmeId).order("category").order("item_key");
        setChecklistItems(items || []);
      }
      toast({ title: finalize ? "RME concluído!" : "Rascunho salvo" });
      return rmeId;
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return null;
    } finally { setSaving(false); }
  };

  const handleNext = async () => { const saved = await saveRME(false); if (saved && currentStep < STEPS.length) setCurrentStep(currentStep + 1); };
  const handlePrevious = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const handleFinalize = async () => {
    if (!isResponsavel) {
      toast({
        title: "Ação restrita ao Técnico Responsável",
        description: "Somente o técnico responsável do grupo de OS/Ticket pode concluir o RME.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.servicos_executados || formData.servicos_executados.length < 10) {
      toast({ title: "Campo obrigatório", description: "Preencha a descrição do serviço realizado", variant: "destructive" });
      return;
    }
    // Guard: cannot submit the RME while sibling OS on the same ticket are still undecided.
    // Draft/auto-save remains allowed — only submission (rascunho → pendente) is blocked.
    if (formData.ticket_id) {
      const { myOrdersService } = await import('@/features/my-orders/services/myOrdersService');
      const pendentes = await myOrdersService.getPendingAcceptanceSiblings(formData.ticket_id);
      if (pendentes.length > 0) {
        const nums = pendentes.map(p => p.numero_os).join(', ');
        toast({
          title: "Não é possível concluir o RME ainda",
          description: `${pendentes.length} OS deste ticket ainda aguarda(m) aceite ou recusa do(s) técnico(s): ${nums}. Você pode continuar preenchendo e salvando como rascunho.`,
          variant: "destructive",
        });
        return;
      }
    }
    const rmeId = await saveRME(true);
    if (rmeId) {
      const { notifyRMESubmitted } = await import('@/shared/services/notificationStrategies');
      notifyRMESubmitted(rmeId).catch((e) => console.warn('notifyRMESubmitted failed:', e));
      navigate(`/work-orders/${formData.ordem_servico_id}`);
    }
  };

  const updateChecklistItem = async (itemId: string, checked: boolean) => {
    if (isLocked) {
      toast({ title: "RME bloqueado para edição", description: "Aguarde a avaliação. Edição só é liberada se o avaliador recusar.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("rme_checklist_items").update({ checked }).eq("id", itemId);
    if (!error) setChecklistItems(prev => prev.map(item => item.id === itemId ? { ...item, checked } : item));
  };

  const handleExportPDF = async () => {
    if (!formData.id) { toast({ title: "Salve o RME antes de exportar", variant: "destructive" }); return; }
    setExporting(true);
    try {
      const checklistsByCategory = checklistItems.reduce((acc: any, item: any) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push({ label: item.label, checked: item.checked });
        return acc;
      }, {});
      const checklists = Object.entries(checklistsByCategory).map(([category, items]) => ({ category, items: items as { label: string; checked: boolean }[] }));
      const pdfData: RMEPDFData = {
        numero_os: workOrder?.numero_os || "",
        cliente: formData.client_name,
        endereco: formData.address,
        site_name: formData.site_name,
        ufv_solarz: formData.ufv_solarz || undefined,
        micro_number: formData.micro_number || undefined,
        inverter_number: formData.inverter_number || undefined,
        tecnico_nome: tecnicoNome || profile?.nome || "Técnico",
        collaboration: formData.collaboration,

        data_execucao: formData.data_execucao,
        data_fim_execucao: formData.data_fim_execucao,
        weekday: formData.weekday,
        shift: formData.shift,
        start_time: formData.start_time,
        end_time: formData.end_time,
        service_type: formData.service_type,

        checklists,

        images_posted: formData.images_posted,
        modules_cleaned_qty: formData.modules_cleaned_qty,
        string_box_qty: formData.string_box_qty,
        fotos_antes_count: formData.fotos_antes.length,
        fotos_depois_count: formData.fotos_depois.length,
        fotos_antes_urls: formData.fotos_antes,
        fotos_depois_urls: formData.fotos_depois,

        materiais_utilizados: formData.materiais_utilizados,
        servicos_executados: formData.servicos_executados,
        condicoes_encontradas: formData.condicoes_encontradas,

        assinatura_tecnico: formData.assinatura_tecnico || undefined,
        assinatura_cliente: formData.assinatura_cliente || undefined,
        nome_cliente_assinatura: formData.nome_cliente_assinatura || undefined,
        signatures: formData.signatures,

        status: formData.status || "rascunho",
      };
      await downloadRMEPDF(pdfData, `RME_${workOrder?.numero_os || "draft"}.pdf`);
      toast({ title: "PDF exportado com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao exportar PDF", description: error.message, variant: "destructive" });
    } finally { setExporting(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/work-orders/${formData.ordem_servico_id}`)}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">RME - {workOrder?.numero_os}</h1>
              <p className="text-sm text-muted-foreground">{formData.client_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {formData.id && (
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} title="Exportar PDF">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">PDF</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => saveRME(false)} disabled={saving || isLocked} title={isLocked ? "RME aguardando avaliação — edição bloqueada" : "Salvar rascunho"}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Salvar</span>
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-3">
            {STEPS.map(step => (
              <button key={step.id} onClick={() => formData.id && setCurrentStep(step.id)} disabled={!formData.id && step.id > 1}
                className={cn("flex flex-col items-center gap-1 text-xs transition-colors", currentStep === step.id ? "text-primary font-medium" : currentStep > step.id ? "text-muted-foreground" : "text-muted-foreground/50")}>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium", currentStep === step.id ? "bg-primary text-primary-foreground" : currentStep > step.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="hidden sm:block">{step.shortTitle}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {formData.status === "aprovado" && (
          <div className="mb-4 rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-900 dark:text-green-200">
            <strong>RME aprovado.</strong> O relatório foi aprovado e está finalizado. Edição bloqueada — apenas visualização e impressão de PDF.
          </div>
        )}
        {formData.status === "pendente" && (
          <div className="mb-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-900 dark:text-yellow-200">
            <strong>RME aguardando aprovação.</strong> A edição está bloqueada — apenas visualização e impressão de PDF. Será liberada apenas se o avaliador rejeitar o relatório.
          </div>
        )}
        {formData.status === "rejeitado" && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:text-red-200">
            <strong>RME rejeitado.</strong> Revise os pontos apontados pelo avaliador, edite o relatório e re-submeta para nova aprovação.
          </div>
        )}
        <RMEInsumosPanel rmeId={formData.id} rmeStatus={formData.status} />
        <Card><CardContent className="p-4 sm:p-6">
          {currentStep === 1 && <StepIdentification formData={formData} updateFormData={updateFormData} availableTechnicians={availableTechnicians} />}
          {currentStep === 2 && <StepServiceShift formData={formData} updateFormData={updateFormData} />}
          {currentStep === 3 && <StepChecklists checklistItems={checklistItems} updateChecklistItem={updateChecklistItem} categories={["conexoes", "eletrica", "internet"]} />}
          {currentStep === 4 && <StepEvidence formData={formData} updateFormData={updateFormData} rmeId={formData.id} osId={formData.ordem_servico_id} />}
          {currentStep === 5 && <StepToolsEPIs checklistItems={checklistItems} updateChecklistItem={updateChecklistItem} categories={["ferramentas", "epis", "medidas_preventivas"]} />}
          {currentStep === 6 && <StepSignatures formData={formData} updateFormData={updateFormData} tecnicoNome={tecnicoNome || profile?.nome || ""} />}
        </CardContent></Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1} className="flex-1 h-12">Anterior</Button>
          {isLocked ? (
            <div className="flex-1 h-12 flex items-center justify-center text-sm text-muted-foreground border rounded-md px-4 text-center">
              {formData.status === "aprovado" ? "RME aprovado — somente leitura" : "RME aguardando aprovação — somente leitura"}
            </div>
          ) : currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={saving} className="flex-1 h-12">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Próximo</Button>
          ) : isResponsavel ? (
            <Button
              onClick={handleFinalize}
              disabled={saving}
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {formData.status === "rejeitado" ? "Re-submeter RME" : "Concluir RME"}
            </Button>
          ) : (
            <div className="flex-1 h-12 flex items-center justify-center text-sm text-muted-foreground border rounded-md px-4 text-center">
              Apenas o Técnico Responsável pode concluir o RME
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMEWizard;
