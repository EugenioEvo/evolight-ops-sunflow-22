import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

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
  if (!rme) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendente: { label: 'Pendente', variant: 'outline' },
      aprovado: { label: 'Aprovado', variant: 'default' },
      rejeitado: { label: 'Rejeitado', variant: 'destructive' },
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do RME</span>
            {getStatusBadge(rme.status_aprovacao)}
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
                    <div key={index} className="flex justify-between text-sm border-b pb-2">
                      <span>{material.nome}</span>
                      <span className="font-medium">Qtd: {material.quantidade}</span>
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
              <div className="grid grid-cols-2 gap-4">
                {rme.assinatura_tecnico && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Técnico:</h4>
                    <img
                      src={rme.assinatura_tecnico}
                      alt="Assinatura Técnico"
                      className="border rounded p-2 bg-white"
                    />
                  </div>
                )}
                {rme.assinatura_cliente && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">
                      Cliente ({rme.nome_cliente_assinatura}):
                    </h4>
                    <img
                      src={rme.assinatura_cliente}
                      alt="Assinatura Cliente"
                      className="border rounded p-2 bg-white"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Aprovação */}
          {rme.status_aprovacao !== 'pendente' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informações de Aprovação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  {getStatusBadge(rme.status_aprovacao)}
                </div>
                {rme.data_aprovacao && (
                  <div>
                    <span className="font-medium">Data:</span>{' '}
                    {format(new Date(rme.data_aprovacao), 'dd/MM/yyyy HH:mm')}
                  </div>
                )}
                {rme.profiles && (
                  <div>
                    <span className="font-medium">Aprovado por:</span>{' '}
                    {rme.profiles.nome}
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
