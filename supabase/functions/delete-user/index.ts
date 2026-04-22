import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteBody {
  user_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth client validates the caller
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

    // Caller must be admin
    const { data: callerRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    const isAdmin = callerRoles?.some((r: any) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins podem excluir usuários' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = (await req.json()) as DeleteBody
    if (!body?.user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (body.user_id === user.id) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir a própria conta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Locate profile (used to clean up tecnicos/prestadores via FK or email)
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email')
      .eq('user_id', body.user_id)
      .maybeSingle()

    // 1. Remove tecnicos row (if any) — keep prestador as historic record but unlink user
    if (profile) {
      await admin.from('tecnicos').delete().eq('profile_id', profile.id)

      // 2. Unlink prestador (mark inactive + clear user_id) so candidatura história é preservada
      await admin
        .from('prestadores')
        .update({ user_id: null, ativo: false })
        .eq('user_id', body.user_id)
    }

    // 3. Remove all roles
    await admin.from('user_roles').delete().eq('user_id', body.user_id)

    // 4. Remove profile
    if (profile) {
      await admin.from('profiles').delete().eq('id', profile.id)
    }

    // 5. Finally delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id)
    if (delErr) {
      return new Response(JSON.stringify({
        error: `Dados removidos, mas falha ao excluir conta de login: ${delErr.message}`
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('delete-user error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
