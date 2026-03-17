import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { rme_id } = await req.json()
    if (!rme_id) throw new Error('rme_id é obrigatório')

    // Fetch RME with all related data
    const { data: rme, error: rmeError } = await supabaseAdmin
      .from('rme_relatorios')
      .select(`
        *,
        tickets!inner(
          titulo,
          numero_ticket,
          endereco_servico,
          clientes!inner(empresa)
        ),
        tecnicos!inner(
          profiles!inner(nome, email)
        )
      `)
      .eq('id', rme_id)
      .single()

    if (rmeError || !rme) throw new Error('RME não encontrado')

    // Fetch OS number
    const { data: osData } = await supabaseAdmin
      .from('ordens_servico')
      .select('numero_os')
      .eq('id', rme.ordem_servico_id)
      .single()

    const tecnicoEmail = rme.tecnicos?.profiles?.email
    const tecnicoNome = rme.tecnicos?.profiles?.nome
    if (!tecnicoEmail) throw new Error('Email do técnico não encontrado')

    const numeroOs = osData?.numero_os || '-'
    const cliente = rme.tickets?.clientes?.empresa || '-'
    const titulo = rme.tickets?.titulo || '-'
    const numeroTicket = rme.tickets?.numero_ticket || '-'
    const endereco = rme.tickets?.endereco_servico || '-'
    const dataExecucao = new Date(rme.data_execucao).toLocaleDateString('pt-BR')
    const statusMap: Record<string, string> = {
      pendente: '⏳ Pendente',
      aprovado: '✅ Aprovado',
      rejeitado: '❌ Rejeitado',
    }
    const statusLabel = statusMap[rme.status_aprovacao] || rme.status_aprovacao

    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') || ''
    const projectRef = Deno.env.get('SUPABASE_URL')?.split('//')[1]?.split('.')[0] || ''

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f7; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background: #3F51B5; color: white; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; }
          .content { padding: 24px; }
          .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
          .info-label { font-weight: bold; color: #333; min-width: 140px; }
          .info-value { color: #555; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: bold; }
          .section { margin-top: 20px; }
          .section h3 { color: #3F51B5; font-size: 16px; margin-bottom: 8px; border-bottom: 2px solid #3F51B5; padding-bottom: 4px; }
          .text-block { background: #f8f9fa; padding: 12px; border-radius: 6px; color: #333; white-space: pre-wrap; }
          .footer { background: #f4f4f7; padding: 16px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>RELATÓRIO DE MANUTENÇÃO EXECUTADA</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">OS: ${numeroOs}</p>
          </div>
          <div class="content">
            <p>Olá <strong>${tecnicoNome}</strong>,</p>
            <p>Segue o resumo do seu RME:</p>

            <div class="section">
              <h3>Informações do Chamado</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-weight: bold; color: #333;">Ticket:</td><td style="padding: 6px 0; color: #555;">${numeroTicket} - ${titulo}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #333;">Cliente:</td><td style="padding: 6px 0; color: #555;">${cliente}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #333;">Endereço:</td><td style="padding: 6px 0; color: #555;">${endereco}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #333;">Data de Execução:</td><td style="padding: 6px 0; color: #555;">${dataExecucao}</td></tr>
                <tr><td style="padding: 6px 0; font-weight: bold; color: #333;">Status:</td><td style="padding: 6px 0; color: #555;">${statusLabel}</td></tr>
              </table>
            </div>

            <div class="section">
              <h3>Condições Encontradas</h3>
              <div class="text-block">${rme.condicoes_encontradas || '-'}</div>
            </div>

            <div class="section">
              <h3>Serviços Executados</h3>
              <div class="text-block">${rme.servicos_executados || '-'}</div>
            </div>

            ${rme.observacoes_aprovacao ? `
            <div class="section">
              <h3>Observações da Aprovação</h3>
              <div class="text-block">${rme.observacoes_aprovacao}</div>
            </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>Evolight - Sistema de Gestão de Manutenção</p>
            <p>Este é um email automático, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evolight <agendamento@grupoevolight.com.br>',
        to: [tecnicoEmail],
        subject: `RME - ${numeroOs} | ${cliente} | ${statusLabel}`,
        html: htmlBody,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      throw new Error(`Erro ao enviar email: ${resendData.message || JSON.stringify(resendData)}`)
    }

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
