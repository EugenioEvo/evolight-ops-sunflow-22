import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function signPath(supabase: any, path: string): Promise<string | null> {
  const buckets = ["rdo-evidences", "ordens-servico", "rme-evidences"];
  for (const b of buckets) {
    const { data } = await supabase.storage.from(b).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "missing_token" }, 400);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("obra_share_tokens")
      .select("id, obra_id, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) return json({ error: "invalid_token" }, 404);
    if (tokenRow.revoked_at) return json({ error: "revoked_token" }, 410);

    const obraId = tokenRow.obra_id;

    const [{ data: obra }, { data: rdos }, { data: metas }, { data: catalogo }] = await Promise.all([
      supabase.from("obras").select("*").eq("id", obraId).maybeSingle(),
      supabase
        .from("rdo_relatorios")
        .select(`id, numero_rdo, data_rdo, status, fotos_geral,
          atividades:rdo_atividades(catalogo_id, quantidade, percentual_avanco),
          evidencias:rdo_evidencias(storage_path, descricao)`)
        .eq("obra_id", obraId)
        .order("data_rdo", { ascending: false }),
      supabase.from("obra_metas_catalogo").select("*").eq("obra_id", obraId),
      supabase.from("rdo_atividades_catalogo").select("id, label, categoria, unidade").eq("ativo", true),
    ]);

    if (!obra) return json({ error: "obra_not_found" }, 404);

    let cliente: any = null;
    if (obra.cliente_id) {
      const { data } = await supabase
        .from("clientes")
        .select("empresa")
        .eq("id", obra.cliente_id)
        .maybeSingle();
      cliente = data;
    }

    const catMap = new Map<string, any>();
    for (const c of (catalogo ?? []) as any[]) catMap.set(c.id, c);

    const metaQtyMap = new Map<string, number>();
    for (const m of (metas ?? []) as any[]) {
      if (m.catalogo_id) metaQtyMap.set(m.catalogo_id, Number(m.quantidade_meta ?? 0));
    }

    const aprovados = (rdos ?? []).filter((r: any) => r.status === "aprovado");

    // realizado por catalogo (somente RDOs aprovados)
    const realizados = new Map<string, number>();
    for (const r of aprovados) {
      for (const a of r.atividades ?? []) {
        if (!a.catalogo_id) continue;
        realizados.set(a.catalogo_id, (realizados.get(a.catalogo_id) ?? 0) + Number(a.quantidade ?? 0));
      }
    }

    const progresso = ((metas ?? []) as any[])
      .map((m) => {
        const cat = catMap.get(m.catalogo_id);
        const meta = Number(m.quantidade_meta ?? 0);
        const realizado = realizados.get(m.catalogo_id) ?? 0;
        const pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;
        return {
          catalogo_id: m.catalogo_id,
          label: cat?.label ?? "—",
          categoria: cat?.categoria ?? "",
          unidade: m.unidade ?? cat?.unidade ?? "",
          meta,
          realizado,
          pct: Math.round(pct * 10) / 10,
        };
      })
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.label.localeCompare(b.label));

    // série de avanço acumulado
    const sorted = [...aprovados].sort((a, b) => a.data_rdo.localeCompare(b.data_rdo));
    let acc = 0;
    const avancoSerie = sorted.map((r) => {
      const vals = (r.atividades ?? []).map((a: any) => {
        if (a.percentual_avanco != null) return Number(a.percentual_avanco);
        const meta = a.catalogo_id ? metaQtyMap.get(a.catalogo_id) ?? 0 : 0;
        return meta > 0 ? (Number(a.quantidade ?? 0) / meta) * 100 : 0;
      });
      const avg = vals.length ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : 0;
      acc = Math.min(100, acc + avg);
      return { data: r.data_rdo, avanco: Math.round(acc * 100) / 100 };
    });

    // fotos consolidadas (somente RDOs aprovados)
    const photoItems: { path: string; descricao?: string | null; data?: string }[] = [];
    for (const r of aprovados) {
      for (const e of r.evidencias ?? []) {
        if (e.storage_path) photoItems.push({ path: e.storage_path, descricao: e.descricao, data: r.data_rdo });
      }
      for (const f of r.fotos_geral ?? []) {
        if (typeof f === "string") photoItems.push({ path: f, data: r.data_rdo });
      }
    }
    const fotos = (
      await Promise.all(
        photoItems.map(async (i) => {
          const u = await signPath(supabase, i.path);
          return u ? { url: u, descricao: i.descricao ?? null, data: i.data ?? null } : null;
        })
      )
    ).filter(Boolean);

    const obraPublica = {
      id: obra.id,
      nome: obra.nome,
      status: obra.status,
      endereco: obra.endereco,
      cidade: obra.cidade,
      estado: obra.estado,
      cep: obra.cep,
      potencia_kwp: obra.potencia_kwp,
      data_inicio_prevista: obra.data_inicio_prevista,
      data_fim_prevista: obra.data_fim_prevista,
      cliente_empresa: cliente?.empresa ?? null,
    };

    const rdosPublicos = (rdos ?? []).map((r: any) => ({
      id: r.id,
      numero_rdo: r.numero_rdo,
      data_rdo: r.data_rdo,
      status: r.status,
      atividades_count: (r.atividades ?? []).length,
    }));

    return json({
      obra: obraPublica,
      progresso,
      avanco_serie: avancoSerie,
      rdos: rdosPublicos,
      fotos,
    });
  } catch (e: any) {
    console.error("[obra-public-view] error:", e);
    return json({ error: "internal_error", message: e?.message }, 500);
  }
});
