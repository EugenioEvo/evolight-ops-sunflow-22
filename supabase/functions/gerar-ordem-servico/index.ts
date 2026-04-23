import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { create as createJWT, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// [DOCUMENTAÇÃO] djwt v3 — HS256 JWT signing for action-link tokens
async function signActionToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  return await createJWT({ alg: 'HS256', typ: 'JWT' }, payload, key)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // SECURITY: Validate role - only staff can generate OS
    const { data: roleData } = await supabaseClient
      .from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (!roleData || !['admin', 'engenharia', 'supervisao'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { 
      ticketId, 
      equipe = [], 
      servico_solicitado = 'MANUTENÇÃO',
      inspetor_responsavel = 'TODOS',
      tipo_trabalho = [],
      tecnico_override_id = null,
      tecnico_responsavel_id = null,
      horas_previstas = null,
    } = await req.json()

    // Buscar dados do ticket com cliente
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select(`
        *,
        clientes(
          empresa,
          cnpj_cpf,
          endereco,
          cidade,
          estado,
          cep,
          cliente_ufvs(nome),
          profiles(nome, email, telefone)
        )
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determinar o prestador a usar (override ou do ticket)
    const prestadorId = tecnico_override_id || ticket.tecnico_responsavel_id;

    if (!prestadorId) {
      return new Response(
        JSON.stringify({ error: 'É necessário atribuir um técnico antes de gerar a OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar prestador
    const { data: prestador, error: prestadorError } = await supabaseClient
      .from('prestadores')
      .select('id, nome, email, telefone')
      .eq('id', prestadorId)
      .single()

    if (prestadorError || !prestador) {
      return new Response(
        JSON.stringify({ error: 'Prestador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar email do prestador
    if (!prestador.email || prestador.email.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'O técnico atribuído não possui email cadastrado. Atualize o cadastro do prestador antes de gerar a OS.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar técnico pelo email do prestador (case-insensitive)
    const { data: tecnico } = await supabaseClient
      .from('tecnicos')
      .select('id, profiles!inner(email)')
      .ilike('profiles.email', prestador.email)
      .maybeSingle()

    console.log(`Prestador: ${prestador.nome} (${prestador.email}), Técnico encontrado: ${tecnico?.id || 'nenhum'}`)

    // Verificar se já existe OS para este ticket + este técnico específico
    if (tecnico) {
      const { data: existingOS } = await supabaseClient
        .from('ordens_servico')
        .select('id, numero_os')
        .eq('ticket_id', ticketId)
        .eq('tecnico_id', tecnico.id)
        .maybeSingle()

      if (existingOS) {
        // Garantir consistência: ticket deve refletir 'ordem_servico_gerada' mesmo
        // quando a OS já existia (clique duplicado, retomada de fluxo, etc.)
        if (ticket.status === 'aprovado') {
          await supabaseClient
            .from('tickets')
            .update({ status: 'ordem_servico_gerada' })
            .eq('id', ticketId)
        }
        return new Response(JSON.stringify({ 
          success: true, 
          ordemServico: existingOS,
          message: `OS já existente para este técnico: ${existingOS.numero_os}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    // Validar status — aceitar 'aprovado' ou 'ordem_servico_gerada' (multi-técnico)
    if (ticket.status !== 'aprovado' && ticket.status !== 'ordem_servico_gerada') {
      return new Response(
        JSON.stringify({ error: 'Apenas tickets aprovados ou com OS gerada podem gerar novas OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determinar técnico responsável final (recebido ou já no ticket)
    const finalResponsavelId = tecnico_responsavel_id || ticket.tecnico_responsavel_id || prestadorId;

    // Atualizar ticket: garantir tecnico_responsavel_id setado
    if (!ticket.tecnico_responsavel_id || ticket.tecnico_responsavel_id !== finalResponsavelId) {
      await supabaseClient
        .from('tickets')
        .update({ tecnico_responsavel_id: finalResponsavelId })
        .eq('id', ticketId)
    }

    // Gerar número da OS
    const { data: numeroOS } = await supabaseClient.rpc('gerar_numero_os')

    // Preparar dados da OS com horário previsto se disponível
    const osData: any = {
      ticket_id: ticketId,
      numero_os: numeroOS,
      tecnico_id: tecnico?.id || null,
      tecnico_responsavel_id: finalResponsavelId,
      data_programada: ticket.data_servico || ticket.data_vencimento,
      qr_code: `OS-${numeroOS}-${ticketId}`,
      equipe: equipe,
      servico_solicitado: servico_solicitado,
      inspetor_responsavel: inspetor_responsavel,
      tipo_trabalho: tipo_trabalho
    }

    // Janela de execução: usa horas_previstas (por técnico) quando informado; default 1h
    const tempoEstimadoHoras = (typeof horas_previstas === 'number' && horas_previstas > 0)
      ? horas_previstas
      : 1
    osData.duracao_estimada_min = Math.round(tempoEstimadoHoras * 60)

    if (ticket.horario_previsto_inicio) {
      osData.hora_inicio = ticket.horario_previsto_inicio
      const [horas, minutos] = ticket.horario_previsto_inicio.split(':').map(Number)
      const horaFimDate = new Date()
      horaFimDate.setHours(horas + Math.floor(tempoEstimadoHoras), minutos + Math.round((tempoEstimadoHoras % 1) * 60), 0, 0)
      osData.hora_fim = horaFimDate.toTimeString().slice(0, 5)
    }

    // Criar ordem de serviço
    const { data: ordemServico, error: osError } = await supabaseClient
      .from('ordens_servico')
      .insert(osData)
      .select()
      .single()

    // Persistir horas previstas por técnico (para BI Carga de Trabalho)
    if (!osError && ordemServico && tecnico?.id && osData.duracao_estimada_min) {
      const { error: hpError } = await supabaseClient
        .from('horas_previstas_os')
        .insert({
          ordem_servico_id: ordemServico.id,
          tecnico_id: tecnico.id,
          minutos_previstos: osData.duracao_estimada_min,
        })
      if (hpError) console.error('Erro ao salvar horas_previstas_os:', hpError)
    }

    if (osError) {
      // 23505 = unique_violation -> índice ordens_servico_ticket_tecnico_active_unique
      // Protege contra cliques duplos / corridas simultâneas mesmo após a checagem acima.
      if ((osError as any).code === '23505') {
        const { data: dupOS } = await supabaseClient
          .from('ordens_servico')
          .select('id, numero_os')
          .eq('ticket_id', ticketId)
          .eq('tecnico_id', tecnico?.id || '')
          .neq('aceite_tecnico', 'recusado')
          .maybeSingle()

        return new Response(JSON.stringify({
          success: true,
          ordemServico: dupOS,
          message: dupOS
            ? `Já existe uma OS ativa (${dupOS.numero_os}) para este técnico neste ticket.`
            : 'Já existe uma OS ativa para este técnico neste ticket.',
          duplicate: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      throw osError
    }

    // Geocodificar se necessário
    if (!ticket.latitude || !ticket.longitude) {
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ticket.endereco_servico)}&limit=1`
        const geocodeResponse = await fetch(geocodeUrl, {
          headers: { 'User-Agent': 'OrdemServicoApp/1.0' }
        })
        const geocodeData = await geocodeResponse.json()
        if (geocodeData && geocodeData[0]) {
          const latitude = parseFloat(geocodeData[0].lat)
          const longitude = parseFloat(geocodeData[0].lon)
          await supabaseClient
            .from('tickets')
            .update({ latitude, longitude, geocoded_at: new Date().toISOString() })
            .eq('id', ticketId)
        }
      } catch (geocodeError) {
        console.error('Erro ao geocodificar:', geocodeError)
      }
    }

    // Gerar documento de texto
    const pdfContent = `
ORDEM DE SERVIÇO
N°: ${numeroOS}
Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}

DADOS DO CLIENTE
Cliente: ${ticket.clientes.empresa || ticket.clientes.profiles?.nome || 'N/A'}
${ticket.clientes.ufv_solarz ? `UFV/SolarZ: ${ticket.clientes.ufv_solarz}` : ''}
Email: ${ticket.clientes.profiles?.email || 'N/A'}
Telefone: ${ticket.clientes.profiles?.telefone || 'N/A'}
CNPJ/CPF: ${ticket.clientes.cnpj_cpf || 'N/A'}
Técnico: ${prestador.nome}

ENDEREÇO DO SERVIÇO:
${ticket.endereco_servico}

DADOS DO SERVIÇO
Título: ${ticket.titulo}
Descrição: ${ticket.descricao}
Equipamento: ${ticket.equipamento_tipo.replace('_', ' ')}
Prioridade: ${ticket.prioridade.toUpperCase()}
${osData.duracao_estimada_min ? `Tempo Previsto: ${(osData.duracao_estimada_min / 60).toFixed(1)} horas` : ''}
${ticket.data_vencimento ? `Data Programada: ${new Date(ticket.data_vencimento).toLocaleDateString('pt-BR')}` : ''}

${ticket.observacoes ? `OBSERVAÇÕES\n${ticket.observacoes}` : ''}

ASSINATURAS
_________________________    _________________________
Técnico Responsável          Cliente

QR Code: ${ordemServico.qr_code}
`
    const pdfBuffer = new TextEncoder().encode(pdfContent)
    const fileName = `OS_${numeroOS}_${Date.now()}.txt`
    
    const { error: uploadError } = await supabaseClient.storage
      .from('ordens-servico')
      .upload(fileName, pdfBuffer, {
        contentType: 'text/plain; charset=utf-8'
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: signedUrlData } = await supabaseClient.storage
      .from('ordens-servico')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7)

    const signedUrl = signedUrlData?.signedUrl || null

    await supabaseClient
      .from('ordens_servico')
      .update({ pdf_url: fileName })
      .eq('id', ordemServico.id)

    // Atualizar status do ticket
    await supabaseClient
      .from('tickets')
      .update({ status: 'ordem_servico_gerada' })
      .eq('id', ticketId)

    // Enviar email de notificação ao técnico — agora com botões Aceitar / Recusar
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const PROJECT_URL = Deno.env.get('SUPABASE_URL') ?? ''

      if (RESEND_API_KEY && prestador.email) {
        const dataProgramada = ticket.data_servico
          ? new Date(ticket.data_servico).toLocaleDateString('pt-BR')
          : ticket.data_vencimento
            ? new Date(ticket.data_vencimento).toLocaleDateString('pt-BR')
            : 'A definir'

        const horario = osData.hora_inicio && osData.hora_fim
          ? `${osData.hora_inicio} - ${osData.hora_fim}`
          : 'A definir'

        // [DOCUMENTAÇÃO] HS256 JWT for one-shot acceptance/rejection links (7-day exp)
        const actionToken = await signActionToken(
          {
            os_id: ordemServico.id,
            tecnico_id: tecnico?.id || null,
            exp: getNumericDate(60 * 60 * 24 * 7),
          },
          JWT_SECRET
        )

        const actionBase = `${PROJECT_URL}/functions/v1/os-acceptance-action`
        const acceptUrl = `${actionBase}?action=aceitar&token=${actionToken}`
        const rejectUrl = `${actionBase}?action=recusar&token=${actionToken}`

        const clienteNome = ticket.clientes.empresa || ticket.clientes.profiles?.nome || 'Cliente'

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a56db">Nova Ordem de Serviço: ${numeroOS}</h2>
            <p>Olá <strong>${prestador.nome}</strong>,</p>
            <p>Uma nova OS foi atribuída a você:</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Nº OS</strong></td><td style="padding:8px;border:1px solid #ddd">${numeroOS}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Cliente</strong></td><td style="padding:8px;border:1px solid #ddd">${clienteNome}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Serviço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.titulo}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Endereço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.endereco_servico}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Data</strong></td><td style="padding:8px;border:1px solid #ddd">${dataProgramada}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Horário</strong></td><td style="padding:8px;border:1px solid #ddd">${horario}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb"><strong>Prioridade</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.prioridade.toUpperCase()}</td></tr>
            </table>
            <div style="text-align:center;margin:32px 0">
              <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin-right:12px">✅ Aceitar OS</a>
              <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">❌ Recusar OS</a>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:8px">
              Você também pode aceitar ou recusar diretamente no aplicativo.
            </p>
            <p style="color:#6b7280;font-size:14px">— Equipe Evolight O&M</p>
          </div>
        `

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'SunFlow <oem@grupoevolight.com.br>',
            to: [prestador.email],
            subject: `Nova OS Atribuída: ${numeroOS} - ${prestador.nome}`,
            html: emailHtml,
          }),
        })

        if (!emailRes.ok) {
          const errText = await emailRes.text()
          console.error('Erro ao enviar email:', errText)
          await supabaseClient
            .from('ordens_servico')
            .update({ email_error_log: [{ error: errText, timestamp: new Date().toISOString(), type: 'os_criada' }] })
            .eq('id', ordemServico.id)
        } else {
          console.log(`Email enviado para ${prestador.email} - OS ${numeroOS}`)
        }
      }
    } catch (emailError) {
      console.error('Erro ao enviar email ao técnico:', emailError)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      ordemServico,
      pdfUrl: signedUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erro ao gerar OS:', error)
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
