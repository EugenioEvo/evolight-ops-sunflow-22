import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Erro ao obter usuário:', userError)
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se o perfil já existe
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingProfile) {
      return new Response(JSON.stringify({ success: true, profile: existingProfile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Criar perfil baseado nos metadados do usuário
    const metadata = user.user_metadata || {}
    // SECURITY: Only allow 'cliente' role for self-registration
    // Elevated roles must be assigned by admins through the admin panel
    const ALLOWED_SELF_ASSIGN_ROLES = ['cliente']
    const rawRole = metadata.role || 'cliente'
    const userRole = ALLOWED_SELF_ASSIGN_ROLES.includes(rawRole) ? rawRole : 'cliente'
    
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        user_id: user.id,
        nome: metadata.nome || user.email?.split('@')[0] || '',
        email: user.email!,
        telefone: metadata.telefone,
      })
      .select()
      .single()

    if (profileError) throw profileError

    // Criar role na tabela user_roles
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: userRole,
      })

    if (roleError) throw roleError

    // Se for cliente, criar registro na tabela clientes
    if (userRole === 'cliente') {
      const { error: clienteError } = await supabaseClient
        .from('clientes')
        .insert({
          profile_id: profile.id,
          empresa: metadata.empresa,
          cnpj_cpf: metadata.cnpj_cpf,
          endereco: metadata.endereco,
          cidade: metadata.cidade,
          estado: metadata.estado,
          cep: metadata.cep,
        })

      if (clienteError) throw clienteError
    }

    // Roles operacionais (técnico/engenharia/supervisão) NÃO são mais criados via signup público.
    // Esse fluxo agora passa exclusivamente pela aprovação do admin via edge function 'approve-prestador',
    // que recebe o candidato vindo do formulário público /candidatar-se.

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erro ao criar perfil:', error)
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})