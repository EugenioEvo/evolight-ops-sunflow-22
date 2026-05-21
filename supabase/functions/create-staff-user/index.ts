import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_BASE_URL = 'https://evolight-ops-sunflow-22.lovable.app'

interface CreateBody {
  nome: string
  email: string
  telefone?: string
  role: 'admin' | 'engenharia' | 'supervisao' | 'backoffice'
  redirect_to?: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  engenharia: 'Engenharia',
  supervisao: 'Supervisão',
  backoffice: 'Backoffice',
}

async function sendInviteEmail(params: {
  to: string
  nome: string
  role: string
  actionLink: string
  isNew: boolean
}) {
  if (!RESEND_API_KEY) {
    console.warn('[create-staff-user] RESEND_API_KEY missing — skipping email')
    return { skipped: true }
  }

  const roleLabel = ROLE_LABEL[params.role] || params.role
  const subject = params.isNew
    ? `Convite SunFlow — ${roleLabel}`
    : `Acesso SunFlow atualizado — ${roleLabel}`

  const intro = params.isNew
    ? `Você foi convidado para acessar o <strong>SunFlow</strong> como <strong>${roleLabel}</strong>. Clique no botão abaixo para definir sua senha e entrar.`
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
    console.error('[create-staff-user] Resend failed:', detail)
    return { skipped: false, error: detail }
  }
  return { skipped: false }
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
    const VALID_ROLES = ['admin', 'engenharia', 'supervisao', 'backoffice']
    if (!body?.nome || !body?.email || !VALID_ROLES.includes(body.role)) {
      return new Response(JSON.stringify({ error: `Dados inválidos. Role deve ser uma de: ${VALID_ROLES.join(', ')}.` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const email = body.email.toLowerCase().trim()
    const redirectTo = body.redirect_to || `${APP_BASE_URL}/reset-password`

    // 1. Find or create auth user (sem usar inviteUserByEmail → evita SMTP padrão do Supabase)
    let authUserId: string | null = null
    let isNewUser = false

    const { data: existingByList } = await admin.auth.admin.listUsers()
    const existing = existingByList.users.find(u => u.email?.toLowerCase() === email)

    if (existing) {
      authUserId = existing.id
    } else {
      // Cria usuário diretamente com senha aleatória; ele definirá a real pelo link de recovery
      const tempPassword = crypto.randomUUID() + crypto.randomUUID()
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: body.nome, telefone: body.telefone },
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

    // 4. Generate recovery link e enviar via Resend (mesmo padrão dos demais e-mails do projeto)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({
        error: `Usuário criado, mas falha ao gerar link: ${linkErr?.message || 'sem link'}`,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const actionLink = linkData.properties.action_link

    const emailResult = await sendInviteEmail({
      to: email,
      nome: body.nome,
      role: body.role,
      actionLink,
      isNew: isNewUser,
    })

    if (emailResult.error) {
      return new Response(JSON.stringify({
        success: true,
        warning: 'Usuário criado, mas o e-mail falhou.',
        action_link: actionLink,
        email_error: emailResult.error,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({
      success: true,
      message: isNewUser
        ? `Convite enviado para ${email}. O usuário definirá a senha no primeiro acesso.`
        : `Conta existente vinculada como ${body.role}. E-mail de acesso enviado.`,
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
