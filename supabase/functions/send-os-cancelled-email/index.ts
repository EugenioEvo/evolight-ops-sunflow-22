// Sends an email to the OS creator (and ticket creator) when an OS is cancelled.
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

    const { os_id, motivo } = await req.json()
    if (!os_id) {
      return new Response(JSON.stringify({ error: 'os_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero_os,
        tickets!inner(id, titulo, numero_ticket, created_by, clientes(empresa))
      `)
      .eq('id', os_id)
      .single()

    if (osErr || !os) {
      return new Response(JSON.stringify({ error: 'OS not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const createdBy = (os as any).tickets?.created_by
    if (!createdBy) {
      return new Response(JSON.stringify({ error: 'Ticket has no creator' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: creatorProfile } = await supabase
      .from('profiles').select('email, nome').eq('user_id', createdBy).maybeSingle()

    if (!creatorProfile?.email) {
      return new Response(JSON.stringify({ error: 'Creator has no email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const clienteNome = (os as any).tickets?.clientes?.empresa || 'Cliente'
    const titulo = (os as any).tickets?.titulo || ''
    const motivoText = (motivo || '').trim() || 'Não informado'
    const subject = `OS Cancelada: ${(os as any).numero_os} - ${clienteNome}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">Ordem de Serviço Cancelada</h2>
        <p>Olá <strong>${creatorProfile.nome || ''}</strong>,</p>
        <p>A OS <strong>${(os as any).numero_os}</strong> (${clienteNome}${titulo ? ` — ${titulo}` : ''}) foi cancelada pelo gestor.</p>
        <div style="background:#fef2f2;padding:16px;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
          <p style="margin:0;color:#991b1b"><strong>Motivo:</strong> ${motivoText}</p>
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
      console.error('[send-os-cancelled-email] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[send-os-cancelled-email] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
