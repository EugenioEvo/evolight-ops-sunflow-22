import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const { 
      ticketId, 
      equipe = [], 
      servico_solicitado = 'MANUTENÇÃO',
      inspetor_responsavel = 'TODOS',
      tipo_trabalho = []
    } = await req.json()

    // Verificar se já existe OS
    const { data: existingOS, error: osCheckError } = await supabaseClient
      .from('ordens_servico')
      .select('*, pdf_url')
      .eq('ticket_id', ticketId)
      .maybeSingle()

    if (existingOS) {
      let signedUrl = null
      if (existingOS.pdf_url) {
        const fileName = existingOS.pdf_url
        const { data: signedData } = await supabaseClient.storage
          .from('ordens-servico')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7)

        signedUrl = signedData?.signedUrl
      }

      // Garantir que o status do ticket está atualizado
      await supabaseClient
        .from('tickets')
        .update({ status: 'ordem_servico_gerada' })
        .eq('id', ticketId)

      return new Response(JSON.stringify({ 
        success: true, 
        ordemServico: existingOS,
        pdfUrl: signedUrl,
        message: 'Ordem de serviço já existente'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

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

    // Validar técnico atribuído
    if (!ticket.tecnico_responsavel_id) {
      return new Response(
        JSON.stringify({ error: 'É necessário atribuir um técnico antes de gerar a OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar prestador
    const { data: prestador, error: prestadorError } = await supabaseClient
      .from('prestadores')
      .select('id, nome, email, telefone')
      .eq('id', ticket.tecnico_responsavel_id)
      .single()

    if (prestadorError || !prestador) {
      return new Response(
        JSON.stringify({ error: 'Prestador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar técnico pelo email do prestador (opcional - pode não existir)
    const { data: tecnico } = await supabaseClient
      .from('tecnicos')
      .select('id, profiles!inner(email)')
      .eq('profiles.email', prestador.email)
      .maybeSingle()

    // Log para debug
    console.log(`Prestador: ${prestador.nome} (${prestador.email}), Técnico encontrado: ${tecnico?.id || 'nenhum'}`)

    // Validar status aprovado
    if (ticket.status !== 'aprovado') {
      return new Response(
        JSON.stringify({ error: 'Apenas tickets aprovados com técnico atribuído podem gerar OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar número da OS
    const { data: numeroOS } = await supabaseClient.rpc('gerar_numero_os')

    // Preparar dados da OS com horário previsto se disponível
    const osData: any = {
      ticket_id: ticketId,
      numero_os: numeroOS,
      tecnico_id: tecnico?.id || null,
      data_programada: ticket.data_vencimento,
      qr_code: `OS-${numeroOS}-${ticketId}`,
      equipe: equipe,
      servico_solicitado: servico_solicitado,
      inspetor_responsavel: inspetor_responsavel,
      tipo_trabalho: tipo_trabalho
    }

    // Se o ticket tem horário previsto, definir hora_inicio e calcular hora_fim (estimativa de 1h)
    if (ticket.horario_previsto_inicio) {
      osData.hora_inicio = ticket.horario_previsto_inicio
      
      // Calcular hora_fim somando tempo estimado (ou 1h por padrão)
      const tempoEstimadoHoras = ticket.tempo_estimado || 1
      const [horas, minutos] = ticket.horario_previsto_inicio.split(':').map(Number)
      const horaFimDate = new Date()
      horaFimDate.setHours(horas + tempoEstimadoHoras, minutos, 0, 0)
      osData.hora_fim = horaFimDate.toTimeString().slice(0, 5)
      osData.duracao_estimada_min = tempoEstimadoHoras * 60
    }

    // Criar ordem de serviço
    const { data: ordemServico, error: osError } = await supabaseClient
      .from('ordens_servico')
      .insert(osData)
      .select()
      .single()

    if (osError) {
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
            .update({ 
              latitude, 
              longitude,
              geocoded_at: new Date().toISOString()
            })
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
${ticket.tempo_estimado ? `Tempo Estimado: ${ticket.tempo_estimado} horas` : ''}
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
        contentType: 'text/plain'
      })

    if (uploadError) {
      throw uploadError
    }

    // Gerar URL assinada
    const { data: signedUrlData } = await supabaseClient.storage
      .from('ordens-servico')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7)

    const signedUrl = signedUrlData?.signedUrl || null

    // Atualizar OS com caminho do arquivo
    await supabaseClient
      .from('ordens_servico')
      .update({ pdf_url: fileName })
      .eq('id', ordemServico.id)

    // Atualizar status do ticket
    await supabaseClient
      .from('tickets')
      .update({ status: 'ordem_servico_gerada' })
      .eq('id', ticketId)

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