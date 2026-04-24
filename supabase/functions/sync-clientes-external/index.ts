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
// Normaliza nome para matching: trim, lowercase, remove acentos e colapsa espaços
const normName = (v: unknown): string | null => {
  const s = norm(v);
  if (!s) return null;
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};
// Normaliza CPF/CNPJ removendo tudo que não é dígito
const normDoc = (v: unknown): string | null => {
  const s = norm(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length ? digits : null;
};

async function openMysql(prefix: string) {
  const t0 = Date.now();
  const host = Deno.env.get(`${prefix}_MYSQL_HOST`);
  const port = Number(Deno.env.get(`${prefix}_MYSQL_PORT`) ?? "3306");
  const user = Deno.env.get(`${prefix}_MYSQL_USER`);
  const password = Deno.env.get(`${prefix}_MYSQL_PASSWORD`);
  const database = Deno.env.get(`${prefix}_MYSQL_DATABASE`);
  if (!host || !user || !password || !database) {
    throw new Error(`Secrets do MySQL ${prefix} incompletos`);
  }
  console.log(`[sync] [${prefix}] conectando em ${host}:${port}/${database} ...`);
  try {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 30_000,
      // longtext UTF-8
      charset: "utf8mb4",
    });
    console.log(`[sync] [${prefix}] conectado em ${Date.now() - t0}ms`);
    return conn;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync] [${prefix}] FALHA na conexão após ${Date.now() - t0}ms: ${msg}`);
    throw new Error(`Conexão MySQL ${prefix} falhou: ${msg}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────
const HARD_TIMEOUT_MS = 10 * 60 * 1000;
const BATCH_SIZE = 100;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const chunk = <T,>(items: T[], size = BATCH_SIZE) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

async function processSync(
  supabase: ReturnType<typeof createClient>,
  runId: string,
) {
  let szConn: Awaited<ReturnType<typeof openMysql>> | null = null;
  let caConn: Awaited<ReturnType<typeof openMysql>> | null = null;
  let dpConn: Awaited<ReturnType<typeof openMysql>> | null = null;

  let rowsRead = 0;
  let rowsUpserted = 0;
  let rowsDeactivated = 0;
  const errors: string[] = [];
  const seenSolarzIds = new Set<string>();
  const seenCaIds = new Set<string>();

  let timedOut = false;
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Timeout: sincronização excedeu ${HARD_TIMEOUT_MS / 60000} minutos e foi abortada.`));
    }, HARD_TIMEOUT_MS) as unknown as number;
  });
  const withTimeout = <T,>(p: Promise<T>): Promise<T> => Promise.race([p, timeoutPromise]) as Promise<T>;
  const checkTimeout = () => {
    if (timedOut) {
      throw new Error(`Timeout: sincronização excedeu ${HARD_TIMEOUT_MS / 60000} minutos e foi abortada.`);
    }
  };

  const t0 = Date.now();
  const syncRun = async (fields: Record<string, unknown>) => {
    await supabase.from("sync_runs").update(fields).eq("id", runId);
  };
  const logStep = async (label: string) => {
    console.log(`[sync] [run=${runId}] ${label} (+${Date.now() - t0}ms)`);
    await syncRun({ last_sync_cursor: label, rows_read: rowsRead, rows_upserted: rowsUpserted });
  };

  try {
    await logStep("STEP 1: abrindo conexões MySQL (paralelo)");
    [szConn, caConn, dpConn] = await withTimeout(
      Promise.all([openMysql("SOLARZ"), openMysql("CONTA_AZUL"), openMysql("DEPARA")]),
    );
    checkTimeout();
    await logStep("STEP 1: conexões abertas");

    await logStep("STEP 2: lendo dedupe_clientes (DEPARA)");
    const [dpRows] = await withTimeout(dpConn.query<any[]>("SELECT cliente_sz, id_ca FROM dedupe_clientes"));
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
    await logStep(`STEP 2: dedupe_clientes lido (${dpRows.length} linhas)`);

    await logStep("STEP 3a: lendo sz_clientes");
    const [szClientesRows] = await withTimeout(szConn.query<any[]>("SELECT id, name, email FROM sz_clientes"));
    rowsRead += szClientesRows.length;
    await logStep(`STEP 3a: sz_clientes lido (${szClientesRows.length} linhas)`);

    const szClientes = new Map<string, { id: string; name: string | null; email: string | null }>();
    for (const r of szClientesRows) {
      const id = norm(r.id);
      if (!id || szClientes.has(id)) continue;
      szClientes.set(id, { id, name: norm(r.name), email: norm(r.email) });
    }

    await logStep("STEP 3b: lendo sz_plantas_infos");
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
    await logStep(`STEP 3b: sz_plantas_infos lido (${szPlantasRows.length} linhas)`);

    const plantasByClienteNome = new Map<string, any[]>();
    const plantasByClienteCpf = new Map<string, any[]>();
    for (const p of szPlantasRows) {
      const cliNome = normName(p.cliente_nome);
      if (cliNome) {
        if (!plantasByClienteNome.has(cliNome)) plantasByClienteNome.set(cliNome, []);
        plantasByClienteNome.get(cliNome)!.push(p);
      }
      const cliCpf = normDoc(p.cliente_cpf);
      if (cliCpf) {
        if (!plantasByClienteCpf.has(cliCpf)) plantasByClienteCpf.set(cliCpf, []);
        plantasByClienteCpf.get(cliCpf)!.push(p);
      }
    }

    await logStep("STEP 4: lendo pessoas (CONTA_AZUL)");
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
    await logStep(`STEP 4: pessoas lido (${caRows.length} linhas)`);

    const caById = new Map<string, any>();
    for (const r of caRows) {
      const id = norm(r.id);
      if (!id || caById.has(id)) continue;
      caById.set(id, r);
    }

    const solarzDrafts: Array<{ solarzId: string; payload: Record<string, unknown>; plantas: any[]; linkedCaIds: string[] }> = [];
    let szProcessed = 0;
    for (const [szId, cli] of szClientes) {
      checkTimeout();
      seenSolarzIds.add(szId);

      const cliNomeKey = normName(cli.name);
      let plantas = (cliNomeKey && plantasByClienteNome.get(cliNomeKey)) || [];
      if (plantas.length === 0) {
        const linkedCaIdsForLookup = Array.from(szToCa.get(szId) ?? []);
        for (const caId of linkedCaIdsForLookup) {
          const cpf = normDoc(caById.get(caId)?.documento);
          if (cpf && plantasByClienteCpf.has(cpf)) {
            plantas = plantasByClienteCpf.get(cpf)!;
            break;
          }
        }
      }

      const linkedCaIds = Array.from(szToCa.get(szId) ?? []);
      linkedCaIds.forEach((caId) => seenCaIds.add(caId));
      const primeiraPlanta = plantas[0];

      const telefonesLines: string[] = [];
      const szPhones = new Set<string>();
      for (const p of plantas) {
        const t = norm(p.cliente_telefone);
        if (t) szPhones.add(t);
      }
      for (const t of szPhones) telefonesLines.push(`Solarz: ${t}`);

      const enderecosLines: string[] = [];
      for (const p of plantas) {
        const partes = [
          norm(p.endereco_logradouro),
          norm(p.endereco_bairro),
          norm(p.endereco_cidade) && norm(p.endereco_siglaEstado)
            ? `${norm(p.endereco_cidade)}/${norm(p.endereco_siglaEstado)}`
            : norm(p.endereco_cidade) ?? norm(p.endereco_siglaEstado),
          norm(p.endereco_cep),
        ].filter(Boolean).join(", ");
        if (partes) enderecosLines.push(`Solarz${norm(p.name) ? ` (${norm(p.name)})` : ""}: ${partes}`);
      }

      for (const caId of linkedCaIds) {
        const ca = caById.get(caId);
        if (!ca) continue;
        const cel = norm(ca.telefone_celular);
        const com = norm(ca.telefone_comercial);
        if (cel) telefonesLines.push(`CA cel: ${cel}`);
        if (com) telefonesLines.push(`CA com: ${com}`);
        const linha = [
          [norm(ca.logradouro), norm(ca.numero_end)].filter(Boolean).join(", "),
          norm(ca.complemento),
          norm(ca.bairro),
          norm(ca.cidade) && norm(ca.uf) ? `${norm(ca.cidade)}/${norm(ca.uf)}` : norm(ca.cidade) ?? norm(ca.uf),
          norm(ca.cep),
        ].filter(Boolean).join(", ");
        if (linha) enderecosLines.push(`CA: ${linha}`);
      }

      const primeiroCa = linkedCaIds.length > 0 ? caById.get(linkedCaIds[0]) : null;
      const ufvStatuses = plantas.map((p) => norm(p.status_status)?.toLowerCase()).filter((s): s is string => !!s);
      const totalAtraso = linkedCaIds.reduce((sum, caId) => {
        const current = numOrNull(caById.get(caId)?.atrasos_recebimentos);
        return current && current > 0 ? sum + current : sum;
      }, 0);

      solarzDrafts.push({
        solarzId: szId,
        plantas,
        linkedCaIds,
        payload: {
          solarz_customer_id: szId,
          origem: "solarz",
          ativo: true,
          empresa: cli.name ?? norm(primeiroCa?.nome_empresa) ?? norm(primeiroCa?.nome) ?? "(sem nome)",
          cnpj_cpf: norm(primeiraPlanta?.cliente_cpf) ?? norm(primeiroCa?.documento),
          endereco: norm(primeiraPlanta?.endereco_logradouro) ?? norm(primeiroCa?.logradouro),
          cidade: norm(primeiraPlanta?.endereco_cidade) ?? norm(primeiroCa?.cidade),
          estado: norm(primeiraPlanta?.endereco_siglaEstado) ?? norm(primeiroCa?.uf),
          cep: norm(primeiraPlanta?.endereco_cep) ?? norm(primeiroCa?.cep),
          latitude: numOrNull(primeiraPlanta?.endereco_latitude),
          longitude: numOrNull(primeiraPlanta?.endereco_longitude),
          telefones_unificados: joinLines(telefonesLines),
          enderecos_unificados: joinLines(enderecosLines),
          atrasos_recebimentos: totalAtraso > 0 ? totalAtraso : null,
          status_financeiro_ca: totalAtraso > 0 ? "INADIMPLENTE" : "OK",
          ufv_status_resumo:
            plantas.length === 0
              ? "SEM_UFV"
              : ufvStatuses.some((s) => ["alerta", "alarme", "offline", "falha", "erro", "down", "critico"].some((k) => s.includes(k)))
                ? "ALERTA"
                : "OK",
          sync_source_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      szProcessed++;
      if (szProcessed % 100 === 0) await logStep(`STEP 5: preparo ${szProcessed}/${szClientes.size} clientes Solarz`);
    }
    await logStep(`STEP 5: payloads Solarz preparados (${szProcessed} clientes)`);

    const solarzIdToClienteId = new Map<string, string>();
    for (const batch of chunk(solarzDrafts, BATCH_SIZE)) {
      checkTimeout();
      const { data, error } = await supabase
        .from("clientes")
        .upsert(batch.map((item) => item.payload), { onConflict: "solarz_customer_id" })
        .select("id, solarz_customer_id");
      if (error) {
        errors.push(`clientes-solarz-batch: ${error.message}`);
        continue;
      }
      for (const row of data ?? []) {
        if (row.solarz_customer_id) solarzIdToClienteId.set(String(row.solarz_customer_id), String(row.id));
      }
      rowsUpserted += data?.length ?? 0;
    }
    await logStep(`STEP 5: clientes Solarz persistidos (${solarzIdToClienteId.size})`);

    const ufvPayloads: Record<string, unknown>[] = [];
    const caLinkPayloadsById = new Map<string, Record<string, unknown>>();
    for (const draft of solarzDrafts) {
      const clienteUuid = solarzIdToClienteId.get(draft.solarzId);
      if (!clienteUuid) {
        errors.push(`solarz/${draft.solarzId}: cliente não retornou no upsert em lote`);
        continue;
      }

      for (const p of draft.plantas) {
        const ufvId = norm(p.id);
        if (!ufvId) continue;
        ufvPayloads.push({
          cliente_id: clienteUuid,
          solarz_ufv_id: ufvId,
          nome: norm(p.name),
          endereco: [norm(p.endereco_logradouro), norm(p.endereco_bairro)].filter(Boolean).join(", ") || null,
          cidade: norm(p.endereco_cidade),
          estado: norm(p.endereco_siglaEstado),
          cep: norm(p.endereco_cep),
          latitude: numOrNull(p.endereco_latitude),
          longitude: numOrNull(p.endereco_longitude),
          potencia_kwp: numOrNull(p.installedPower),
          status: norm(p.status_status),
          updated_at: new Date().toISOString(),
        });
      }

      for (const caId of draft.linkedCaIds) {
        const ca = caById.get(caId);
        caLinkPayloadsById.set(caId, {
          cliente_id: clienteUuid,
          conta_azul_customer_id: caId,
          nome_fiscal: norm(ca?.nome) ?? norm(ca?.nome_empresa),
          cnpj_cpf: norm(ca?.documento),
          email: norm(ca?.email),
          updated_at: new Date().toISOString(),
        });
      }
    }

    for (const batch of chunk(ufvPayloads, 200)) {
      checkTimeout();
      const { error } = await supabase.from("cliente_ufvs").upsert(batch, { onConflict: "solarz_ufv_id" });
      if (error) errors.push(`ufv-batch: ${error.message}`);
      else rowsUpserted += batch.length;
    }
    for (const batch of chunk(Array.from(caLinkPayloadsById.values()), 200)) {
      checkTimeout();
      const { error } = await supabase.from("cliente_conta_azul_ids").upsert(batch, { onConflict: "conta_azul_customer_id" });
      if (error) errors.push(`ca-link-batch: ${error.message}`);
      else rowsUpserted += batch.length;
    }
    await logStep(`STEP 5: UFVs (${ufvPayloads.length}) e vínculos CA (${caLinkPayloadsById.size}) persistidos`);

    const orphanCaIds = Array.from(caById.keys()).filter((caId) => !caToSz.has(caId));
    await logStep(`STEP 6: processando órfãos CA (total candidatos: ${orphanCaIds.length})`);

    const existingOrphanLinkMap = new Map<string, string>();
    for (const batch of chunk(orphanCaIds, 200)) {
      checkTimeout();
      const { data, error } = await supabase
        .from("cliente_conta_azul_ids")
        .select("cliente_id, conta_azul_customer_id")
        .in("conta_azul_customer_id", batch);
      if (error) {
        errors.push(`ca-orphan-links: ${error.message}`);
        continue;
      }
      for (const row of data ?? []) existingOrphanLinkMap.set(String(row.conta_azul_customer_id), String(row.cliente_id));
    }

    const orphanExistingPayloads: Record<string, unknown>[] = [];
    const orphanLinkPayloads: Record<string, unknown>[] = [];
    const orphanNewPayloads: Array<{ caId: string; clientePayload: Record<string, unknown>; linkPayload: Record<string, unknown> }> = [];

    let orphanPrepared = 0;
    for (const caId of orphanCaIds) {
      checkTimeout();
      seenCaIds.add(caId);
      const ca = caById.get(caId);
      const atrasoOrfao = numOrNull(ca?.atrasos_recebimentos);
      const clientePayload = {
        ativo: true,
        empresa: norm(ca?.nome_empresa) ?? norm(ca?.nome) ?? "(sem nome)",
        cnpj_cpf: norm(ca?.documento),
        endereco: norm(ca?.logradouro),
        cidade: norm(ca?.cidade),
        estado: norm(ca?.uf),
        cep: norm(ca?.cep),
        telefones_unificados: joinLines([
          norm(ca?.telefone_celular) ? `CA cel: ${ca.telefone_celular}` : null,
          norm(ca?.telefone_comercial) ? `CA com: ${ca.telefone_comercial}` : null,
        ]),
        enderecos_unificados: joinLines([
          `CA: ${[
            norm(ca?.logradouro),
            norm(ca?.numero_end),
            norm(ca?.bairro),
            norm(ca?.cidade),
            norm(ca?.uf),
            norm(ca?.cep),
          ].filter(Boolean).join(", ")}`,
        ]),
        atrasos_recebimentos: atrasoOrfao && atrasoOrfao > 0 ? atrasoOrfao : null,
        status_financeiro_ca: (atrasoOrfao ?? 0) > 0 ? "INADIMPLENTE" : "OK",
        ufv_status_resumo: "SEM_UFV",
        sync_source_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const linkPayload = {
        conta_azul_customer_id: caId,
        nome_fiscal: norm(ca?.nome) ?? norm(ca?.nome_empresa),
        cnpj_cpf: norm(ca?.documento),
        email: norm(ca?.email),
        updated_at: new Date().toISOString(),
      };

      const existingClienteId = existingOrphanLinkMap.get(caId);
      if (existingClienteId) {
        orphanExistingPayloads.push({ id: existingClienteId, origem: "conta_azul", ...clientePayload });
        orphanLinkPayloads.push({ cliente_id: existingClienteId, ...linkPayload });
      } else {
        orphanNewPayloads.push({
          caId,
          clientePayload: { origem: "conta_azul", ...clientePayload },
          linkPayload,
        });
      }

      orphanPrepared++;
      if (orphanPrepared % 100 === 0) await logStep(`STEP 6: preparo ${orphanPrepared}/${orphanCaIds.length} órfãos CA`);
    }

    for (const batch of chunk(orphanExistingPayloads, BATCH_SIZE)) {
      checkTimeout();
      const { data, error } = await supabase.from("clientes").upsert(batch, { onConflict: "id" }).select("id");
      if (error) errors.push(`ca-orphan-existing-batch: ${error.message}`);
      else rowsUpserted += data?.length ?? batch.length;
    }

    for (const orphan of orphanNewPayloads) {
      checkTimeout();
      const { data, error } = await supabase.from("clientes").insert(orphan.clientePayload).select("id").single();
      if (error || !data) {
        errors.push(`ca-orphan/${orphan.caId}: ${error?.message ?? "insert vazio"}`);
        continue;
      }
      orphanLinkPayloads.push({ cliente_id: String(data.id), ...orphan.linkPayload });
      rowsUpserted++;
    }

    for (const batch of chunk(orphanLinkPayloads, 200)) {
      checkTimeout();
      const { error } = await supabase.from("cliente_conta_azul_ids").upsert(batch, { onConflict: "conta_azul_customer_id" });
      if (error) errors.push(`ca-link-orphan-batch: ${error.message}`);
      else rowsUpserted += batch.length;
    }
    await logStep(`STEP 6: concluído (${orphanCaIds.length} órfãos CA; novos=${orphanNewPayloads.length}, existentes=${orphanExistingPayloads.length})`);

    await logStep(`STEP 6.5: saneamento — vistos: ${seenSolarzIds.size} SZ, ${seenCaIds.size} CA`);
    try {
      const seenSzArr = Array.from(seenSolarzIds);
      const { data: szDeact, error: szDeactErr } = await supabase
        .from("clientes")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("origem", "solarz")
        .eq("ativo", true)
        .not("solarz_customer_id", "is", null)
        .not(
          "solarz_customer_id",
          "in",
          seenSzArr.length > 0 ? `(${seenSzArr.map((s) => `"${s.replace(/"/g, '""')}"`).join(",")})` : "(NULL)",
        )
        .select("id");
      if (szDeactErr) errors.push(`saneamento-solarz: ${szDeactErr.message}`);
      else rowsDeactivated += szDeact?.length ?? 0;

      const { data: caActiveLinks, error: caActiveLinksErr } = await supabase
        .from("cliente_conta_azul_ids")
        .select("cliente_id, conta_azul_customer_id, clientes!inner(id, origem, ativo)")
        .eq("clientes.origem", "conta_azul")
        .eq("clientes.ativo", true);
      if (caActiveLinksErr) {
        errors.push(`saneamento-ca-links: ${caActiveLinksErr.message}`);
      } else {
        const orphanClienteIds = Array.from(
          new Set(
            (caActiveLinks ?? [])
              .filter((link) => !seenCaIds.has(String(link.conta_azul_customer_id)))
              .map((link) => String(link.cliente_id)),
          ),
        );
        if (orphanClienteIds.length > 0) {
          const { data: caDeact, error: caDeactErr } = await supabase
            .from("clientes")
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .in("id", orphanClienteIds)
            .select("id");
          if (caDeactErr) errors.push(`saneamento-ca: ${caDeactErr.message}`);
          else rowsDeactivated += caDeact?.length ?? 0;
        }
      }
    } catch (sanErr) {
      errors.push(`saneamento: ${sanErr instanceof Error ? sanErr.message : String(sanErr)}`);
    }

    const finalStatus = errors.length === 0 ? "success" : "partial";
    await logStep(`STEP 7: finalizando — status=${finalStatus}, rows_upserted=${rowsUpserted}, errors=${errors.length}, deactivated=${rowsDeactivated}`);
    await syncRun({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      rows_read: rowsRead,
      rows_upserted: rowsUpserted,
      last_sync_cursor: rowsDeactivated > 0 ? `saneamento:${rowsDeactivated}` : "finished",
      error: errors.length
        ? errors.slice(0, 50).join(" | ")
        : rowsDeactivated > 0
          ? `Saneamento: ${rowsDeactivated} cliente(s) marcado(s) como inativo(s).`
          : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await syncRun({
      status: "error",
      finished_at: new Date().toISOString(),
      rows_read: rowsRead,
      rows_upserted: rowsUpserted,
      last_sync_cursor: "failed",
      error: msg,
    });
    console.error(`[sync] [run=${runId}] erro fatal: ${msg}`);
  } finally {
    clearTimeout(timeoutHandle);
    await Promise.allSettled([szConn?.end(), caConn?.end(), dpConn?.end()]);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let triggeredBy: "manual" | "cron" = "manual";
  try {
    const body = await req.clone().json().catch(() => null);
    if (body && (body.triggered_by === "pg_cron" || body.triggered_by === "cron")) triggeredBy = "cron";
  } catch {
    // body opcional
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const isServiceRole = !!token && token === serviceRoleKey;
  const isCronCall = triggeredBy === "cron" && !!token && token === anonKey;

  if (!isServiceRole && !isCronCall) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado" }, 401);
    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userData.user.id });
    if (!isStaff) return jsonResponse({ error: "Apenas staff pode disparar a sincronização" }, 403);
  }

  await supabase
    .from("sync_runs")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      error: "Run abortada — substituída por nova execução (timeout anterior).",
      last_sync_cursor: "stale-replaced",
    })
    .eq("source", "clientes-external")
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - HARD_TIMEOUT_MS).toISOString());

  const { data: activeRun } = await supabase
    .from("sync_runs")
    .select("id, started_at")
    .eq("source", "clientes-external")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeRun?.id) {
    return jsonResponse({ run_id: activeRun.id, status: "running", reused: true }, 202);
  }

  const { data: runRow, error: runErr } = await supabase
    .from("sync_runs")
    .insert({ source: "clientes-external", status: "running", triggered_by: triggeredBy, last_sync_cursor: "queued" })
    .select("id")
    .single();
  if (runErr || !runRow) return jsonResponse({ error: "Falha ao registrar sync_run", details: runErr?.message }, 500);

  const runId = String(runRow.id);
  const backgroundTask = processSync(supabase, runId);
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(backgroundTask);
  else await backgroundTask;

  return jsonResponse({ run_id: runId, status: "running", accepted: true }, 202);
});
