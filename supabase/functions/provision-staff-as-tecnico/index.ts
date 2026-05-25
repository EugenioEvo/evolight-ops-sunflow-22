// Provisiona (ou desprovisiona) um staff (supervisor/líder/eletromecânico) como técnico escalável.
// Garante prestadores + tecnicos + role 'tecnico_campo'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type AppRole =
  | 'admin' | 'engenharia' | 'supervisao' | 'lider' | 'backoffice'
  | 'sup_eletromecanico' | 'lider_eletromecanico' | 'eletromecanico'
  | 'tecnico_campo' | 'cliente'

const ROLE_TO_CATEGORIA: Partial<Record<AppRole, string>> = {
  sup_eletromecanico: 'sup_eletromecanico',
  lider_eletromecanico: 'lider_eletromecanico',
  eletromecanico: 'eletromecanico',
  supervisao: 'supervisor',
  lider: 'lider',
  tecnico_campo: 'tecnico',
}

function pickCategoria(roles: AppRole[]): string {
  const priority: AppRole[] = ['sup_eletromecanico', 'lider_eletromecanico', 'eletromecanico', 'supervisao', 'lider', 'tecnico_campo']
  for (const r of priority) if (roles.includes(r)) return ROLE_TO_CATEGORIA[r]!
  return 'tecnico'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: userErr } = await authClient.auth.getUser()
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Caller must be admin
    const { data: callerRoles } = await authClient.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (callerRoles ?? []).some((r: any) => r.role === 'admin')
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const profile_id: string | undefined = body?.profile_id
    const action: 'provision' | 'unprovision' = body?.action === 'unprovision' ? 'unprovision' : 'provision'
    if (!profile_id) return new Response(JSON.stringify({ error: 'profile_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('id, user_id, nome, email, telefone')
      .eq('id', profile_id)
      .maybeSingle()
    if (pErr || !profile) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (action === 'unprovision') {
      // Bloqueia se houver OS ativa/futura
      const { data: tec } = await admin.from('tecnicos').select('id').eq('profile_id', profile.id).maybeSingle()
      if (tec?.id) {
        const { count } = await admin.from('ordens_servico')
          .select('id', { count: 'exact', head: true })
          .eq('tecnico_id', tec.id)
          .in('aceite_tecnico', ['pendente', 'aceito', 'aprovado'])
        if ((count ?? 0) > 0) {
          return new Response(JSON.stringify({ error: 'Usuário ainda possui OS ativas. Reatribua antes de remover da escala.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        await admin.from('tecnicos').delete().eq('id', tec.id)
      }
      // Remove role tecnico_campo
      await admin.from('user_roles').delete().eq('user_id', profile.user_id).eq('role', 'tecnico_campo')
      return new Response(JSON.stringify({ ok: true, action }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === provision ===
    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', profile.user_id)
    const roles = (roleRows ?? []).map((r: any) => r.role as AppRole)
    const categoria = pickCategoria(roles)

    // Garante prestadores (match por email)
    let prestadorId: string | null = null
    const { data: existing } = await admin.from('prestadores').select('id').ilike('email', profile.email).maybeSingle()
    if (existing) {
      prestadorId = existing.id
      await admin.from('prestadores').update({
        nome: profile.nome,
        telefone: profile.telefone,
        ativo: true,
        status_candidatura: 'aprovado',
        categoria,
        user_id: profile.user_id,
        updated_at: new Date().toISOString(),
      }).eq('id', prestadorId)
    } else {
      const ins = await admin.from('prestadores').insert({
        nome: profile.nome,
        email: profile.email,
        telefone: profile.telefone,
        categoria,
        ativo: true,
        status_candidatura: 'aprovado',
        data_avaliacao: new Date().toISOString(),
        user_id: profile.user_id,
      }).select('id').single()
      if (ins.error) throw ins.error
      prestadorId = ins.data.id
    }

    // Garante tecnicos
    const { data: existingTec } = await admin.from('tecnicos').select('id, prestador_id').eq('profile_id', profile.id).maybeSingle()
    if (!existingTec) {
      await admin.from('tecnicos').insert({
        profile_id: profile.id,
        prestador_id: prestadorId,
        especialidades: [],
        regiao_atuacao: '',
      })
    } else if (!existingTec.prestador_id) {
      await admin.from('tecnicos').update({ prestador_id: prestadorId }).eq('id', existingTec.id)
    }

    // Garante role tecnico_campo
    await admin.from('user_roles').upsert(
      { user_id: profile.user_id, role: 'tecnico_campo' },
      { onConflict: 'user_id,role', ignoreDuplicates: true }
    )

    return new Response(JSON.stringify({ ok: true, action, prestador_id: prestadorId, categoria }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    console.error('[provision-staff-as-tecnico]', e)
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
