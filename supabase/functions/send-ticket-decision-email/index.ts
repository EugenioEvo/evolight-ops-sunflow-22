// [DOCUMENTAÇÃO] Sends an email to the ticket creator when staff approves or rejects the ticket.
// Subject format: "Ticket {numero} {Aprovado|Rejeitado}: {titulo}"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const APP_BASE_URL = 'https://evolight-ops-sunflow-22.lovable.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Auth: must be staff
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).maybeSingle()
    if (!roleData || !['admin', 'engenharia', 'supervisao'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null) as { ticket_id?: string; decision?: 'aprovado' | 'rejeitado'; observacoes?: string } | null
    if (!body?.ticket_id || !body?.decision || !['aprovado', 'rejeitado'].includes(body.decision)) {
      return new Response(JSON.stringify({ error: 'ticket_id and valid decision required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, numero_ticket, titulo, created_by, clientes(empresa)')
      .eq('id', body.ticket_id)
      .single()

    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const createdBy = (ticket as any).created_by
    if (!createdBy) {
      return new Response(JSON.stringify({ error: 'Ticket has no creator' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: creatorProfile } = await supabase
      .from('profiles').select('email, nome').eq('user_id', createdBy).maybeSingle()

    if (!creatorProfile?.email) {
      return new Response(JSON.stringify({ error: 'Creator has no email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const isApproved = body.decision === 'aprovado'
    const clienteNome = (ticket as any).clientes?.empresa || 'Cliente'
    const motivo = (body.observacoes || '').trim()
    const ticketLink = `${APP_BASE_URL}/tickets`

    const subject = isApproved
      ? `Ticket ${ticket.numero_ticket} Aprovado: ${ticket.titulo}`
      : `Ticket ${ticket.numero_ticket} Rejeitado: ${ticket.titulo}`

    const motivoBlock = !isApproved && motivo
      ? `<div style="background:#fef2f2;padding:16px;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
           <p style="margin:0;color:#991b1b"><strong>Motivo da rejeição:</strong> ${motivo}</p>
         </div>`
      : ''

    const headlineColor = isApproved ? '#16a34a' : '#dc2626'
    const headline = isApproved ? 'Seu ticket foi aprovado' : 'Seu ticket foi rejeitado'
    const followUp = isApproved
      ? '<p>Em breve a equipe atribuirá um técnico e gerará a Ordem de Serviço.</p>'
      : '<p>Você pode editar e reenviar o ticket para nova análise.</p>'

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:${headlineColor}">${headline}</h2>
        <p>Olá <strong>${creatorProfile.nome || ''}</strong>,</p>
        <p>O ticket <strong>${ticket.numero_ticket}</strong> — <em>${ticket.titulo}</em> (${clienteNome}) foi <strong>${isApproved ? 'aprovado' : 'rejeitado'}</strong> pela equipe.</p>
        ${motivoBlock}
        ${followUp}
        <div style="text-align:center;margin:24px 0">
          <a href="${ticketLink}" style="display:inline-block;background:#1a56db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Abrir Ticket</a>
        </div>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&M</p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SunFlow <oem@grupoevolight.com.br>',
        to: [creatorProfile.email],
        subject,
        html,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[send-ticket-decision-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-ticket-decision-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
