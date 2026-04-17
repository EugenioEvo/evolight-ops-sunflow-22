// [DOCUMENTAÇÃO] Resends the OS acceptance email (with Aceitar/Recusar buttons) to the assigned technician.
// Used after reassignment in WorkOrderDetail when an OS was previously refused.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { create as createJWT, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

async function signActionToken(payload: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  )
  return await createJWT({ alg: 'HS256', typ: 'JWT' }, payload, key)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate user is staff
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: claims } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', claims.claims.sub).maybeSingle()
    if (!roleData || !['admin', 'engenharia', 'supervisao'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { os_id } = await req.json()
    if (!os_id) {
      return new Response(JSON.stringify({ error: 'os_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch OS + ticket + tecnico
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero_os, hora_inicio, hora_fim, data_programada, tecnico_id,
        tickets!inner(titulo, prioridade, endereco_servico, data_servico, data_vencimento, clientes(empresa)),
        tecnicos!inner(id, profiles(nome, email))
      `)
      .eq('id', os_id)
      .single()

    if (osErr || !os) {
      return new Response(JSON.stringify({ error: 'OS not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tecnicoEmail = (os as any).tecnicos?.profiles?.email
    const tecnicoNome = (os as any).tecnicos?.profiles?.nome || 'Técnico'
    if (!tecnicoEmail) {
      return new Response(JSON.stringify({ error: 'Technician has no email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const clienteNome = (os as any).tickets?.clientes?.empresa || 'Cliente'
    const ticket = (os as any).tickets

    const dataProgramada = os.data_programada
      ? new Date(os.data_programada).toLocaleDateString('pt-BR')
      : 'A definir'
    const horario = os.hora_inicio && os.hora_fim ? `${os.hora_inicio} - ${os.hora_fim}` : 'A definir'

    const actionToken = await signActionToken({
      os_id: os.id,
      tecnico_id: os.tecnico_id,
      exp: getNumericDate(60 * 60 * 24 * 7),
    })

    const actionBase = `${SUPABASE_URL}/functions/v1/os-acceptance-action`
    const acceptUrl = `${actionBase}?action=aceitar&token=${actionToken}`
    const rejectUrl = `${actionBase}?action=recusar&token=${actionToken}`

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">OS Reatribuída a você: ${os.numero_os}</h2>
        <p>Olá <strong>${tecnicoNome}</strong>,</p>
        <p>A OS abaixo foi atribuída a você:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Nº OS</strong></td><td style="padding:8px;border:1px solid #ddd">${os.numero_os}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Cliente</strong></td><td style="padding:8px;border:1px solid #ddd">${clienteNome}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Serviço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.titulo}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Endereço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.endereco_servico}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Data</strong></td><td style="padding:8px;border:1px solid #ddd">${dataProgramada}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Horário</strong></td><td style="padding:8px;border:1px solid #ddd">${horario}</td></tr>
        </table>
        <div style="text-align:center;margin:32px 0">
          <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin-right:12px">✅ Aceitar OS</a>
          <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">❌ Recusar OS</a>
        </div>
        <p style="color:#6b7280;font-size:14px">— Equipe Evolight O&M</p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SunFlow <oem@grupoevolight.com.br>',
        to: [tecnicoEmail],
        subject: `Nova OS Atribuída: ${os.numero_os} - ${tecnicoNome}`,
        html: emailHtml,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[resend-os-acceptance-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[resend-os-acceptance-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
