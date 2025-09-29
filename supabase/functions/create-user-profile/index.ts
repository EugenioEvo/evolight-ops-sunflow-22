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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    // Verificar se o perfil já existe
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingProfile) {
      return new Response(JSON.stringify({ success: true, profile: existingProfile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Criar perfil baseado nos metadados do usuário
    const metadata = user.user_metadata || {}
    
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        user_id: user.id,
        nome: metadata.nome || user.email?.split('@')[0] || '',
        email: user.email!,
        telefone: metadata.telefone,
        role: metadata.role || 'cliente',
      })
      .select()
      .single()

    if (profileError) throw profileError

    // Se for cliente, criar registro na tabela clientes
    if (metadata.role === 'cliente') {
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

    // Se for técnico, criar registro na tabela tecnicos
    if (metadata.role === 'tecnico_campo') {
      const { error: tecnicoError } = await supabaseClient
        .from('tecnicos')
        .insert({
          profile_id: profile.id,
          registro_profissional: metadata.registro_profissional,
          especialidades: metadata.especialidades,
          regiao_atuacao: metadata.regiao_atuacao,
        })

      if (tecnicoError) throw tecnicoError
    }

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