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
    const userRole = metadata.role || 'cliente'
    
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

    // Se for técnico, criar registro na tabela tecnicos E prestadores (pendente aprovação)
    if (userRole === 'tecnico_campo') {
      // Usar service role client para operações administrativas
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Criar registro em prestadores com ativo=false (pendente aprovação)
      const { error: prestadorError } = await serviceClient
        .from('prestadores')
        .insert({
          nome: metadata.nome || user.email?.split('@')[0] || '',
          email: user.email!,
          telefone: metadata.telefone || null,
          categoria: 'tecnico',
          especialidades: metadata.especialidades ? metadata.especialidades.split(',').map((e: string) => e.trim()) : [],
          ativo: false, // Pendente aprovação do admin
        })

      if (prestadorError) {
        console.error('Erro ao criar prestador:', prestadorError)
      }

      // Criar registro em tecnicos
      const { error: tecnicoError } = await serviceClient
        .from('tecnicos')
        .insert({
          profile_id: profile.id,
          registro_profissional: metadata.registro_profissional || '',
          especialidades: metadata.especialidades ? metadata.especialidades.split(',').map((e: string) => e.trim()) : [],
          regiao_atuacao: metadata.regiao_atuacao || '',
        })

      if (tecnicoError) throw tecnicoError

      // Enviar notificação para todos os admins
      const { data: adminRoles } = await serviceClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map((admin: any) => ({
          user_id: admin.user_id,
          tipo: 'novo_prestador',
          titulo: '🆕 Novo Prestador Aguardando Aprovação',
          mensagem: `${metadata.nome || user.email} se cadastrou como técnico e aguarda sua aprovação.`,
          link: '/prestadores',
        }))

        const { error: notifError } = await serviceClient
          .from('notificacoes')
          .insert(notifications)

        if (notifError) {
          console.error('Erro ao criar notificações:', notifError)
        }
      }
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