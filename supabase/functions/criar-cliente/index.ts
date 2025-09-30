import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente com credenciais de serviço para bypass de RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com JWT do usuário para validação de permissões
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('Iniciando criação de cliente');

    // Validar autenticação
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário autenticado:', user.id);

    // Validar role do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'area_tecnica'].includes(profile.role)) {
      console.error('Usuário sem permissão:', profile.role);
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar clientes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário autorizado com role:', profile.role);

    // Receber dados do cliente
    const clienteData = await req.json();
    console.log('Dados recebidos:', clienteData);

    // Gerar user_id único
    const newUserId = crypto.randomUUID();
    
    // Gerar email se não fornecido
    const email = clienteData.email || 
      `${clienteData.empresa.toLowerCase().replace(/\s+/g, '')}_${Date.now()}@cliente.com`;

    console.log('Criando perfil com user_id:', newUserId);

    // Criar profile
    const { data: newProfile, error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: newUserId,
        nome: clienteData.empresa,
        email: email,
        telefone: clienteData.telefone || clienteData.cnpj_cpf,
        role: 'cliente',
        ativo: true
      })
      .select()
      .single();

    if (createProfileError) {
      console.error('Erro ao criar perfil:', createProfileError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar perfil do cliente',
          details: createProfileError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Perfil criado:', newProfile.id);

    // Criar cliente
    const { data: newCliente, error: createClienteError } = await supabaseAdmin
      .from('clientes')
      .insert({
        profile_id: newProfile.id,
        empresa: clienteData.empresa,
        cnpj_cpf: clienteData.cnpj_cpf,
        endereco: clienteData.endereco,
        cidade: clienteData.cidade,
        estado: clienteData.estado,
        cep: clienteData.cep
      })
      .select()
      .single();

    if (createClienteError) {
      console.error('Erro ao criar cliente:', createClienteError);
      
      // Rollback: deletar o profile criado
      console.log('Fazendo rollback - deletando perfil:', newProfile.id);
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', newProfile.id);

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar cliente',
          details: createClienteError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cliente criado com sucesso:', newCliente.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: { 
          cliente: newCliente,
          profile: newProfile
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
