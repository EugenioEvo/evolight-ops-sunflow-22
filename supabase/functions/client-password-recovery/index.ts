// Client password recovery / first-access flow
// - Verifies the email belongs to a registered cliente in `clientes`
// - Provisions auth user + profile + role 'cliente' on first access
// - Generates a recovery link via Supabase Admin and emails it via Resend
// Always responds 200 with a generic message to prevent email enumeration.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const FROM_EMAIL = 'SunFlow <oem@grupoevolight.com.br>'
const APP_NAME = 'SunFlow Evolight'

const GENERIC_OK = {
  ok: true,
  message: 'Se este e-mail estiver cadastrado, enviaremos instruções em instantes.',
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text())
    return false
  }
  return true
}

function buildEmailHtml(opts: {
  recipientName: string
  link: string
  isFirstAccess: boolean
}) {
  const title = opts.isFirstAccess ? 'Defina sua senha de acesso' : 'Redefina sua senha'
  const intro = opts.isFirstAccess
    ? 'Identificamos seu cadastro como cliente Evolight. Para acessar o portal, defina sua senha:'
    : 'Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para continuar:'
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">${title}</h1>
    <p style="margin:0 0 12px">Olá, ${opts.recipientName || 'cliente'}!</p>
    <p style="margin:0 0 20px">${intro}</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.link}" style="background:#facc15;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
        ${opts.isFirstAccess ? 'Definir senha' : 'Redefinir senha'}
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px">Se o botão não funcionar, copie e cole o link no navegador:</p>
    <p style="font-size:12px;color:#3b82f6;word-break:break-all">${opts.link}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0">Se você não solicitou este e-mail, ignore-o.</p>
    <p style="font-size:12px;color:#9ca3af;margin:8px 0 0">${APP_NAME}</p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const rawEmail = String(body?.email ?? '').trim().toLowerCase()
    const redirectTo: string = body?.redirectTo || ''

    if (!isValidEmail(rawEmail)) {
      return new Response(JSON.stringify({ ok: false, error: 'E-mail inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) Check auth.users FIRST
    let authUserId: string | null = null
    let authUserName: string | null = null
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const found = list?.users?.find(
        (u) => (u.email ?? '').toLowerCase() === rawEmail,
      )
      if (found) {
        authUserId = found.id
        authUserName =
          (found.user_metadata as Record<string, unknown> | null)?.nome as string | null ?? null
      }
    } catch (e) {
      console.error('listUsers failed', e)
    }

    let isFirstAccess = false
    let displayName = authUserName || 'usuário'

    // 2) If not found in auth, try clientes (email pode estar em profiles OU em cliente_conta_azul_ids)
    if (!authUserId) {
      // 2a) Procurar via profile.email vinculado
      let cliente: { id: string; empresa: string | null; nome?: string | null } | null = null;

      const { data: viaProfile } = await admin
        .from('clientes')
        .select('id, empresa, profile_id, profiles!inner(email, nome)')
        .ilike('profiles.email', rawEmail)
        .maybeSingle();

      if (viaProfile) {
        const p = (viaProfile as unknown as { profiles?: { nome?: string | null } }).profiles;
        cliente = { id: viaProfile.id, empresa: viaProfile.empresa, nome: p?.nome ?? null };
      }

      // 2b) Fallback: procurar via cliente_conta_azul_ids
      if (!cliente) {
        const { data: viaCA } = await admin
          .from('cliente_conta_azul_ids')
          .select('cliente_id, nome_fiscal, clientes!inner(id, empresa)')
          .ilike('email', rawEmail)
          .maybeSingle();

        if (viaCA) {
          const c = (viaCA as unknown as { clientes?: { id: string; empresa: string | null } }).clientes;
          if (c) cliente = { id: c.id, empresa: c.empresa, nome: viaCA.nome_fiscal ?? null };
        }
      }

      // 3) Not in auth and not in clientes → redirect to prestador signup
      if (!cliente) {
        return new Response(
          JSON.stringify({
            ok: false,
            notFound: true,
            redirectTo: '/candidatar-se',
            message:
              'E-mail não encontrado em nossos cadastros. Você pode se candidatar como prestador.',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Cliente exists → provision auth user + profile + role
      displayName = cliente.nome || cliente.empresa || 'cliente'
      isFirstAccess = true

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: rawEmail,
        email_confirm: true,
        user_metadata: { nome: displayName, cliente_id: cliente.id },
      })
      if (createErr || !created.user) {
        console.error('createUser failed', createErr)
        return new Response(JSON.stringify(GENERIC_OK), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      authUserId = created.user.id

      const { error: profErr } = await admin.from('profiles').upsert(
        {
          user_id: authUserId,
          nome: displayName,
          email: rawEmail,
          ativo: true,
        },
        { onConflict: 'user_id' },
      )
      if (profErr) console.error('profile upsert error', profErr)

      const { error: roleErr } = await admin
        .from('user_roles')
        .insert({ user_id: authUserId, role: 'cliente' })
      if (roleErr && !String(roleErr.message).includes('duplicate')) {
        console.error('role insert error', roleErr)
      }
    }

    // 4) Generate recovery link (auth user now guaranteed)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: rawEmail,
      options: {
        redirectTo: redirectTo || `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/reset-password`,
      },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('generateLink error', linkErr)
      return new Response(JSON.stringify(GENERIC_OK), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prefer a direct app URL with token_hash so the frontend can verify the OTP itself.
    // This avoids the hosted auth redirect issuing an implicit refresh-token URL that can
    // be consumed during redirects before the reset page finishes mounting.
    const appResetUrl = redirectTo || `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/reset-password`
    const hashedToken = linkData.properties.hashed_token
    const actionLink = hashedToken
      ? `${appResetUrl}${appResetUrl.includes('?') ? '&' : '?'}token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
      : linkData.properties.action_link

    // 5) Send email via Resend
    await sendEmail(
      rawEmail,
      isFirstAccess ? `${APP_NAME} — Defina sua senha` : `${APP_NAME} — Redefinição de senha`,
      buildEmailHtml({ recipientName: displayName, link: actionLink, isFirstAccess }),
    )

    return new Response(JSON.stringify(GENERIC_OK), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('unexpected error', e)
    // Still return generic OK to avoid leaking errors to UI
    return new Response(JSON.stringify(GENERIC_OK), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
