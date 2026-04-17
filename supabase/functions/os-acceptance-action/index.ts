// [DOCUMENTAÇÃO] Public edge function (verify_jwt = false) for OS acceptance/rejection via email links.
// Validates HS256 JWT token signed by gerar-ordem-servico. Mirrors logic of in-app useAceiteOS.acceptOS / rejectOS.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { verify as verifyJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function getJwtKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function htmlPage(title: string, body: string, color = '#1a56db'): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f4f6;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:white;max-width:480px;width:100%;padding:32px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08)}h1{color:${color};margin:0 0 12px;font-size:22px}p{color:#374151;line-height:1.5}.btn{display:inline-block;background:${color};color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px}textarea{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:14px;min-height:120px;box-sizing:border-box;margin-top:8px}label{display:block;font-weight:600;color:#111827;margin-top:16px}button{background:#dc2626;color:white;border:0;padding:12px 24px;border-radius:6px;font-weight:600;cursor:pointer;margin-top:16px;font-size:15px}</style></head><body><div class="card">${body}</div></body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

/**
 * Shared promotion logic — mirrors useAceiteOS.acceptOS in the app.
 * If current ticket responsible is null OR has rejected their OS, promote this technician.
 */
async function maybePromoteResponsible(supabase: any, osId: string, ticketId: string, newResponsavelPrestadorId: string | null) {
  if (!newResponsavelPrestadorId) return

  const { data: ticket } = await supabase
    .from('tickets')
    .select('tecnico_responsavel_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return

  const currentResp = ticket.tecnico_responsavel_id
  let shouldPromote = !currentResp

  if (!shouldPromote && currentResp) {
    // Check if current responsible has a refused OS for this ticket
    const { data: respPrestador } = await supabase
      .from('prestadores').select('email').eq('id', currentResp).single()
    if (respPrestador?.email) {
      const { data: respTecnico } = await supabase
        .from('tecnicos').select('id, profiles!inner(email)').ilike('profiles.email', respPrestador.email).maybeSingle()
      if (respTecnico) {
        const { data: refusedOS } = await supabase
          .from('ordens_servico')
          .select('id')
          .eq('ticket_id', ticketId)
          .eq('tecnico_id', respTecnico.id)
          .eq('aceite_tecnico', 'recusado')
          .maybeSingle()
        if (refusedOS) shouldPromote = true
      }
    }
  }

  if (shouldPromote && currentResp !== newResponsavelPrestadorId) {
    // Conditional update prevents race-condition (only first wins)
    await supabase
      .from('tickets')
      .update({ tecnico_responsavel_id: newResponsavelPrestadorId })
      .eq('id', ticketId)
      .or(`tecnico_responsavel_id.is.null,tecnico_responsavel_id.eq.${currentResp}`)

    await supabase
      .from('ordens_servico')
      .update({ tecnico_responsavel_id: newResponsavelPrestadorId })
      .eq('ticket_id', ticketId)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const token = url.searchParams.get('token')

  if (!token || !action) {
    return htmlPage('Link inválido', '<h1>Link inválido</h1><p>O link de ação está incompleto.</p>', '#dc2626')
  }

  // Validate JWT
  let payload: any
  try {
    const key = await getJwtKey()
    payload = await verifyJWT(token, key)
  } catch (e) {
    console.error('JWT verify failed:', e)
    return htmlPage('Link expirado', '<h1>Link inválido ou expirado</h1><p>Solicite um novo email à equipe de gestão.</p>', '#dc2626')
  }

  const osId = payload.os_id as string
  if (!osId) {
    return htmlPage('Token inválido', '<h1>Token inválido</h1>', '#dc2626')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Fetch OS + ticket + tecnico for context
  const { data: os, error: osErr } = await supabase
    .from('ordens_servico')
    .select(`id, numero_os, ticket_id, tecnico_id, aceite_tecnico,
      tickets(id, numero_ticket, cliente_id, clientes(empresa)),
      tecnicos(id, profiles(nome, email))`)
    .eq('id', osId)
    .single()

  if (osErr || !os) {
    return htmlPage('OS não encontrada', '<h1>OS não encontrada</h1>', '#dc2626')
  }

  if (os.aceite_tecnico === 'aceito') {
    return htmlPage('Já aceita', `<h1>OS ${os.numero_os} já está aceita</h1><p>Nenhuma ação adicional necessária.</p>`, '#16a34a')
  }
  if (os.aceite_tecnico === 'recusado') {
    return htmlPage('Já recusada', `<h1>OS ${os.numero_os} já foi recusada</h1><p>Você pode aguardar uma nova atribuição da gestão.</p>`, '#dc2626')
  }

  const tecnicoNome = (os as any).tecnicos?.profiles?.nome || 'Técnico'
  const clienteNome = (os as any).tickets?.clientes?.empresa || 'Cliente'

  // ACEITAR
  if (action === 'aceitar') {
    const { error: updErr } = await supabase
      .from('ordens_servico')
      .update({ aceite_tecnico: 'aceito', aceite_at: new Date().toISOString() })
      .eq('id', osId)

    if (updErr) {
      console.error('Update OS failed:', updErr)
      return htmlPage('Erro', '<h1>Erro ao aceitar OS</h1>', '#dc2626')
    }

    // Find prestadorId from tecnico email (for promotion)
    let prestadorId: string | null = null
    const tecnicoEmail = (os as any).tecnicos?.profiles?.email
    if (tecnicoEmail) {
      const { data: pres } = await supabase.from('prestadores').select('id').ilike('email', tecnicoEmail).maybeSingle()
      prestadorId = pres?.id || null
    }

    await maybePromoteResponsible(supabase, osId, os.ticket_id, prestadorId)

    // Trigger calendar invite via service role token
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-calendar-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ os_id: osId, action: 'create' }),
      })
    } catch (e) {
      console.error('send-calendar-invite failed:', e)
    }

    // In-app notification to staff
    const { data: staffUsers } = await supabase
      .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao'])
    if (staffUsers) {
      await supabase.from('notificacoes').insert(
        staffUsers.map((u: any) => ({
          user_id: u.user_id,
          tipo: 'os_aceita',
          titulo: 'OS Aceita pelo Técnico',
          mensagem: `${tecnicoNome} aceitou a OS ${os.numero_os} (${clienteNome}) via email.`,
          link: `/work-orders/${osId}`,
        }))
      )
    }

    return htmlPage(
      'OS Aceita',
      `<h1>✅ OS ${os.numero_os} aceita com sucesso</h1><p>Olá <strong>${tecnicoNome}</strong>,</p><p>Você aceitou a OS para <strong>${clienteNome}</strong>. Um convite de calendário com os detalhes do agendamento foi enviado para o seu email.</p>`,
      '#16a34a'
    )
  }

  // RECUSAR
  if (action === 'recusar') {
    if (req.method === 'GET') {
      // Render motivo form
      const formHtml = `
        <h1>Recusar OS ${os.numero_os}</h1>
        <p>Olá <strong>${tecnicoNome}</strong>, informe o motivo da recusa para que a gestão possa reagendar ou reatribuir esta OS.</p>
        <form method="POST">
          <label for="motivo">Motivo da recusa *</label>
          <textarea id="motivo" name="motivo" required placeholder="Ex: Conflito de agenda, distância inviável, falta de equipamento..."></textarea>
          <button type="submit">Confirmar Recusa</button>
        </form>
      `
      return htmlPage('Recusar OS', formHtml, '#dc2626')
    }

    // POST: process motivo
    const formData = await req.formData().catch(() => null)
    const motivo = formData?.get('motivo')?.toString().trim()

    if (!motivo) {
      return htmlPage('Erro', '<h1>Motivo obrigatório</h1><p>Volte e informe o motivo.</p>', '#dc2626')
    }

    const { error: updErr } = await supabase
      .from('ordens_servico')
      .update({
        aceite_tecnico: 'recusado',
        aceite_at: new Date().toISOString(),
        motivo_recusa: motivo,
      })
      .eq('id', osId)

    if (updErr) {
      console.error('Update OS failed:', updErr)
      return htmlPage('Erro', '<h1>Erro ao recusar OS</h1>', '#dc2626')
    }

    // Revert ticket if no other accepted OS exists
    const { data: otherActive } = await supabase
      .from('ordens_servico')
      .select('id, aceite_tecnico')
      .eq('ticket_id', os.ticket_id)
      .neq('id', osId)
      .neq('aceite_tecnico', 'recusado')
    if (!otherActive || otherActive.length === 0) {
      await supabase.from('tickets').update({ status: 'aprovado' }).eq('id', os.ticket_id)
    }

    // Notify creator via send-rejection-notice
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-rejection-notice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ os_id: osId }),
      })
    } catch (e) {
      console.error('send-rejection-notice failed:', e)
    }

    // In-app notification to staff
    const { data: staffUsers } = await supabase
      .from('user_roles').select('user_id').in('role', ['admin', 'engenharia', 'supervisao'])
    if (staffUsers) {
      await supabase.from('notificacoes').insert(
        staffUsers.map((u: any) => ({
          user_id: u.user_id,
          tipo: 'os_recusada',
          titulo: 'OS Recusada pelo Técnico',
          mensagem: `${tecnicoNome} recusou a OS ${os.numero_os} (${clienteNome}). Motivo: ${motivo}`,
          link: `/work-orders/${osId}`,
        }))
      )
    }

    return htmlPage(
      'OS Recusada',
      `<h1>OS ${os.numero_os} recusada</h1><p>Sua recusa foi registrada e a gestão foi notificada. Obrigado.</p>`,
      '#dc2626'
    )
  }

  return htmlPage('Ação inválida', '<h1>Ação inválida</h1>', '#dc2626')
})
