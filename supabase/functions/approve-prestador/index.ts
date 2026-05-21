import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ALLOWED_BASE_URLS = [
  'https://sunflow.evolight.com.br',
  'https://evolight-ops-sunflow-22.lovable.app',
  'https://id-preview--974412cb-fff5-4365-b60f-801293d3be32.lovable.app',
]
const DEFAULT_BASE_URL = 'https://sunflow.evolight.com.br'

function resolveBaseUrl(req: Request, explicit?: string): string {
  const candidates = [explicit, req.headers.get('origin') ?? undefined, req.headers.get('referer') ?? undefined]
  for (const raw of candidates) {
    if (!raw) continue
    try {
      const u = new URL(raw)
      const base = `${u.protocol}//${u.host}`
      if (ALLOWED_BASE_URLS.includes(base)) return base
    } catch { /* ignore */ }
  }
  return DEFAULT_BASE_URL
}

type AppRole = 'tecnico_campo' | 'supervisao' | 'eletromecanico' | 'sup_eletromecanico'

interface ApproveBody {
  prestador_id: string
  role: AppRole
  redirect_to?: string
}

const ROLE_LABEL: Record<string, string> = {
  tecnico_campo: 'Técnico de Campo',
  supervisao: 'Supervisão',
  eletromecanico: 'Eletromecânico',
  sup_eletromecanico: 'Supervisor Eletromecânico',
}

async function sendApprovalEmail(params: {
  to: string
  nome: string
  role: string
  actionLink: string
  isNew: boolean
}) {
  if (!RESEND_API_KEY) {
    console.warn('[approve-prestador] RESEND_API_KEY missing — skipping email')
    return { skipped: true as const }
  }
  const roleLabel = ROLE_LABEL[params.role] || params.role
  const subject = params.isNew
    ? `Candidatura aprovada — SunFlow (${roleLabel})`
    : `Acesso SunFlow atualizado — ${roleLabel}`
  const intro = params.isNew
    ? `Sua candidatura foi <strong>aprovada</strong>. Você foi cadastrado no <strong>SunFlow</strong> como <strong>${roleLabel}</strong>. Clique no botão abaixo para definir sua senha e acessar a plataforma.`
    : `Seu acesso ao <strong>SunFlow</strong> foi atualizado com o perfil <strong>${roleLabel}</strong>. Use o link abaixo caso precise redefinir sua senha.`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a56db">SunFlow — Evolight O&amp;M</h2>
      <p>Olá <strong>${params.nome}</strong>,</p>
      <p>${intro}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.actionLink}" style="display:inline-block;background:#1a56db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">
          ${params.isNew ? 'Definir senha e acessar' : 'Redefinir senha'}
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px">Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="word-break:break-all">${params.actionLink}</span>
      </p>
      <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&amp;M</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SunFlow <oem@grupoevolight.com.br>',
      to: [params.to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('[approve-prestador] Resend failed:', detail)
    return { skipped: false as const, error: detail }
  }
  return { skipped: false as const }
}

const ALLOWED_ROLES: AppRole[] = ['tecnico_campo', 'supervisao', 'eletromecanico', 'sup_eletromecanico']
// Roles operacionais de campo que precisam de registro em `tecnicos` (link prestador↔profile).
const FIELD_ROLES: AppRole[] = ['tecnico_campo', 'eletromecanico', 'sup_eletromecanico']

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
    if (!body?.prestador_id || !ALLOWED_ROLES.includes(body.role)) {
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
    const redirectTo = body.redirect_to || `${resolveBaseUrl(req)}/reset-password`

    // 1. Find or create auth user (sem usar inviteUserByEmail — envio via Resend depois)
    let authUserId: string | null = null
    let isNewUser = false
    const { data: existingByList } = await admin.auth.admin.listUsers()
    const existing = existingByList.users.find(u => u.email?.toLowerCase() === email)

    if (existing) {
      authUserId = existing.id
    } else {
      const tempPassword = crypto.randomUUID() + crypto.randomUUID()
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: prestador.nome, telefone: prestador.telefone },
      })
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: `Falha ao criar usuário: ${createErr?.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      authUserId = created.user.id
      isNewUser = true
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

    // 4. Field roles (tecnico_campo, eletromecanico, sup_eletromecanico): ensure tecnicos row
    //    linked to prestador via FK. `tecnicos` é a ponte prestador↔profile usada por RLS.
    if (FIELD_ROLES.includes(body.role)) {
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

    // 6. Generate recovery link e enviar via Resend
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({
        success: true,
        warning: `Prestador aprovado, mas falha ao gerar link: ${linkErr?.message || 'sem link'}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const actionLink = linkData.properties.action_link
    const emailResult = await sendApprovalEmail({
      to: email,
      nome: prestador.nome,
      role: body.role,
      actionLink,
      isNew: isNewUser,
    })

    if (emailResult.error) {
      return new Response(JSON.stringify({
        success: true,
        warning: 'Prestador aprovado, mas o e-mail falhou.',
        action_link: actionLink,
        email_error: emailResult.error,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({
      success: true,
      message: isNewUser
        ? 'Convite enviado por e-mail. O prestador definirá a senha no primeiro acesso.'
        : 'Conta já existente vinculada e role atribuída. E-mail de acesso enviado.',
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
