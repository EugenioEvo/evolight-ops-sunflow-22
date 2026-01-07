import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Tables allowed for export with their columns
const ALLOWED_TABLES: Record<string, string[]> = {
  tickets: [
    "id", "numero_ticket", "titulo", "descricao", "status", "prioridade",
    "equipamento_tipo", "endereco_servico", "data_abertura", "data_vencimento",
    "data_conclusao", "tempo_estimado", "latitude", "longitude", "created_at", "updated_at"
  ],
  ordens_servico: [
    "id", "numero_os", "ticket_id", "data_emissao", "data_programada",
    "hora_inicio", "hora_fim", "duracao_estimada_min", "site_name", "notes",
    "presence_confirmed_at", "created_at", "updated_at"
  ],
  rme_relatorios: [
    "id", "ticket_id", "ordem_servico_id", "data_execucao", "data_preenchimento",
    "status", "status_aprovacao", "site_name", "shift", "start_time", "end_time",
    "servicos_executados", "condicoes_encontradas", "modules_cleaned_qty",
    "string_box_qty", "created_at", "updated_at"
  ],
  clientes: [
    "id", "empresa", "cnpj_cpf", "endereco", "cidade", "estado", "cep",
    "latitude", "longitude", "created_at", "updated_at"
  ],
  prestadores: [
    "id", "nome", "email", "telefone", "categoria", "cidade", "estado",
    "ativo", "especialidades", "created_at", "updated_at"
  ],
  equipamentos: [
    "id", "nome", "tipo", "modelo", "fabricante", "numero_serie",
    "status", "localizacao", "data_instalacao", "created_at", "updated_at"
  ],
  insumos: [
    "id", "nome", "categoria", "unidade", "quantidade", "estoque_minimo",
    "estoque_critico", "preco", "fornecedor", "created_at", "updated_at"
  ]
};

function convertToCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    });
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("EXPORT_API_KEY");
    
    if (!expectedApiKey) {
      return new Response(
        JSON.stringify({ error: "API not configured. Please set EXPORT_API_KEY secret." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const table = url.searchParams.get("table");
    const format = url.searchParams.get("format") || "json"; // json or csv
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "1000"), 10000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const orderBy = url.searchParams.get("order_by") || "created_at";
    const orderDir = url.searchParams.get("order_dir") === "asc" ? true : false;
    
    // Filter parameters
    const statusFilter = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const updatedFrom = url.searchParams.get("updated_from");
    const updatedTo = url.searchParams.get("updated_to");

    // List available tables if no table specified
    if (!table) {
      return new Response(
        JSON.stringify({
          available_tables: Object.keys(ALLOWED_TABLES),
          usage: {
            endpoint: `${url.origin}/api-export`,
            parameters: {
              table: "Required. One of: " + Object.keys(ALLOWED_TABLES).join(", "),
              format: "Optional. 'json' (default) or 'csv'",
              limit: "Optional. Max rows to return (default: 1000, max: 10000)",
              offset: "Optional. Skip N rows for pagination",
              order_by: "Optional. Column to sort by (default: created_at)",
              order_dir: "Optional. 'asc' or 'desc' (default: desc)",
              status: "Optional. Filter by status column",
              date_from: "Optional. Filter created_at >= date (YYYY-MM-DD)",
              date_to: "Optional. Filter created_at <= date (YYYY-MM-DD)",
              updated_from: "Optional. Filter updated_at >= date (YYYY-MM-DD or ISO datetime)",
              updated_to: "Optional. Filter updated_at <= date (YYYY-MM-DD or ISO datetime)"
            },
            headers: {
              "x-api-key": "Required. Your API key"
            }
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_TABLES[table]) {
      return new Response(
        JSON.stringify({ 
          error: `Table '${table}' not found or not allowed`,
          available_tables: Object.keys(ALLOWED_TABLES)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    const columns = ALLOWED_TABLES[table].join(",");
    let query = supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: orderDir })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`);
    }
    if (updatedFrom) {
      const updatedFromValue = updatedFrom.includes("T") ? updatedFrom : `${updatedFrom}T00:00:00`;
      query = query.gte("updated_at", updatedFromValue);
    }
    if (updatedTo) {
      const updatedToValue = updatedTo.includes("T") ? updatedTo : `${updatedTo}T23:59:59`;
      query = query.lte("updated_at", updatedToValue);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return based on format
    if (format === "csv") {
      const csv = convertToCSV((data || []) as unknown as Record<string, unknown>[]);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}_export.csv"`
        }
      });
    }

    return new Response(
      JSON.stringify({
        table,
        count: data?.length || 0,
        offset,
        limit,
        data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Export API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
