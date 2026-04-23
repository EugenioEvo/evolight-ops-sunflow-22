import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

type SyncRun = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_read: number;
  rows_upserted: number;
  error: string | null;
  triggered_by: string | null;
};

const STAFF_ROLES = ["admin", "engenharia", "supervisao"] as const;
const RUN_POLL_INTERVAL_MS = 5000;
const RUN_STALE_MS = 5 * 60 * 1000;

const isRunInProgress = (run?: SyncRun) => {
  if (!run || run.status !== "running") return false;
  return Date.now() - new Date(run.started_at).getTime() < RUN_STALE_MS;
};

const buildRunSummary = (run: SyncRun) =>
  `${run.rows_upserted} registros atualizados (${run.rows_read} lidos)`;

export function SyncClientesButton({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const { profile } = useAuth();
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<SyncRun[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trackedRunId, setTrackedRunId] = useState<string | null>(null);

  const isStaff = profile?.roles?.some((r) => STAFF_ROLES.includes(r as any)) ?? false;

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("sync_runs")
      .select("id, source, status, started_at, finished_at, rows_read, rows_upserted, error, triggered_by")
      .eq("source", "clientes-external")
      .order("started_at", { ascending: false })
      .limit(20);
    const runs = (data as SyncRun[]) ?? [];
    setHistory(runs);
    return runs;
  };

  const latestRun = useMemo(() => history[0] ?? null, [history]);
  const activeRun = useMemo(
    () => (latestRun && isRunInProgress(latestRun) ? latestRun : null),
    [latestRun],
  );

  useEffect(() => {
    if (!isStaff) return;
    fetchHistory();

    const channel = supabase
      .channel("sync_runs_clientes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sync_runs", filter: "source=eq.clientes-external" },
        () => fetchHistory(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStaff]);

  useEffect(() => {
    setRunning(Boolean(activeRun));
  }, [activeRun]);

  useEffect(() => {
    if (!isStaff || !activeRun) return;

    const interval = window.setInterval(() => {
      fetchHistory();
    }, RUN_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [activeRun, isStaff]);

  useEffect(() => {
    if (!trackedRunId) return;

    const trackedRun = history.find((run) => run.id === trackedRunId);
    if (!trackedRun || trackedRun.status === "running") return;

    if (trackedRun.status === "success") {
      toast.success(`Sincronização concluída: ${buildRunSummary(trackedRun)}.`, {
        id: "sync-clientes",
      });
      onSyncComplete?.();
    } else if (trackedRun.status === "partial") {
      toast.error(
        `Sincronização parcial: ${buildRunSummary(trackedRun)}${
          trackedRun.error ? `. ${trackedRun.error}` : ""
        }`,
        { id: "sync-clientes" },
      );
      onSyncComplete?.();
    } else {
      toast.error(`Falha na sincronização: ${trackedRun.error ?? "erro desconhecido"}`, {
        id: "sync-clientes",
      });
    }

    setTrackedRunId(null);
  }, [history, onSyncComplete, trackedRunId]);

  if (!isStaff) return null;

  const handleSync = async () => {
    let hasInProgressRun = false;
    setRunning(true);
    toast.loading("Sincronização iniciada — pode levar alguns segundos...", { id: "sync-clientes" });
    try {
      const { data, error } = await supabase.functions.invoke("sync-clientes-external");
      if (error) throw error;
      const summary = data as { rows_read: number; rows_upserted: number; status: string; errors_count: number };
      await fetchHistory();
      toast.success(
        `Sincronização ${summary.status}: ${summary.rows_upserted} registros atualizados (${summary.rows_read} lidos)${
          summary.errors_count ? `, ${summary.errors_count} erros` : ""
        }.`,
        { id: "sync-clientes" },
      );
      setTrackedRunId(null);
      onSyncComplete?.();
    } catch (e) {
      const runs = await fetchHistory();
      const inProgressRun = runs[0] && isRunInProgress(runs[0]) ? runs[0] : null;
      hasInProgressRun = Boolean(inProgressRun);

      if (inProgressRun) {
        setTrackedRunId(inProgressRun.id);
        toast.loading("Sincronização iniciada e ainda processando. Vou atualizar quando finalizar.", {
          id: "sync-clientes",
        });
      } else {
        toast.error(`Falha na sincronização: ${e instanceof Error ? e.message : String(e)}`, {
          id: "sync-clientes",
        });
      }
    } finally {
      setRunning(hasInProgressRun);
    }
  };

  const latest = activeRun ?? latestRun;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleSync}
        disabled={running}
        title="Sincronizar com Solarz e Conta Azul"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
        {running ? "Sincronizando..." : "Sincronizar agora"}
      </Button>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            {latest ? (
              <>
                {latest.status === "success" && <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />}
                {latest.status === "partial" && <AlertCircle className="h-3 w-3 mr-1 text-amber-600" />}
                {latest.status === "error" && <AlertCircle className="h-3 w-3 mr-1 text-destructive" />}
                {latest.status === "running" && <Clock className="h-3 w-3 mr-1 animate-pulse" />}
                Última: {new Date(latest.started_at).toLocaleString("pt-BR")}
              </>
            ) : (
              "Sem histórico"
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de sincronizações</DialogTitle>
            <DialogDescription>Últimas 20 execuções da sincronização Solarz + Conta Azul.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma execução registrada ainda.
              </p>
            )}
            {history.map((r) => (
              <div key={r.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        r.status === "success"
                          ? "default"
                          : r.status === "running"
                          ? "secondary"
                          : r.status === "partial"
                          ? "outline"
                          : "destructive"
                      }
                    >
                      {r.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        r.triggered_by === "cron"
                          ? "border-primary/40 text-primary"
                          : "border-muted-foreground/40 text-muted-foreground"
                      }
                    >
                      {r.triggered_by === "cron" ? "CRON" : "MANUAL"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(r.started_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.rows_read} lidos • {r.rows_upserted} upserts
                    {r.finished_at && (
                      <>
                        {" "}
                        •{" "}
                        {Math.round(
                          (new Date(r.finished_at).getTime() -
                            new Date(r.started_at).getTime()) /
                            1000,
                        )}
                        s
                      </>
                    )}
                  </div>
                </div>
                {r.error && (
                  <p className="text-xs text-destructive mt-2 break-all">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
