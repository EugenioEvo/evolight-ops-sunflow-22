import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, Check, FileDown, Loader2, Plus, Save, Send, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadRDOPDF } from '@/utils/generateRDOPDF';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { useAuth } from '@/hooks/useAuth';
import { rdoService, type RDOAtividade, type RDOEquipamento, type RDOEquipe } from '@/features/rdo/services/rdoService';
import { CLIMA_LABEL, CLIMA_OPTIONS, TURNO_LABEL, TURNO_OPTIONS } from '@/features/rdo/types';

const STAFF_ROLES = ['admin', 'engenharia', 'supervisao'];

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-muted-foreground mt-1">{children}</p>;
}

function EvidenciaThumb({ path, onRemove }: { path: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    rdoService.signedUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  const isVideo = /\.(mp4|webm|mov|m4v|ogg)$/i.test(path);
  return (
    <div className="relative group">
      {url ? (
        isVideo ? (
          <video src={url} controls className="w-full h-24 object-cover rounded-md bg-black" />
        ) : (
          <img src={url} alt="" className="w-full h-24 object-cover rounded-md" />
        )
      ) : (
        <div className="w-full h-24 bg-muted rounded-md animate-pulse" />
      )}
      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function RDOWizard() {
  const { id: routeId } = useParams<{ id: string }>();
  const isNew = !routeId || routeId === 'novo';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const isStaff = profile?.roles?.some((r) => STAFF_ROLES.includes(r)) ?? false;

  const [rdoId, setRdoId] = useState<string | null>(isNew ? null : routeId!);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Header
  const [obraId, setObraId] = useState<string>('');
  const [dataRdo, setDataRdo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState<string>('');
  const [clima, setClima] = useState<string>('');
  const [temperatura, setTemperatura] = useState<string>('');
  const [horarioInicio, setHorarioInicio] = useState<string>('');
  const [horarioFim, setHorarioFim] = useState<string>('');
  const [condicoesCanteiro, setCondicoesCanteiro] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [ocorrencias, setOcorrencias] = useState<string>('');
  const [atrasos, setAtrasos] = useState<string>('');
  const [restricoes, setRestricoes] = useState<string>('');
  const [horasParadasProg, setHorasParadasProg] = useState<string>('');
  const [horasParadasNaoProg, setHorasParadasNaoProg] = useState<string>('');
  const [tempLoading, setTempLoading] = useState(false);

  // Sections
  const [equipe, setEquipe] = useState<RDOEquipe[]>([]);
  const [atividades, setAtividades] = useState<RDOAtividade[]>([]);
  const [equipamentos, setEquipamentos] = useState<RDOEquipamento[]>([]);
  const [status, setStatus] = useState<string>('rascunho');

  // Máscara de hora: aceita "0800" -> "08:00", "8" -> "8", "830" -> "8:30", "2360" -> "23:60" (validação acontece depois)
  const maskTime = (raw: string) => {
    const digits = (raw ?? '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };


  // Default horas trabalhadas = (fim - inicio) - paradas (prog + não prog)
  const defaultHorasTrabalhadas = (() => {
    const toMin = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s ?? '');
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const ini = toMin(horarioInicio);
    const fim = toMin(horarioFim);
    if (ini == null || fim == null || fim <= ini) return 8;
    const bruto = (fim - ini) / 60;
    const parseBr = (s: string) => Number(String(s ?? '').replace(',', '.')) || 0;
    const paradas = parseBr(horasParadasProg) + parseBr(horasParadasNaoProg);
    const liquido = Math.max(0, bruto - paradas);
    return Math.round(liquido * 2) / 2;
  })();

  const recalculateEquipeHoras = (lista: RDOEquipe[], horas = defaultHorasTrabalhadas) =>
    lista.map((e) => ({ ...e, horas_trabalhadas: horas }));

  // Ao entrar no step 2, recalcula horas trabalhadas de toda a equipe marcada
  useEffect(() => {
    if (step !== 2 || readOnly) return;
    setEquipe((prev) =>
      prev.length === 0 || prev.every((e) => e.horas_trabalhadas === defaultHorasTrabalhadas)
        ? prev
        : prev.map((e) => ({ ...e, horas_trabalhadas: defaultHorasTrabalhadas })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, defaultHorasTrabalhadas]);

  const sigRef = useRef<SignatureCanvas | null>(null);

  // Lookups
  const obrasQ = useQuery({ queryKey: ['rdo-obras-ativas'], queryFn: () => rdoService.listObrasAtivas() });
  const catalogoQ = useQuery({ queryKey: ['rdo-catalogo'], queryFn: () => rdoService.listCatalogo() });
  const eletroQ = useQuery({ queryKey: ['rdo-eletro'], queryFn: () => rdoService.listEletromecanicos() });

  // Existing RDO
  const rdoQ = useQuery({
    queryKey: ['rdo', rdoId],
    queryFn: () => (rdoId ? rdoService.getById(rdoId) : Promise.resolve(null)),
    enabled: !!rdoId,
  });

  // Hidrata o formulário UMA vez por rdoId (evita "piscar" / sobrescrever edições locais
  // após cada invalidação/refetch de rdoQ).
  const hydratedForRef = useRef<string | null>(null);
  useEffect(() => {
    const r = rdoQ.data;
    if (!r) return;
    if (hydratedForRef.current === r.id) return;
    hydratedForRef.current = r.id;
    setObraId(r.obra_id);
    setDataRdo(r.data_rdo);
    setTurno(r.turno ?? '');
    setClima(r.clima ?? '');
    setTemperatura(r.temperatura_c != null ? String(r.temperatura_c) : '');
    setHorarioInicio(r.horario_inicio ?? '');
    setHorarioFim(r.horario_fim ?? '');
    setCondicoesCanteiro(r.condicoes_canteiro ?? '');
    setObservacoes(r.observacoes_gerais ?? '');
    setOcorrencias(r.ocorrencias ?? '');
    setAtrasos(r.atrasos ?? '');
    setRestricoes(r.restricoes ?? '');
    setHorasParadasProg((r as any).horas_paradas_programadas != null ? String((r as any).horas_paradas_programadas) : '');
    setHorasParadasNaoProg((r as any).horas_paradas_nao_programadas != null ? String((r as any).horas_paradas_nao_programadas) : '');
    setEquipe(r.equipe);
    setAtividades(r.atividades);
    setEquipamentos(r.equipamentos);
    setStatus(r.status);
  }, [rdoQ.data]);

  // Status sempre acompanha o backend (aprovação/rejeição vindas via refetch).
  useEffect(() => {
    if (rdoQ.data?.status && rdoQ.data.status !== status) setStatus(rdoQ.data.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdoQ.data?.status]);

  const readOnly = !isStaff && status !== 'rascunho' && status !== 'rejeitado';

  const headerPatch = useMemo(() => ({
    obra_id: obraId,
    data_rdo: dataRdo,
    turno: turno || null,
    clima: clima || null,
    temperatura_c: temperatura ? Number(temperatura) : null,
    horario_inicio: horarioInicio || null,
    horario_fim: horarioFim || null,
    condicoes_canteiro: condicoesCanteiro || null,
    observacoes_gerais: observacoes || null,
    ocorrencias: ocorrencias || null,
    atrasos: atrasos || null,
    restricoes: restricoes || null,
    horas_paradas_programadas: horasParadasProg ? Number(String(horasParadasProg).replace(',', '.')) : null,
    horas_paradas_nao_programadas: horasParadasNaoProg ? Number(String(horasParadasNaoProg).replace(',', '.')) : null,
  }), [obraId, dataRdo, turno, clima, temperatura, horarioInicio, horarioFim, condicoesCanteiro, observacoes, ocorrencias, atrasos, restricoes, horasParadasProg, horasParadasNaoProg]);

  // Auto-fetch average temperature from Open-Meteo (free, no API key)
  // when obra (with coords), data, início e fim estão preenchidos.
  useEffect(() => {
    if (readOnly) return;
    const obra = (obrasQ.data ?? []).find((o) => o.id === obraId);
    if (!obra?.latitude || !obra?.longitude) return;
    if (!dataRdo || !horarioInicio || !horarioFim) return;
    const sh = parseInt(horarioInicio.slice(0, 2), 10);
    const eh = parseInt(horarioFim.slice(0, 2), 10);
    if (Number.isNaN(sh) || Number.isNaN(eh) || eh < sh) return;

    let cancelled = false;
    setTempLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${obra.latitude}&longitude=${obra.longitude}&hourly=temperature_2m,weathercode&start_date=${dataRdo}&end_date=${dataRdo}&timezone=America%2FSao_Paulo`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const temps: number[] = j?.hourly?.temperature_2m ?? [];
        const tslice = temps.slice(sh, eh + 1).filter((t) => typeof t === 'number');
        if (tslice.length > 0) {
          const avg = tslice.reduce((a, b) => a + b, 0) / tslice.length;
          // Só preenche se o usuário ainda não digitou nada — evita sobrescrever edições manuais.
          setTemperatura((cur) => (cur && cur.trim() !== '' ? cur : avg.toFixed(1)));
        }
        const codes: number[] = (j?.hourly?.weathercode ?? []).slice(sh, eh + 1);
        if (codes.length > 0) {
          // WMO weather code → CLIMA_OPTIONS
          const cat = (c: number): 'ensolarado' | 'nublado' | 'chuvoso' | 'chuva_forte' => {
            if (c === 0 || c === 1) return 'ensolarado';
            if (c === 2 || c === 3 || c === 45 || c === 48) return 'nublado';
            if (c === 65 || c === 82 || (c >= 95 && c <= 99)) return 'chuva_forte';
            return 'chuvoso';
          };
          const counts: Record<string, number> = {};
          codes.forEach((c) => { const k = cat(c); counts[k] = (counts[k] ?? 0) + 1; });
          const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const dominant = entries[0][0];
          const dominantShare = entries[0][1] / codes.length;
          const sugerido = entries.length > 1 && dominantShare < 0.7 ? 'misto' : dominant;
          // Só preenche se o usuário ainda não escolheu manualmente.
          setClima((cur) => (cur && cur.trim() !== '' ? cur : sugerido));
        }
      })
      .catch(() => { /* keep silent — fallback é manual */ })
      .finally(() => { if (!cancelled) setTempLoading(false); });
    return () => { cancelled = true; };
  }, [obraId, dataRdo, horarioInicio, horarioFim, obrasQ.data, readOnly]);

  // Pre-check: existing active RDO for (obra, data). Debounce para evitar refetch a cada
  // tecla/seleção e usar placeholderData para não "piscar" o aviso bloqueante.
  const obraIdDeb = useDebounce(obraId, 400);
  const dataRdoDeb = useDebounce(dataRdo, 400);
  const existingRdoQ = useQuery({
    queryKey: ['rdo-existing', obraIdDeb, dataRdoDeb],
    queryFn: () => rdoService.findActiveByObraData(obraIdDeb, dataRdoDeb),
    enabled: isNew && !!obraIdDeb && !!dataRdoDeb,
    placeholderData: keepPreviousData,
  });
  const blockingExistingRdo =
    isNew && existingRdoQ.data && existingRdoQ.data.id !== rdoId ? existingRdoQ.data : null;

  async function ensureDraftCreated(): Promise<string> {
    if (rdoId) return rdoId;
    if (!obraId) throw new Error('Selecione uma obra');
    if (!dataRdo) throw new Error('Informe a data do RDO');
    // Re-check on submit to avoid race with the unique index
    const existing = await rdoService.findActiveByObraData(obraId, dataRdo);
    if (existing) {
      throw new Error(
        `Já existe um RDO (${existing.numero_rdo}) para esta obra na data ${dataRdo}. Abra-o para editar ou escolha outra data.`,
      );
    }
    const respId = profile?.id ? await rdoService.getCurrentPrestadorId(profile.id) : null;
    if (!respId) throw new Error('Seu cadastro de prestador não foi localizado. Conclua sua aprovação primeiro.');
    const id = await rdoService.createDraft({
      obra_id: obraId,
      data_rdo: dataRdo,
      responsavel_id: respId,
      turno: turno || null,
      clima: clima || null,
      temperatura_c: temperatura ? Number(temperatura) : null,
      horario_inicio: horarioInicio || null,
      horario_fim: horarioFim || null,
      condicoes_canteiro: condicoesCanteiro || null,
    });
    setRdoId(id);
    navigate(`/rdo/${id}`, { replace: true });
    return id;
  }

  async function handleSave() {
    try {
      setSaving(true);
      const id = await ensureDraftCreated();
      await rdoService.updateHeader(id, headerPatch);
      await Promise.all([
        rdoService.replaceEquipe(id, equipe),
        rdoService.replaceAtividades(id, atividades),
        rdoService.replaceEquipamentos(id, equipamentos),
      ]);
      qc.invalidateQueries({ queryKey: ['rdo', id] });
      qc.invalidateQueries({ queryKey: ['rdo-relatorios'] });
      toast.success('RDO salvo');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar RDO');
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(equipeAtual = equipe) {
    const id = await ensureDraftCreated();
    await rdoService.updateHeader(id, headerPatch);
    await Promise.all([
      rdoService.replaceEquipe(id, equipeAtual),
      rdoService.replaceAtividades(id, atividades),
      rdoService.replaceEquipamentos(id, equipamentos),
    ]);
    qc.invalidateQueries({ queryKey: ['rdo', id] });
    qc.invalidateQueries({ queryKey: ['rdo-relatorios'] });
  }

  async function handleSubmit() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error('Assine antes de enviar para aprovação');
      return;
    }
    if (equipe.length === 0) { toast.error('Adicione pelo menos um membro à equipe'); return; }
    if (atividades.length === 0) { toast.error('Adicione pelo menos uma atividade'); return; }
    try {
      setSaving(true);
      await handleSave();
      const id = rdoId!;
      await rdoService.submitForApproval(id, sigRef.current.toDataURL());
      qc.invalidateQueries({ queryKey: ['rdo', id] });
      qc.invalidateQueries({ queryKey: ['rdo-relatorios'] });
      toast.success('RDO enviado para aprovação');
      navigate('/rdo');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao enviar RDO');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadEvidencias(files: FileList | null, tipo: 'antes' | 'depois' | 'ocorrencia' | 'epi') {
    if (!files || files.length === 0) return;
    try {
      const id = await ensureDraftCreated();
      const arr = Array.from(files);
      let ok = 0;
      for (const f of arr) {
        try { await rdoService.uploadEvidencia(id, f, tipo); ok++; }
        catch (e: any) { toast.error(`${f.name}: ${e?.message ?? 'falha'}`); }
      }
      qc.invalidateQueries({ queryKey: ['rdo', id] });
      if (ok > 0) toast.success(`${ok} evidência(s) enviada(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao enviar evidência');
    }
  }

  if (rdoId && rdoQ.isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const STEPS = [
    { n: 1 as const, label: 'Identificação' },
    { n: 2 as const, label: 'Execução' },
    { n: 3 as const, label: 'Revisão & Envio' },
  ];

  async function handleNext() {
    if (step === 1) {
      if (!obraId) { toast.error('Selecione a obra'); return; }
      if (!dataRdo) { toast.error('Informe a data'); return; }
    }
    if (step === 2) {
      if (equipe.length === 0) { toast.error('Adicione pelo menos um membro à equipe'); return; }
      if (atividades.length === 0) { toast.error('Adicione pelo menos uma atividade'); return; }
    }
    const nextStep = (step < 3 ? ((step + 1) as 1 | 2 | 3) : step);
    const equipeAtual = step === 1 && nextStep === 2 ? recalculateEquipeHoras(equipe) : equipe;
    if (equipeAtual !== equipe) setEquipe(equipeAtual);
    try {
      setSaving(true);
      await saveDraft(equipeAtual);
      toast.success('RDO salvo');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar RDO');
    } finally {
      setSaving(false);
    }
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl pb-32">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rdo')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">
            {rdoQ.data?.numero_rdo ?? (isNew ? 'Novo RDO' : 'RDO')}
          </h1>
          <p className="text-sm text-muted-foreground">Status: <Badge variant="outline">{status}</Badge></p>
        </div>
        {rdoId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              try {
                const data = await rdoService.buildPDFData(rdoId);
                if (data) await downloadRDOPDF(data);
                else toast.error('Não foi possível gerar o PDF');
              } catch (e: any) {
                toast.error(e?.message ?? 'Falha ao gerar PDF');
              }
            }}
          >
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2 px-1">
        {STEPS.map((s, idx) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setStep(s.n)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md transition-colors min-w-0',
                  active && 'text-foreground',
                  !active && 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className={cn(
                  'h-7 w-7 rounded-full grid place-items-center text-xs font-semibold border',
                  active && 'bg-primary text-primary-foreground border-primary',
                  done && 'bg-emerald-500 text-white border-emerald-500',
                  !active && !done && 'bg-muted border-border'
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="text-sm font-medium truncate">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-2" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
      <>

      {blockingExistingRdo && (
        <Card className="border-amber-500/60 bg-amber-500/10">
          <CardContent className="py-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Já existe um RDO para esta obra na data {dataRdo}
              </p>
              <p className="text-muted-foreground">
                RDO <strong>{blockingExistingRdo.numero_rdo}</strong> (status: {blockingExistingRdo.status}).
                Só é permitido um RDO ativo por obra/dia — abra o existente para editar ou escolha outra data.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/rdo/${blockingExistingRdo.id}`)}
            >
              Abrir RDO existente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Identificação */}
      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Obra *</Label>
            <Select value={obraId} onValueChange={setObraId} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder={obrasQ.isLoading ? 'Carregando...' : 'Selecione a obra'} /></SelectTrigger>
              <SelectContent>
                {(obrasQ.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}{o.cidade ? ` — ${o.cidade}/${o.estado ?? ''}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={dataRdo} onChange={(e) => setDataRdo(e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <Label>Turno</Label>
            <Select value={turno} onValueChange={setTurno} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TURNO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{TURNO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                pattern="^([01]\d|2[0-3]):[0-5]\d$"
                maxLength={5}
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(maskTime(e.target.value))}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Fim</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                pattern="^([01]\d|2[0-3]):[0-5]\d$"
                maxLength={5}
                value={horarioFim}
                onChange={(e) => setHorarioFim(maskTime(e.target.value))}
                disabled={readOnly}
              />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              Clima{tempLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </Label>
            <Select value={clima} onValueChange={setClima} disabled>
              <SelectTrigger><SelectValue placeholder="Preenchido automaticamente" /></SelectTrigger>
              <SelectContent>
                {CLIMA_OPTIONS.map((c) => <SelectItem key={c} value={c}>{CLIMA_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Inferido via Open-Meteo (códigos WMO) entre Início e Fim.
            </p>
          </div>
          <div>
            <Label className="flex items-center gap-2">
              Temperatura média (°C){tempLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </Label>
            <Input
              type="number"
              step="0.1"
              value={temperatura}
              readOnly
              disabled
              placeholder="Preenchida automaticamente"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Média horária Open-Meteo entre Início e Fim, baseada nas coordenadas da obra.
            </p>
          </div>

          <div>
            <Label>Horas paradas — programadas <span className="text-xs font-normal text-muted-foreground">(0,5 = 30min)</span></Label>
            <Input
              type="text"
              inputMode="decimal"
              value={horasParadasProg}
              onChange={(e) => setHorasParadasProg(e.target.value.replace(/[^0-9,.]/g, ''))}
              disabled={readOnly}
              placeholder="Almoço, lanche, etc."
            />
          </div>
          <div>
            <Label>Horas paradas — não programadas <span className="text-xs font-normal text-muted-foreground">(0,5 = 30min)</span></Label>
            <Input
              type="text"
              inputMode="decimal"
              value={horasParadasNaoProg}
              onChange={(e) => setHorasParadasNaoProg(e.target.value.replace(/[^0-9,.]/g, ''))}
              disabled={readOnly}
              placeholder="Falta de material, descarga, etc."
            />
          </div>
          <div className="md:col-span-2">
            <Label>Condições do canteiro</Label>
            <Textarea value={condicoesCanteiro} onChange={(e) => setCondicoesCanteiro(e.target.value)} rows={2} disabled={readOnly} placeholder="Ex.: piso úmido após chuva, área liberada, etc." />
            <Hint>Estado físico e logístico do canteiro: limpeza, acesso, áreas bloqueadas, segurança.</Hint>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {step === 2 && (
      <>
      {/* Equipe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Equipe presente</span>
            <span className="text-xs font-normal text-muted-foreground">{equipe.length} marcado(s)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {eletroQ.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <div className="space-y-2 max-h-72 overflow-auto pr-2">
              {(eletroQ.data ?? []).map((p) => {
                const idx = equipe.findIndex((e) => e.prestador_id === p.id);
                const checked = idx >= 0;
                const item = checked ? equipe[idx] : null;
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 p-2 rounded border">
                    <Checkbox
                      checked={checked}
                      disabled={readOnly}
                      onCheckedChange={(v) => {
                        if (v) setEquipe([...equipe, { prestador_id: p.id, horas_trabalhadas: defaultHorasTrabalhadas, horas_extras: 0 }]);
                        else setEquipe(equipe.filter((e) => e.prestador_id !== p.id));
                      }}
                    />
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.categoria === 'sup_eletromecanico' ? 'Sup. Eletromecânico' : 'Eletromecânico'}</p>
                    </div>
                    {checked && item && (
                      <div className="w-28"><Label className="text-xs">Horas</Label><Input type="number" step="0.5" value={item.horas_trabalhadas ?? 0} onChange={(e) => { const n = [...equipe]; n[idx] = { ...item, horas_trabalhadas: Number(e.target.value) }; setEquipe(n); }} disabled={readOnly} /></div>
                    )}
                  </div>
                );
              })}
              {(eletroQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum eletromecânico cadastrado.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Atividades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Atividades executadas</span>
            <Button type="button" variant="outline" size="sm" disabled={readOnly} onClick={() => setAtividades([...atividades, { quantidade: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {atividades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade adicionada.</p>
          ) : atividades.map((a, i) => {
            const cat = (catalogoQ.data ?? []).find((c) => c.id === a.catalogo_id);
            return (
              <div key={i} className="border rounded p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-5">
                    <Label className="text-xs">Item do catálogo (ou deixe livre)</Label>
                    <Select
                      value={a.catalogo_id ?? '__livre'}
                      onValueChange={(v) => {
                        const n = [...atividades];
                        if (v === '__livre') n[i] = { ...a, catalogo_id: null };
                        else {
                          const item = (catalogoQ.data ?? []).find((c) => c.id === v);
                          n[i] = { ...a, catalogo_id: v, descricao_livre: null, unidade: item?.unidade ?? a.unidade };
                        }
                        setAtividades(n);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__livre">— Descrição livre —</SelectItem>
                        {(catalogoQ.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.label} [{c.unidade}]</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" step="0.01" value={a.quantidade}
                      onChange={(e) => { const n = [...atividades]; n[i] = { ...a, quantidade: Number(e.target.value) }; setAtividades(n); }}
                      disabled={readOnly} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Unidade</Label>
                    <Input value={a.unidade ?? cat?.unidade ?? ''}
                      onChange={(e) => { const n = [...atividades]; n[i] = { ...a, unidade: e.target.value }; setAtividades(n); }}
                      disabled={readOnly || !!cat} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">% avanço</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={a.percentual_avanco ?? ''}
                      onChange={(e) => { const n = [...atividades]; n[i] = { ...a, percentual_avanco: e.target.value ? Number(e.target.value) : null }; setAtividades(n); }}
                      disabled={readOnly || !!a.catalogo_id}
                      placeholder={a.catalogo_id ? 'Auto (obra)' : ''}
                      title={a.catalogo_id ? 'Calculado automaticamente a partir das metas da obra' : undefined}
                    />
                  </div>
                </div>
                {!a.catalogo_id && (
                  <div>
                    <Label className="text-xs">Descrição livre *</Label>
                    <Input value={a.descricao_livre ?? ''}
                      onChange={(e) => { const n = [...atividades]; n[i] = { ...a, descricao_livre: e.target.value }; setAtividades(n); }}
                      disabled={readOnly} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Input value={a.observacoes ?? ''}
                    onChange={(e) => { const n = [...atividades]; n[i] = { ...a, observacoes: e.target.value }; setAtividades(n); }}
                    disabled={readOnly} />
                </div>
                {!readOnly && (
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAtividades(atividades.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Equipamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Equipamentos / EPIs mobilizados</span>
            <Button type="button" variant="outline" size="sm" disabled={readOnly} onClick={() => setEquipamentos([...equipamentos, { nome: '', quantidade: 1 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {equipamentos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum equipamento adicionado.</p> :
            equipamentos.map((e, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                <div className="col-span-6"><Label className="text-xs">Nome</Label><Input value={e.nome} onChange={(ev) => { const n = [...equipamentos]; n[i] = { ...e, nome: ev.target.value }; setEquipamentos(n); }} disabled={readOnly} /></div>
                <div className="col-span-2"><Label className="text-xs">Qtd</Label><Input type="number" min={1} value={e.quantidade} onChange={(ev) => { const n = [...equipamentos]; n[i] = { ...e, quantidade: Number(ev.target.value) }; setEquipamentos(n); }} disabled={readOnly} /></div>
                <div className="col-span-3"><Label className="text-xs">Obs</Label><Input value={e.observacoes ?? ''} onChange={(ev) => { const n = [...equipamentos]; n[i] = { ...e, observacoes: ev.target.value }; setEquipamentos(n); }} disabled={readOnly} /></div>
                <div className="col-span-1">
                  {!readOnly && <Button type="button" variant="ghost" size="icon" onClick={() => setEquipamentos(equipamentos.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
      </>
      )}

      {step === 3 && (
      <>
      {/* Ocorrências */}
      <Card>
        <CardHeader><CardTitle className="text-base">Observações & ocorrências</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Observações gerais</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={readOnly} placeholder="Resumo do dia, decisões e pontos de atenção." />
            <Hint>Use para registrar comentários gerais que não se encaixam nos outros campos.</Hint>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Ocorrências</Label>
              <Textarea rows={2} value={ocorrencias} onChange={(e) => setOcorrencias(e.target.value)} disabled={readOnly} placeholder="Acidentes, quase-acidentes, eventos atípicos." />
              <Hint>Registre eventos relevantes ocorridos durante a jornada.</Hint>
            </div>
            <div>
              <Label>Atrasos</Label>
              <Textarea rows={2} value={atrasos} onChange={(e) => setAtrasos(e.target.value)} disabled={readOnly} placeholder="Início tardio, parada por chuva, espera de equipamento." />
              <Hint>Causas e duração dos atrasos no avanço da obra.</Hint>
            </div>
            <div>
              <Label>Restrições</Label>
              <Textarea rows={2} value={restricoes} onChange={(e) => setRestricoes(e.target.value)} disabled={readOnly} placeholder="Falta de material, área bloqueada, pendência do cliente." />
              <Hint>Bloqueios que dependem de terceiros para serem resolvidos.</Hint>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidências */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evidências Audiovisuais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(['antes', 'depois', 'ocorrencia', 'epi'] as const).map((tipo) => {
            const evs = (rdoQ.data?.evidencias ?? []).filter((e) => e.tipo === tipo);
            const labels: Record<string, string> = { antes: 'Antes', depois: 'Depois', ocorrencia: 'Ocorrências', epi: 'EPIs' };
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>{labels[tipo]} ({evs.length})</Label>
                  {!readOnly && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="cursor-pointer inline-flex items-center text-sm text-primary px-2 py-1 rounded border border-input hover:bg-accent">
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={(e) => { handleUploadEvidencias(e.target.files, tipo); e.currentTarget.value = ''; }} />
                        <Camera className="h-4 w-4 mr-1" /> Foto
                      </label>
                      <label className="cursor-pointer inline-flex items-center text-sm text-primary px-2 py-1 rounded border border-input hover:bg-accent">
                        <input type="file" accept="video/*" capture="environment" className="hidden"
                          onChange={(e) => { handleUploadEvidencias(e.target.files, tipo); e.currentTarget.value = ''; }} />
                        <Camera className="h-4 w-4 mr-1" /> Vídeo
                      </label>
                      <label className="cursor-pointer inline-flex items-center text-sm text-primary px-2 py-1 rounded border border-input hover:bg-accent">
                        <input type="file" accept="image/*,video/*" multiple className="hidden"
                          onChange={(e) => { handleUploadEvidencias(e.target.files, tipo); e.currentTarget.value = ''; }} />
                        <Upload className="h-4 w-4 mr-1" /> Upload
                      </label>
                    </div>
                  )}
                </div>
                {evs.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {evs.map((e) => (
                      <EvidenciaThumb key={e.id} path={e.storage_path}
                        onRemove={async () => { await rdoService.removeEvidencia(e.id, e.storage_path); qc.invalidateQueries({ queryKey: ['rdo', rdoId] }); }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!rdoId && <p className="text-xs text-muted-foreground">Salve o RDO antes de enviar evidências.</p>}
        </CardContent>
      </Card>

      {/* Assinatura + envio */}
      {!readOnly && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assinatura do responsável</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="border-2 rounded-lg overflow-hidden bg-white">
              <SignatureCanvas ref={(r) => { sigRef.current = r; }} canvasProps={{ width: 600, height: 180, className: 'w-full' }} />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>Limpar</Button>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Responsável pelo preenchimento</p>
                <p className="text-sm font-medium">{profile?.nome ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}

      <Separator />

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 flex justify-between gap-2 z-30 sm:static sm:border-0 sm:p-0">
        <Button
          variant="outline"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1}
          className="min-h-11"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving || readOnly} className="min-h-11">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar rascunho
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={saving} className="min-h-11">
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            !readOnly && (
              <Button onClick={handleSubmit} disabled={saving} className="min-h-11">
                <Send className="h-4 w-4 mr-2" /> Enviar para aprovação
              </Button>
            )
          )}
        </div>
      </div>

    </div>
  );
}
