// Notifies all staff via email when a technician submits an RME for approval.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { rme_id } = await req.json()
    if (!rme_id) {
      return new Response(JSON.stringify({ error: 'rme_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // RME details
    const { data: rme } = await supabase
      .from('rme_relatorios')
      .select(`
        id, ordem_servico_id,
        tickets!inner(numero_ticket, titulo, clientes(empresa)),
        tecnicos!inner(profiles!inner(nome))
      `)
      .eq('id', rme_id)
      .maybeSingle()

    if (!rme) {
      return new Response(JSON.stringify({ error: 'RME not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Staff emails
    const { data: staffRoles } = await supabase
      .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao'])

    if (!staffRoles || staffRoles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No staff to notify' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userIds = staffRoles.map((r) => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles').select('email').in('user_id', userIds)
    const recipients = (profiles || []).map((p) => p.email).filter(Boolean) as string[]

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No emails found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tecnicoNome = (rme as any).tecnicos?.profiles?.nome || 'Técnico'
    const cliente = (rme as any).tickets?.clientes?.empresa || 'Cliente'
    const titulo = (rme as any).tickets?.titulo || ''
    const numeroTicket = (rme as any).tickets?.numero_ticket || ''
    const subject = `Novo RME para Aprovação: ${numeroTicket} - ${cliente}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">Novo RME Aguardando Aprovação</h2>
        <p>O técnico <strong>${tecnicoNome}</strong> enviou um RME para aprovação.</p>
        <div style="background:#f3f4f6;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0"><strong>Ticket:</strong> ${numeroTicket}${titulo ? ` — ${titulo}` : ''}</p>
          <p style="margin:4px 0"><strong>Cliente:</strong> ${cliente}</p>
        </div>
        <p>Acesse a área de gestão para revisar:</p>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&M</p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SunFlow <oem@grupoevolight.com.br>', to: recipients, subject, html }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[send-rme-submitted-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, recipients_count: recipients.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[send-rme-submitted-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
