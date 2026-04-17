// [DOCUMENTAÇÃO] Sends an email to the OS creator when a technician rejects an OS.
// Subject format: "OS Recusada: {numero_os} - {cliente} - {nome_tecnico}"

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

    const { os_id } = await req.json()
    if (!os_id) {
      return new Response(JSON.stringify({ error: 'os_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // [VERIFICADO] Standard typed query — fetch OS + ticket + creator profile + tecnico
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero_os, motivo_recusa,
        tickets!inner(id, created_by, clientes(empresa)),
        tecnicos(profiles(nome))
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
    const tecnicoNome = (os as any).tecnicos?.profiles?.nome || 'Técnico'
    const motivo = (os as any).motivo_recusa || 'Não informado'
    const osLink = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/work-orders/${os.id}`

    const subject = `OS Recusada: ${os.numero_os} - ${clienteNome} - ${tecnicoNome}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">OS Recusada pelo Técnico</h2>
        <p>Olá <strong>${creatorProfile.nome || ''}</strong>,</p>
        <p>O técnico <strong>${tecnicoNome}</strong> recusou a OS <strong>${os.numero_os}</strong> (${clienteNome}).</p>
        <div style="background:#fef2f2;padding:16px;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
          <p style="margin:0;color:#991b1b"><strong>Motivo:</strong> ${motivo}</p>
        </div>
        <p>Acesse a OS para reatribuir a outro técnico:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${osLink}" style="display:inline-block;background:#1a56db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Abrir OS ${os.numero_os}</a>
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
      console.error('[send-rejection-notice] Email failed:', errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // In-app notification to creator
    await supabase.from('notificacoes').insert({
      user_id: createdBy,
      tipo: 'os_recusada_criador',
      titulo: 'OS Recusada',
      mensagem: `O técnico ${tecnicoNome} recusou a OS ${os.numero_os}. Motivo: ${motivo}`,
      link: `/work-orders/${os.id}`,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-rejection-notice] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
