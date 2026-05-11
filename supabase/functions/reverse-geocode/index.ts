import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const userRoles = (rolesData || []).map((r: { role: string }) => r.role);
    if (!userRoles.some((r: string) => ['admin', 'engenharia', 'supervisao', 'tecnico_campo'].includes(r))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { latitude, longitude } = await req.json();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ success: false, error: 'Coordenadas inválidas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // [VERIFICADO] Nominatim reverse endpoint — https://nominatim.org/release-docs/latest/api/Reverse/
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'pt-BR');
    url.searchParams.set('zoom', '18');

    const resp = await fetch(url.toString(), { headers: { 'User-Agent': 'SunFlow-ReverseGeocoding/1.0' } });
    if (!resp.ok) throw new Error(`Nominatim retornou ${resp.status}`);
    const data = await resp.json();
    if (!data || !data.address) {
      return new Response(JSON.stringify({ success: false, error: 'Endereço não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const a = data.address as Record<string, string>;
    const ufMap: Record<string, string> = {
      'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'
    };
    const uf = a.state ? (ufMap[a.state] ?? (a.state.length === 2 ? a.state.toUpperCase() : '')) : '';
    const rua = [a.road, a.house_number].filter(Boolean).join(', ');
    const enderecoCompleto = [rua, a.suburb || a.neighbourhood].filter(Boolean).join(' - ');
    const cidade = a.city || a.town || a.village || a.municipality || a.county || '';
    const cep = a.postcode || '';

    return new Response(JSON.stringify({
      success: true,
      data: {
        endereco: enderecoCompleto || rua || null,
        cidade: cidade || null,
        estado: uf || null,
        cep: cep || null,
        formatted_address: data.display_name ?? null,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[reverse-geocode] erro:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? 'Erro' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
