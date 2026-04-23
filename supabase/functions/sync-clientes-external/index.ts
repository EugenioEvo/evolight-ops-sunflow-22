// Edge function: sync-clientes-external
// Lê 3 MySQL (Solarz, Conta Azul, De-Para) e atualiza:
//   - public.clientes              (cards unificados)
//   - public.cliente_ufvs          (usinas via Solarz)
//   - public.cliente_conta_azul_ids (IDs financeiros via De-Para)
// Estratégia: full load + dedupe interno. Registra execução em sync_runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import mysql from "npm:mysql2@3.11.0/promise";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── helpers ──────────────────────────────────────────────────────────────
const norm = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const numOrNull = (v: unknown): number | null => {
  const s = norm(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const joinLines = (lines: (string | null | undefined)[]): string | null => {
  const filtered = lines.map((l) => l?.trim()).filter((l): l is string => !!l);
  return filtered.length ? filtered.join("\n") : null;
};

async function openMysql(prefix: string) {
  const host = Deno.env.get(`${prefix}_MYSQL_HOST`);
  const port = Number(Deno.env.get(`${prefix}_MYSQL_PORT`) ?? "3306");
  const user = Deno.env.get(`${prefix}_MYSQL_USER`);
  const password = Deno.env.get(`${prefix}_MYSQL_PASSWORD`);
  const database = Deno.env.get(`${prefix}_MYSQL_DATABASE`);
  if (!host || !user || !password || !database) {
    throw new Error(`Secrets do MySQL ${prefix} incompletos`);
  }
  return await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 30_000,
    // longtext UTF-8
    charset: "utf8mb4",
  });
}

// ─── main ─────────────────────────────────────────────────────────────────
const HARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Lê body (opcional) para identificar origem do disparo
  let triggeredBy: "manual" | "cron" = "manual";
  try {
    const body = await req.clone().json().catch(() => null);
    if (body && (body.triggered_by === "pg_cron" || body.triggered_by === "cron")) {
      triggeredBy = "cron";
    }
  } catch {
    // body opcional
  }

  // Auth: aceita JWT staff OU service-role (cron). Se vier JWT, valida role.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__",
  );

  if (!isServiceRole) {
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: isStaff } = await supabase.rpc("is_staff", {
      _user_id: userData.user.id,
    });
    if (!isStaff) {
      return new Response(
        JSON.stringify({ error: "Apenas staff pode disparar a sincronização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // Limpa runs travadas anteriores (mais de 5min em "running") para evitar lixo
  await supabase
    .from("sync_runs")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      error: "Run abortada — substituída por nova execução (timeout anterior).",
    })
    .eq("source", "clientes-external")
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - HARD_TIMEOUT_MS).toISOString());

  // Cria run
  const { data: runRow, error: runErr } = await supabase
    .from("sync_runs")
    .insert({ source: "clientes-external", status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();
  if (runErr || !runRow) {
    return new Response(
      JSON.stringify({ error: "Falha ao registrar sync_run", details: runErr?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const runId = runRow.id as string;

  let szConn: Awaited<ReturnType<typeof openMysql>> | null = null;
  let caConn: Awaited<ReturnType<typeof openMysql>> | null = null;
  let dpConn: Awaited<ReturnType<typeof openMysql>> | null = null;

  let rowsRead = 0;
  let rowsUpserted = 0;
  const errors: string[] = [];

  // Conjuntos para saneamento (soft-delete) ao final
  const seenSolarzIds = new Set<string>();
  const seenCaIds = new Set<string>();

  // ─── Hard timeout (5 minutes) ─────────────────────────────────────────
  // Promise.race garante que QUALQUER await trava (ex: MySQL handshake)
  // será interrompido. checkTimeout() é mantido como guard adicional entre
  // iterações pesadas.
  let timedOut = false;
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout: sincronização excedeu ${HARD_TIMEOUT_MS / 60000} minutos e foi abortada.`,
        ),
      );
    }, HARD_TIMEOUT_MS) as unknown as number;
  });
  const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
    Promise.race([p, timeoutPromise]) as Promise<T>;
  const checkTimeout = () => {
    if (timedOut) {
      throw new Error(
        `Timeout: sincronização excedeu ${HARD_TIMEOUT_MS / 60000} minutos e foi abortada.`,
      );
    }
  };

  try {
    // 1) Conexões em paralelo (com hard-timeout)
    [szConn, caConn, dpConn] = await withTimeout(
      Promise.all([
        openMysql("SOLARZ"),
        openMysql("CONTA_AZUL"),
        openMysql("DEPARA"),
      ]),
    );
    checkTimeout();

    // 2) De-Para → mapas
    const [dpRows] = await withTimeout(
      dpConn.query<any[]>("SELECT cliente_sz, id_ca FROM dedupe_clientes"),
    );
    const szToCa = new Map<string, Set<string>>();
    const caToSz = new Map<string, string>();
    for (const r of dpRows) {
      const sz = norm(r.cliente_sz);
      const ca = norm(r.id_ca);
      if (!sz || !ca) continue;
      if (!szToCa.has(sz)) szToCa.set(sz, new Set());
      szToCa.get(sz)!.add(ca);
      caToSz.set(ca, sz);
    }
    rowsRead += dpRows.length;

    // 3) Solarz: clientes (dedupe por id) + plantas (agrupadas por cliente_nome)
    const [szClientesRows] = await withTimeout(
      szConn.query<any[]>("SELECT id, name, email FROM sz_clientes"),
    );
    rowsRead += szClientesRows.length;

    const szClientes = new Map<
      string,
      { id: string; name: string | null; email: string | null }
    >();
    for (const r of szClientesRows) {
      const id = norm(r.id);
      if (!id || szClientes.has(id)) continue;
      szClientes.set(id, { id, name: norm(r.name), email: norm(r.email) });
    }

    const [szPlantasRows] = await withTimeout(
      szConn.query<any[]>(
        `SELECT id, name, cliente_cpf, cliente_nome, cliente_telefone,
                dataInstalacao, endereco_bairro, endereco_cep, endereco_cidade,
                endereco_latitude, endereco_logradouro, endereco_longitude,
                endereco_siglaEstado, installedPower, status_status
         FROM sz_plantas_infos`,
      ),
    );
    rowsRead += szPlantasRows.length;

    const plantasByClienteNome = new Map<string, any[]>();
    for (const p of szPlantasRows) {
      const cliNome = norm(p.cliente_nome);
      if (!cliNome) continue;
      const key = cliNome.toLowerCase();
      if (!plantasByClienteNome.has(key)) plantasByClienteNome.set(key, []);
      plantasByClienteNome.get(key)!.push(p);
    }

    // 4) Conta Azul: pessoas (clientes ativos)
    const [caRows] = await withTimeout(
      caConn.query<any[]>(
        `SELECT id, nome, nome_empresa, documento, email,
                telefone_celular, telefone_comercial,
                logradouro, numero_end, complemento, bairro, cidade, uf, cep, pais,
                atrasos_recebimentos,
                data_alteracao
         FROM pessoas
         WHERE LOWER(perfis) LIKE '%cliente%'
           AND LOWER(ativo) IN ('true','1','sim')`,
      ),
    );
    rowsRead += caRows.length;

    const caById = new Map<string, any>();
    for (const r of caRows) {
      const id = norm(r.id);
      if (!id || caById.has(id)) continue;
      caById.set(id, r);
    }

    // ─── 5) Upsert clientes Solarz ─────────────────────────────────────────
    for (const [szId, cli] of szClientes) {
      checkTimeout();
      seenSolarzIds.add(szId);
      const plantas =
        (cli.name && plantasByClienteNome.get(cli.name.toLowerCase())) || [];
      const primeiraPlanta = plantas[0];

      // Telefones unificados
      const telefonesLines: string[] = [];
      const szPhones = new Set<string>();
      for (const p of plantas) {
        const t = norm(p.cliente_telefone);
        if (t) szPhones.add(t);
      }
      for (const t of szPhones) telefonesLines.push(`Solarz: ${t}`);

      // Endereços unificados (todas as UFVs)
      const enderecosLines: string[] = [];
      for (const p of plantas) {
        const log = norm(p.endereco_logradouro);
        const bai = norm(p.endereco_bairro);
        const cid = norm(p.endereco_cidade);
        const uf = norm(p.endereco_siglaEstado);
        const cep = norm(p.endereco_cep);
        const partes = [log, bai, cid && uf ? `${cid}/${uf}` : cid ?? uf, cep]
          .filter(Boolean)
          .join(", ");
        if (partes) {
          const nomeUfv = norm(p.name);
          enderecosLines.push(
            `Solarz${nomeUfv ? ` (${nomeUfv})` : ""}: ${partes}`,
          );
        }
      }

      // Adiciona telefones/endereços do(s) Conta Azul vinculado(s)
      const linkedCaIds = Array.from(szToCa.get(szId) ?? []);
      for (const caId of linkedCaIds) {
        const ca = caById.get(caId);
        if (!ca) continue;
        const cel = norm(ca.telefone_celular);
        const com = norm(ca.telefone_comercial);
        if (cel) telefonesLines.push(`CA cel: ${cel}`);
        if (com) telefonesLines.push(`CA com: ${com}`);
        const log = norm(ca.logradouro);
        const num = norm(ca.numero_end);
        const comp = norm(ca.complemento);
        const bai = norm(ca.bairro);
        const cid = norm(ca.cidade);
        const uf = norm(ca.uf);
        const cep = norm(ca.cep);
        const linha = [
          [log, num].filter(Boolean).join(", "),
          comp,
          bai,
          cid && uf ? `${cid}/${uf}` : cid ?? uf,
          cep,
        ]
          .filter(Boolean)
          .join(", ");
        if (linha) enderecosLines.push(`CA: ${linha}`);
      }

      const empresa = cli.name ?? "(sem nome)";
      const cnpjCpf = norm(primeiraPlanta?.cliente_cpf);

      // Status agregado de UFVs
      const ufvStatuses = plantas
        .map((p) => norm(p.status_status)?.toLowerCase())
        .filter((s): s is string => !!s);
      let ufvResumo: string;
      if (plantas.length === 0) {
        ufvResumo = "SEM_UFV";
      } else if (
        ufvStatuses.some((s) =>
          ["alerta", "alarme", "offline", "falha", "erro", "down", "critico"].some((k) => s.includes(k))
        )
      ) {
        ufvResumo = "ALERTA";
      } else {
        ufvResumo = "OK";
      }

      // Status financeiro CA: usa o pior caso entre os CAs vinculados
      let totalAtraso = 0;
      for (const caId of linkedCaIds) {
        const ca = caById.get(caId);
        const v = numOrNull(ca?.atrasos_recebimentos);
        if (v && v > 0) totalAtraso += v;
      }
      const statusFinanceiro = totalAtraso > 0 ? "INADIMPLENTE" : "OK";

      const clientePayload = {
        solarz_customer_id: szId,
        origem: "solarz",
        ativo: true,
        empresa,
        cnpj_cpf: cnpjCpf,
        endereco: norm(primeiraPlanta?.endereco_logradouro),
        cidade: norm(primeiraPlanta?.endereco_cidade),
        estado: norm(primeiraPlanta?.endereco_siglaEstado),
        cep: norm(primeiraPlanta?.endereco_cep),
        latitude: numOrNull(primeiraPlanta?.endereco_latitude),
        longitude: numOrNull(primeiraPlanta?.endereco_longitude),
        telefones_unificados: joinLines(telefonesLines),
        enderecos_unificados: joinLines(enderecosLines),
        atrasos_recebimentos: totalAtraso > 0 ? totalAtraso : null,
        status_financeiro_ca: statusFinanceiro,
        ufv_status_resumo: ufvResumo,
        sync_source_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: upserted, error: upErr } = await supabase
        .from("clientes")
        .upsert(clientePayload, { onConflict: "solarz_customer_id" })
        .select("id")
        .single();

      if (upErr || !upserted) {
        errors.push(`solarz/${szId}: ${upErr?.message ?? "upsert vazio"}`);
        continue;
      }
      rowsUpserted++;
      const clienteUuid = upserted.id as string;

      // 5a) UFVs — upsert por solarz_ufv_id
      for (const p of plantas) {
        const ufvId = norm(p.id);
        if (!ufvId) continue;
        const partesEnd = [
          norm(p.endereco_logradouro),
          norm(p.endereco_bairro),
        ]
          .filter(Boolean)
          .join(", ");
        const { error: ufvErr } = await supabase
          .from("cliente_ufvs")
          .upsert(
            {
              cliente_id: clienteUuid,
              solarz_ufv_id: ufvId,
              nome: norm(p.name),
              endereco: partesEnd || null,
              cidade: norm(p.endereco_cidade),
              estado: norm(p.endereco_siglaEstado),
              cep: norm(p.endereco_cep),
              latitude: numOrNull(p.endereco_latitude),
              longitude: numOrNull(p.endereco_longitude),
              potencia_kwp: numOrNull(p.installedPower),
              status: norm(p.status_status),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "solarz_ufv_id" },
          );
        if (ufvErr) errors.push(`ufv/${ufvId}: ${ufvErr.message}`);
        else rowsUpserted++;
      }

      // 5b) IDs Conta Azul vinculados
      for (const caId of linkedCaIds) {
        const ca = caById.get(caId);
        const { error: caErr } = await supabase
          .from("cliente_conta_azul_ids")
          .upsert(
            {
              cliente_id: clienteUuid,
              conta_azul_customer_id: caId,
              nome_fiscal: norm(ca?.nome) ?? norm(ca?.nome_empresa),
              cnpj_cpf: norm(ca?.documento),
              email: norm(ca?.email),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "conta_azul_customer_id" },
          );
        if (caErr) errors.push(`ca-link/${caId}: ${caErr.message}`);
        else rowsUpserted++;
      }
    }

    // ─── 6) Conta Azul órfãos (sem solarz no De-Para) ───────────────────────
    for (const [caId, ca] of caById) {
      checkTimeout();
      if (caToSz.has(caId)) continue; // já tratado acima

      const empresa =
        norm(ca.nome_empresa) ?? norm(ca.nome) ?? "(sem nome)";
      const cnpjCpf = norm(ca.documento);
      const atrasoOrfao = numOrNull(ca.atrasos_recebimentos);
      const statusFinanceiroOrfao = (atrasoOrfao ?? 0) > 0 ? "INADIMPLENTE" : "OK";

      // Busca cliente existente para esse CA (via cliente_conta_azul_ids)
      const { data: existingLink } = await supabase
        .from("cliente_conta_azul_ids")
        .select("cliente_id")
        .eq("conta_azul_customer_id", caId)
        .maybeSingle();

      let clienteUuid: string;

      if (existingLink?.cliente_id) {
        clienteUuid = existingLink.cliente_id;
        await supabase
          .from("clientes")
          .update({
            empresa,
            cnpj_cpf: cnpjCpf,
            endereco: norm(ca.logradouro),
            cidade: norm(ca.cidade),
            estado: norm(ca.uf),
            cep: norm(ca.cep),
            telefones_unificados: joinLines([
              norm(ca.telefone_celular) ? `CA cel: ${ca.telefone_celular}` : null,
              norm(ca.telefone_comercial) ? `CA com: ${ca.telefone_comercial}` : null,
            ]),
            enderecos_unificados: joinLines([
              `CA: ${[
                norm(ca.logradouro),
                norm(ca.numero_end),
                norm(ca.bairro),
                norm(ca.cidade),
                norm(ca.uf),
                norm(ca.cep),
              ]
                .filter(Boolean)
                .join(", ")}`,
            ]),
            atrasos_recebimentos: atrasoOrfao && atrasoOrfao > 0 ? atrasoOrfao : null,
            status_financeiro_ca: statusFinanceiroOrfao,
            ufv_status_resumo: "SEM_UFV",
            sync_source_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", clienteUuid);
      } else {
        const { data: created, error: createErr } = await supabase
          .from("clientes")
          .insert({
            origem: "conta_azul",
            empresa,
            cnpj_cpf: cnpjCpf,
            endereco: norm(ca.logradouro),
            cidade: norm(ca.cidade),
            estado: norm(ca.uf),
            cep: norm(ca.cep),
            telefones_unificados: joinLines([
              norm(ca.telefone_celular) ? `CA cel: ${ca.telefone_celular}` : null,
              norm(ca.telefone_comercial) ? `CA com: ${ca.telefone_comercial}` : null,
            ]),
            enderecos_unificados: joinLines([
              `CA: ${[
                norm(ca.logradouro),
                norm(ca.numero_end),
                norm(ca.bairro),
                norm(ca.cidade),
                norm(ca.uf),
                norm(ca.cep),
              ]
                .filter(Boolean)
                .join(", ")}`,
            ]),
            atrasos_recebimentos: atrasoOrfao && atrasoOrfao > 0 ? atrasoOrfao : null,
            status_financeiro_ca: statusFinanceiroOrfao,
            ufv_status_resumo: "SEM_UFV",
            sync_source_updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (createErr || !created) {
          errors.push(`ca-orphan/${caId}: ${createErr?.message ?? "insert vazio"}`);
          continue;
        }
        clienteUuid = created.id as string;
      }
      rowsUpserted++;

      const { error: linkErr } = await supabase
        .from("cliente_conta_azul_ids")
        .upsert(
          {
            cliente_id: clienteUuid,
            conta_azul_customer_id: caId,
            nome_fiscal: norm(ca.nome) ?? norm(ca.nome_empresa),
            cnpj_cpf: cnpjCpf,
            email: norm(ca.email),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "conta_azul_customer_id" },
        );
      if (linkErr) errors.push(`ca-link-orphan/${caId}: ${linkErr.message}`);
    }

    // 7) Encerra run
    const finalStatus = errors.length === 0 ? "success" : "partial";
    await supabase
      .from("sync_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        error: errors.length ? errors.slice(0, 50).join(" | ") : null,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        run_id: runId,
        status: finalStatus,
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        errors_count: errors.length,
        sample_errors: errors.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        error: msg,
      })
      .eq("id", runId);
    return new Response(
      JSON.stringify({ run_id: runId, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timeoutHandle);
    await Promise.allSettled([
      szConn?.end(),
      caConn?.end(),
      dpConn?.end(),
    ]);
  }
});
