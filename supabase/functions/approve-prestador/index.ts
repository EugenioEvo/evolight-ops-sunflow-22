import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApproveBody {
  prestador_id: string
  role: 'tecnico_campo' | 'supervisao'
  redirect_to?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth client (validates the caller is staff)
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userErr } = await authClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service client for privileged ops
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is admin or engenharia
    const { data: callerRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    const allowedCaller = ['admin', 'engenharia'].some(r =>
      callerRoles?.some((x: any) => x.role === r)
    )
    if (!allowedCaller) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = (await req.json()) as ApproveBody
    if (!body?.prestador_id || !['tecnico_campo', 'supervisao'].includes(body.role)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load candidate
    const { data: prestador, error: pErr } = await admin
      .from('prestadores')
      .select('*')
      .eq('id', body.prestador_id)
      .single()
    if (pErr || !prestador) {
      return new Response(JSON.stringify({ error: 'Prestador não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (prestador.status_candidatura === 'aprovado' && prestador.user_id) {
      return new Response(JSON.stringify({ error: 'Prestador já aprovado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const email = prestador.email.toLowerCase().trim()
    const redirectTo = body.redirect_to || `${new URL(req.url).origin.replace('functions', 'app')}/reset-password`

    // 1. Find or create auth user
    let authUserId: string | null = null
    const { data: existingByList } = await admin.auth.admin.listUsers()
    const existing = existingByList.users.find(u => u.email?.toLowerCase() === email)

    if (existing) {
      authUserId = existing.id
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { nome: prestador.nome, telefone: prestador.telefone }
      })
      if (inviteErr || !invited.user) {
        return new Response(JSON.stringify({ error: `Falha ao convidar: ${inviteErr?.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      authUserId = invited.user.id
    }

    // 2. Upsert profile
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle()

    let profileId: string
    if (existingProfile) {
      profileId = existingProfile.id
    } else {
      const { data: newProfile, error: profErr } = await admin
        .from('profiles')
        .insert({
          user_id: authUserId,
          nome: prestador.nome,
          email: prestador.email,
          telefone: prestador.telefone,
        })
        .select('id')
        .single()
      if (profErr || !newProfile) {
        return new Response(JSON.stringify({ error: `Falha ao criar profile: ${profErr?.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      profileId = newProfile.id
    }

    // 3. Add role (idempotent)
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', authUserId)
      .eq('role', body.role)
      .maybeSingle()
    if (!existingRole) {
      await admin.from('user_roles').insert({ user_id: authUserId, role: body.role })
    }

    // 4. If técnico, ensure tecnicos row (linked to prestador via FK — no more email matching)
    if (body.role === 'tecnico_campo') {
      const { data: existingTec } = await admin
        .from('tecnicos')
        .select('id, prestador_id')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (!existingTec) {
        await admin.from('tecnicos').insert({
          profile_id: profileId,
          prestador_id: prestador.id,
          especialidades: prestador.especialidades || [],
          regiao_atuacao: prestador.cidade ? `${prestador.cidade}/${prestador.estado || ''}` : '',
          registro_profissional: '',
        })
      } else if (!existingTec.prestador_id) {
        // Backfill the link if técnico already exists but FK is empty
        await admin.from('tecnicos').update({ prestador_id: prestador.id }).eq('id', existingTec.id)
      }
    }

    // 5. Mark prestador approved
    await admin.from('prestadores').update({
      status_candidatura: 'aprovado',
      ativo: true,
      avaliado_por: user.id,
      data_avaliacao: new Date().toISOString(),
      user_id: authUserId,
    }).eq('id', prestador.id)

    return new Response(JSON.stringify({
      success: true,
      message: existing
        ? 'Conta já existente vinculada e role atribuída.'
        : 'Convite enviado por e-mail. O prestador definirá a senha no primeiro acesso.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('approve-prestador error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
