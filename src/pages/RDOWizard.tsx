import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, Loader2, Plus, Save, Send, Trash2, Upload, X } from 'lucide-react';
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

function EvidenciaThumb({ path, onRemove }: { path: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    rdoService.signedUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  return (
    <div className="relative group">
      {url ? <img src={url} alt="" className="w-full h-24 object-cover rounded-md" /> : <div className="w-full h-24 bg-muted rounded-md animate-pulse" />}
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

  useEffect(() => {
    const r = rdoQ.data;
    if (!r) return;
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
    setEquipe(r.equipe);
    setAtividades(r.atividades);
    setEquipamentos(r.equipamentos);
    setStatus(r.status);
  }, [rdoQ.data]);

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
  }), [obraId, dataRdo, turno, clima, temperatura, horarioInicio, horarioFim, condicoesCanteiro, observacoes, ocorrencias, atrasos, restricoes]);

  async function ensureDraftCreated(): Promise<string> {
    if (rdoId) return rdoId;
    if (!obraId) throw new Error('Selecione uma obra');
    if (!dataRdo) throw new Error('Informe a data do RDO');
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

  async function handleUploadEvidencia(file: File, tipo: 'antes' | 'depois' | 'ocorrencia' | 'epi') {
    try {
      const id = await ensureDraftCreated();
      await rdoService.uploadEvidencia(id, file, tipo);
      qc.invalidateQueries({ queryKey: ['rdo', id] });
      toast.success('Evidência enviada');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao enviar evidência');
    }
  }

  if (rdoId && rdoQ.isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>;
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
          <div>
            <Label>Clima</Label>
            <Select value={clima} onValueChange={setClima} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CLIMA_OPTIONS.map((c) => <SelectItem key={c} value={c}>{CLIMA_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Temperatura (°C)</Label>
            <Input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início</Label>
              <Input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Condições do canteiro</Label>
            <Textarea value={condicoesCanteiro} onChange={(e) => setCondicoesCanteiro(e.target.value)} rows={2} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

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
                        if (v) setEquipe([...equipe, { prestador_id: p.id, horas_trabalhadas: 8, horas_extras: 0 }]);
                        else setEquipe(equipe.filter((e) => e.prestador_id !== p.id));
                      }}
                    />
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.categoria === 'sup_eletromecanico' ? 'Sup. Eletromecânico' : 'Eletromecânico'}</p>
                    </div>
                    {checked && item && (
                      <>
                        <div className="w-24"><Label className="text-xs">Horas</Label><Input type="number" step="0.5" value={item.horas_trabalhadas ?? 0} onChange={(e) => { const n = [...equipe]; n[idx] = { ...item, horas_trabalhadas: Number(e.target.value) }; setEquipe(n); }} disabled={readOnly} /></div>
                        <div className="w-24"><Label className="text-xs">Extras</Label><Input type="number" step="0.5" value={item.horas_extras ?? 0} onChange={(e) => { const n = [...equipe]; n[idx] = { ...item, horas_extras: Number(e.target.value) }; setEquipe(n); }} disabled={readOnly} /></div>
                        <div className="w-32"><Label className="text-xs">Função</Label><Input value={item.funcao ?? ''} onChange={(e) => { const n = [...equipe]; n[idx] = { ...item, funcao: e.target.value }; setEquipe(n); }} disabled={readOnly} /></div>
                      </>
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
                    <Input type="number" min={0} max={100} value={a.percentual_avanco ?? ''}
                      onChange={(e) => { const n = [...atividades]; n[i] = { ...a, percentual_avanco: e.target.value ? Number(e.target.value) : null }; setAtividades(n); }}
                      disabled={readOnly} />
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

      {/* Ocorrências */}
      <Card>
        <CardHeader><CardTitle className="text-base">Observações & ocorrências</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Observações gerais</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={readOnly} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Ocorrências</Label><Textarea rows={2} value={ocorrencias} onChange={(e) => setOcorrencias(e.target.value)} disabled={readOnly} /></div>
            <div><Label>Atrasos</Label><Textarea rows={2} value={atrasos} onChange={(e) => setAtrasos(e.target.value)} disabled={readOnly} /></div>
            <div><Label>Restrições</Label><Textarea rows={2} value={restricoes} onChange={(e) => setRestricoes(e.target.value)} disabled={readOnly} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Evidências */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evidências fotográficas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(['antes', 'depois', 'ocorrencia', 'epi'] as const).map((tipo) => {
            const evs = (rdoQ.data?.evidencias ?? []).filter((e) => e.tipo === tipo);
            const labels: Record<string, string> = { antes: 'Antes', depois: 'Depois', ocorrencia: 'Ocorrências', epi: 'EPIs' };
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{labels[tipo]} ({evs.length})</Label>
                  {!readOnly && (
                    <label className="cursor-pointer inline-flex items-center text-sm text-primary">
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadEvidencia(f, tipo); e.currentTarget.value = ''; }} />
                      <Upload className="h-4 w-4 mr-1" /> Enviar
                    </label>
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
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>Limpar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 flex justify-end gap-2 z-30 sm:static sm:border-0 sm:p-0">
        <Button variant="outline" onClick={handleSave} disabled={saving || readOnly} className="min-h-11">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar rascunho
        </Button>
        {!readOnly && (
          <Button onClick={handleSubmit} disabled={saving} className="min-h-11">
            <Send className="h-4 w-4 mr-2" /> Enviar para aprovação
          </Button>
        )}
      </div>
    </div>
  );
}
