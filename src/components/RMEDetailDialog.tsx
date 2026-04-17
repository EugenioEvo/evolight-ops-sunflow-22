import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { downloadRMEPDF, RMEPDFData } from '@/utils/generateRMEPDF';
import { useToast } from '@/hooks/use-toast';
import { RME_STATUS_LABEL, RME_STATUS_BADGE_CLASS, normalizeRMEStatus } from '@/utils/rmeStatus';

interface RMEDetailDialogProps {
  open: boolean;
  onClose: () => void;
  rme: any;
}

export const RMEDetailDialog: React.FC<RMEDetailDialogProps> = ({
  open,
  onClose,
  rme,
}) => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  if (!rme) return null;

  const handleExportPDF = async () => {
    try {
      setExporting(true);

      const { data: checklistItems } = await supabase
        .from('rme_checklist_items')
        .select('*')
        .eq('rme_id', rme.id)
        .order('category, item_key');

      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('numero_os')
        .eq('id', rme.ordem_servico_id)
        .single();

      const checklistMap: Record<string, { label: string; checked: boolean }[]> = {};
      (checklistItems || []).forEach((item: any) => {
        if (!checklistMap[item.category]) checklistMap[item.category] = [];
        checklistMap[item.category].push({ label: item.label, checked: !!item.checked });
      });

      const pdfData: RMEPDFData = {
        numero_os: osData?.numero_os || '-',
        cliente: rme.tickets?.clientes?.empresa || '-',
        endereco: rme.tickets?.clientes?.endereco || '-',
        site_name: rme.site_name || '-',
        data_execucao: format(new Date(rme.data_execucao), 'dd/MM/yyyy'),
        weekday: rme.weekday || '-',
        shift: rme.shift || '-',
        start_time: rme.start_time || '-',
        end_time: rme.end_time || '-',
        service_type: Array.isArray(rme.service_type) ? rme.service_type : [],
        collaboration: Array.isArray(rme.collaboration) ? rme.collaboration : [],
        checklists: Object.entries(checklistMap).map(([category, items]) => ({ category, items })),
        images_posted: !!rme.images_posted,
        modules_cleaned_qty: rme.modules_cleaned_qty || 0,
        string_box_qty: rme.string_box_qty || 0,
        fotos_antes_count: rme.fotos_antes?.length || 0,
        fotos_depois_count: rme.fotos_depois?.length || 0,
        materiais_utilizados: Array.isArray(rme.materiais_utilizados)
          ? rme.materiais_utilizados.map((m: any) => ({
              descricao: m.nome || m.descricao || '-',
              quantidade: m.quantidade || 0,
              tinha_estoque: !!m.tinha_estoque,
            }))
          : [],
        servicos_executados: rme.servicos_executados || '-',
        condicoes_encontradas: rme.condicoes_encontradas || '-',
        signatures: rme.signatures || {},
        tecnico_nome: rme.tecnicos?.profiles?.nome || '-',
        status: normalizeRMEStatus(rme.status),
        ufv_solarz: rme.tickets?.clientes?.ufv_solarz || undefined,
        fotos_antes_urls: Array.isArray(rme.fotos_antes) ? rme.fotos_antes : [],
        fotos_depois_urls: Array.isArray(rme.fotos_depois) ? rme.fotos_depois : [],
        assinatura_tecnico: rme.assinatura_tecnico || undefined,
        assinatura_cliente: rme.assinatura_cliente || undefined,
        nome_cliente_assinatura: rme.nome_cliente_assinatura || undefined,
      };

      await downloadRMEPDF(pdfData, `RME_${osData?.numero_os || rme.id}.pdf`);
      toast({ title: 'PDF exportado com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar', description: error.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (rawStatus: string) => {
    const status = normalizeRMEStatus(rawStatus);
    return (
      <Badge variant="outline" className={RME_STATUS_BADGE_CLASS[status]}>
        {RME_STATUS_LABEL[status]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do RME</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exporting}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Imprimir
              </Button>
              {getStatusBadge(rme.status)}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações do Chamado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Ticket:</span>{' '}
                  {rme.tickets?.numero_ticket}
                </div>
                <div>
                  <span className="font-medium">Título:</span>{' '}
                  {rme.tickets?.titulo}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Cliente:</span>{' '}
                  {rme.tickets?.clientes?.empresa}
                  <span className="text-blue-600 text-sm">(P{(rme.tickets?.clientes as any)?.prioridade ?? 5})</span>
                </div>
                <div>
                  <span className="font-medium">Técnico:</span>{' '}
                  {rme.tecnicos?.profiles?.nome}
                </div>
                <div>
                  <span className="font-medium">Data de Execução:</span>{' '}
                  {format(new Date(rme.data_execucao), 'dd/MM/yyyy')}
                </div>
                <div>
                  <span className="font-medium">Data de Preenchimento:</span>{' '}
                  {format(new Date(rme.data_preenchimento), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Condições e Serviços */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Condições e Serviços Executados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Condições Encontradas:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {rme.condicoes_encontradas}
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2">Serviços Executados:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {rme.servicos_executados}
                </p>
              </div>
              {rme.testes_realizados && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Testes Realizados:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {rme.testes_realizados}
                    </p>
                  </div>
                </>
              )}
              {rme.observacoes_tecnicas && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Observações Técnicas:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {rme.observacoes_tecnicas}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Medições Elétricas */}
          {rme.medicoes_eletricas && Object.keys(rme.medicoes_eletricas).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Medições Elétricas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {Object.entries(rme.medicoes_eletricas).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <div key={key}>
                        <span className="font-medium capitalize">
                          {key.replace('_', ' ')}:
                        </span>{' '}
                        {String(value)}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Materiais */}
          {rme.materiais_utilizados && rme.materiais_utilizados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Materiais Utilizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rme.materiais_utilizados.map((material: any, index: number) => (
                    <div key={index} className="flex justify-between gap-4 text-sm border-b pb-2">
                      <span>{material.descricao || material.nome || 'Material sem nome'}</span>
                      <span className="font-medium whitespace-nowrap">Qtd: {material.quantidade ?? 0}{material.tinha_estoque !== undefined ? ` · ${material.tinha_estoque ? 'Em estoque' : 'Sem estoque'}` : ''}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fotos */}
          {((rme.fotos_antes && rme.fotos_antes.length > 0) ||
            (rme.fotos_depois && rme.fotos_depois.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fotos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rme.fotos_antes && rme.fotos_antes.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Antes:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {rme.fotos_antes.map((url: string, index: number) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Antes ${index + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {rme.fotos_depois && rme.fotos_depois.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Depois:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {rme.fotos_depois.map((url: string, index: number) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Depois ${index + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assinaturas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Assinaturas</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const sigs = rme.signatures as Record<string, any> | null;
                const roleLabels: Record<string, string> = {
                  responsavel: 'Responsável Técnico',
                  gerente_manutencao: 'Gerente de Manutenção',
                  gerente_projeto: 'Gerente de Projeto',
                };
                const hasJsonSigs = sigs && Object.keys(roleLabels).some(k => sigs[k]?.nome);
                const hasLegacy = rme.assinatura_tecnico || rme.assinatura_cliente;

                if (!hasJsonSigs && !hasLegacy) {
                  return <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada.</p>;
                }

                return (
                  <div className="space-y-4">
                    {hasJsonSigs && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleLabels).map(([key, label]) => {
                          const sig = sigs?.[key];
                          if (!sig?.nome) return null;
                          return (
                            <div key={key} className="border rounded p-3 space-y-1">
                              <h4 className="font-medium text-sm">{label}</h4>
                              <p className="text-sm">{sig.nome}</p>
                              {sig.at && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(sig.at), 'dd/MM/yyyy HH:mm')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {hasLegacy && (
                      <div className="grid grid-cols-2 gap-4">
                        {rme.assinatura_tecnico && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Técnico:</h4>
                            <img src={rme.assinatura_tecnico} alt="Assinatura Técnico" className="border rounded p-2 bg-white" />
                          </div>
                        )}
                        {rme.assinatura_cliente && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Cliente ({rme.nome_cliente_assinatura}):</h4>
                            <img src={rme.assinatura_cliente} alt="Assinatura Cliente" className="border rounded p-2 bg-white" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Aprovação */}
          {(rme.status === 'aprovado' || rme.status === 'rejeitado') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informações de Aprovação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  {getStatusBadge(rme.status)}
                </div>
                {rme.data_aprovacao && (
                  <div>
                    <span className="font-medium">Data:</span>{' '}
                    {format(new Date(rme.data_aprovacao), 'dd/MM/yyyy HH:mm')}
                  </div>
                )}
                {rme.aprovador?.nome && (
                  <div>
                    <span className="font-medium">
                      {rme.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por:
                    </span>{' '}
                    {rme.aprovador.nome}
                  </div>
                )}
                {rme.observacoes_aprovacao && (
                  <div>
                    <span className="font-medium">Observações:</span>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                      {rme.observacoes_aprovacao}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
