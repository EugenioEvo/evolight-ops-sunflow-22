import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateBody {
  nome: string
  email: string
  telefone?: string
  role: 'admin' | 'engenharia'
  redirect_to?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Only admins can create staff users
    const { data: callerRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    const isAdmin = callerRoles?.some((r: any) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar usuários staff' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = (await req.json()) as CreateBody
    if (!body?.nome || !body?.email || !['admin', 'engenharia'].includes(body.role)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos. Role deve ser admin ou engenharia.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const email = body.email.toLowerCase().trim()
    const redirectTo = body.redirect_to || `${new URL(req.url).origin}/reset-password`

    // 1. Find or invite auth user
    let authUserId: string | null = null
    const { data: existingByList } = await admin.auth.admin.listUsers()
    const existing = existingByList.users.find(u => u.email?.toLowerCase() === email)

    if (existing) {
      authUserId = existing.id
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { nome: body.nome, telefone: body.telefone }
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

    if (!existingProfile) {
      const { error: profErr } = await admin
        .from('profiles')
        .insert({
          user_id: authUserId,
          nome: body.nome,
          email,
          telefone: body.telefone ?? null,
        })
      if (profErr) {
        return new Response(JSON.stringify({ error: `Falha ao criar perfil: ${profErr.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
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

    return new Response(JSON.stringify({
      success: true,
      message: existing
        ? `Conta existente vinculada como ${body.role}.`
        : `Convite enviado para ${email}. O usuário definirá a senha no primeiro acesso.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('create-staff-user error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
