// Sends an email to the RDO author + everyone in the equipe when an RDO is approved/rejected.
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { rdo_id, decision, motivo } = await req.json()
    if (!rdo_id || !decision) {
      return new Response(JSON.stringify({ error: 'rdo_id and decision required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: rdo } = await supabase
      .from('rdo_relatorios')
      .select('id, numero_rdo, obra_id, responsavel_id, data_rdo')
      .eq('id', rdo_id)
      .maybeSingle()

    if (!rdo) {
      return new Response(JSON.stringify({ error: 'RDO not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve obra
    const { data: obra } = await supabase
      .from('obras')
      .select('nome, cidade, estado')
      .eq('id', (rdo as any).obra_id)
      .maybeSingle()

    // Collect prestador ids: responsavel + equipe
    const prestadorIds = new Set<string>()
    prestadorIds.add((rdo as any).responsavel_id)

    const { data: equipe } = await supabase
      .from('rdo_equipe')
      .select('prestador_id')
      .eq('rdo_id', rdo_id)
    for (const e of equipe || []) prestadorIds.add((e as any).prestador_id)

    // Map prestadores → emails (direct on prestadores.email)
    const { data: prestadores } = await supabase
      .from('prestadores')
      .select('id, email, nome')
      .in('id', Array.from(prestadorIds))

    const recipients = new Set<string>()
    for (const p of prestadores || []) {
      const e = ((p as any).email || '').trim().toLowerCase()
      if (e) recipients.add(e)
    }

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const obraNome = (obra as any)?.nome || 'Obra'
    const numeroRdo = (rdo as any).numero_rdo
    const isApproved = decision === 'aprovado'
    const motivoText = (motivo || '').trim()

    const subject = isApproved
      ? `RDO Aprovado: ${numeroRdo} — ${obraNome}`
      : `RDO Rejeitado: ${numeroRdo} — ${obraNome}`

    const html = isApproved
      ? `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#16a34a">RDO Aprovado</h2>
        <p>O RDO <strong>${numeroRdo}</strong> da obra <strong>${obraNome}</strong> foi aprovado pela gestão.</p>
        ${motivoText ? `<p><strong>Observações:</strong> ${motivoText}</p>` : ''}
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&amp;M</p>
      </div>`
      : `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">RDO Rejeitado</h2>
        <p>O RDO <strong>${numeroRdo}</strong> da obra <strong>${obraNome}</strong> foi rejeitado.</p>
        <div style="background:#fef2f2;padding:16px;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
          <p style="margin:0;color:#991b1b"><strong>Motivo:</strong> ${motivoText || 'Não informado'}</p>
        </div>
        <p>O relatório voltou para o estado de rascunho. O responsável pode editá-lo e reenviar.</p>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&amp;M</p>
      </div>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SunFlow <oem@grupoevolight.com.br>',
        to: Array.from(recipients),
        subject,
        html,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[send-rdo-decision-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, recipients_count: recipients.size }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[send-rdo-decision-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
