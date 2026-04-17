// Sends an email to the RME author + technicians of all linked OSs when an RME is approved/rejected.
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

    const { rme_id, decision, motivo } = await req.json()
    if (!rme_id || !decision) {
      return new Response(JSON.stringify({ error: 'rme_id and decision required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: rme } = await supabase
      .from('rme_relatorios')
      .select(`
        id, ticket_id, ordem_servico_id, tecnico_id,
        tickets!inner(numero_ticket, titulo, clientes(empresa)),
        tecnicos!inner(profiles!inner(email, nome))
      `)
      .eq('id', rme_id)
      .maybeSingle()

    if (!rme) {
      return new Response(JSON.stringify({ error: 'RME not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Author email
    const recipients = new Set<string>()
    const authorEmail = (rme as any).tecnicos?.profiles?.email
    if (authorEmail) recipients.add(authorEmail)

    // Technicians of linked accepted OSs
    const { data: linkedOS } = await supabase
      .from('ordens_servico')
      .select('tecnico_id, tecnicos(profiles(email))')
      .eq('ticket_id', rme.ticket_id)
      .neq('aceite_tecnico', 'recusado')

    for (const os of linkedOS || []) {
      const email = (os as any).tecnicos?.profiles?.email
      if (email) recipients.add(email)
    }

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const cliente = (rme as any).tickets?.clientes?.empresa || 'Cliente'
    const numeroTicket = (rme as any).tickets?.numero_ticket || ''
    const titulo = (rme as any).tickets?.titulo || ''
    const isApproved = decision === 'aprovado'
    const motivoText = (motivo || '').trim()

    const subject = isApproved
      ? `RME Aprovado: ${numeroTicket} - ${cliente}`
      : `RME Rejeitado: ${numeroTicket} - ${cliente}`

    const html = isApproved
      ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">RME Aprovado</h2>
        <p>O RME vinculado ao ticket <strong>${numeroTicket}</strong>${titulo ? ` (${titulo})` : ''} para o cliente <strong>${cliente}</strong> foi aprovado pela gestão.</p>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&M</p>
      </div>`
      : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">RME Rejeitado</h2>
        <p>O RME vinculado ao ticket <strong>${numeroTicket}</strong>${titulo ? ` (${titulo})` : ''} para o cliente <strong>${cliente}</strong> foi rejeitado.</p>
        <div style="background:#fef2f2;padding:16px;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
          <p style="margin:0;color:#991b1b"><strong>Motivo:</strong> ${motivoText || 'Não informado'}</p>
        </div>
        <p>O relatório voltou para o estado de rascunho. O técnico responsável pode editá-lo e reenviar.</p>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&M</p>
      </div>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SunFlow <oem@grupoevolight.com.br>', to: Array.from(recipients), subject, html }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[send-rme-decision-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, recipients_count: recipients.size }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[send-rme-decision-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
