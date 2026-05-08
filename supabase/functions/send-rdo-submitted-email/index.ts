// Notifies all staff via email when a supervisor submits an RDO for approval.
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { rdo_id } = await req.json()
    if (!rdo_id) {
      return new Response(JSON.stringify({ error: 'rdo_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: obra }, { data: responsavel }] = await Promise.all([
      supabase.from('obras').select('nome, cidade, estado').eq('id', (rdo as any).obra_id).maybeSingle(),
      supabase.from('prestadores').select('nome').eq('id', (rdo as any).responsavel_id).maybeSingle(),
    ])

    // Staff emails
    const { data: staffRoles } = await supabase
      .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao'])

    const userIds = Array.from(new Set((staffRoles || []).map((r: any) => r.user_id)))
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No staff' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profiles } = await supabase
      .from('profiles').select('email').in('user_id', userIds)
    const recipientsSet = new Set<string>()
    for (const p of profiles || []) {
      const norm = ((p as any).email || '').trim().toLowerCase()
      if (norm) recipientsSet.add(norm)
    }
    const recipients = Array.from(recipientsSet)
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No emails' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const obraNome = (obra as any)?.nome || 'Obra'
    const cidade = (obra as any)?.cidade ? `${(obra as any).cidade}${(obra as any).estado ? `/${(obra as any).estado}` : ''}` : ''
    const respNome = (responsavel as any)?.nome || 'Responsável'
    const numeroRdo = (rdo as any).numero_rdo
    const subject = `Novo RDO para Aprovação: ${numeroRdo} — ${obraNome}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">Novo RDO Aguardando Aprovação</h2>
        <p>O supervisor <strong>${respNome}</strong> enviou um RDO para aprovação.</p>
        <div style="background:#f3f4f6;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0"><strong>Número:</strong> ${numeroRdo}</p>
          <p style="margin:4px 0"><strong>Obra:</strong> ${obraNome}${cidade ? ` (${cidade})` : ''}</p>
          <p style="margin:4px 0"><strong>Data:</strong> ${(rdo as any).data_rdo}</p>
        </div>
        <p>Acesse a área de aprovação de RDOs para revisar.</p>
        <p style="color:#6b7280;font-size:13px">— Equipe Evolight O&amp;M</p>
      </div>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SunFlow <oem@grupoevolight.com.br>', to: recipients, subject, html }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('[send-rdo-submitted-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, recipients_count: recipients.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-rdo-submitted-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
