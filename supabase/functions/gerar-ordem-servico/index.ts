import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import jsPDF from 'https://esm.sh/jspdf@2.5.1'

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

    const { ticketId } = await req.json()
    console.log('[gerar-ordem-servico] Iniciando geração de OS para ticket:', ticketId)

    // Verificar se já existe OS para este ticket
    const { data: existingOS, error: osCheckError } = await supabaseClient
      .from('ordens_servico')
      .select('*, pdf_url')
      .eq('ticket_id', ticketId)
      .maybeSingle()

    if (osCheckError) {
      console.error('[gerar-ordem-servico] Erro ao verificar OS existente:', osCheckError)
    }

    if (existingOS) {
      console.log('[gerar-ordem-servico] OS já existe:', existingOS.numero_os)
      
      // Gerar URL assinada para o PDF existente
      let signedUrl = null
      if (existingOS.pdf_url) {
        const fileName = existingOS.pdf_url.split('/').pop()
        const { data: signedData, error: signedError } = await supabaseClient.storage
          .from('ordens-servico')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 dias

        if (signedError) {
          console.error('[gerar-ordem-servico] Erro ao gerar URL assinada para OS existente:', signedError)
        } else {
          signedUrl = signedData.signedUrl
        }
      }

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

    // Buscar dados do ticket com cliente e técnico
    console.log('[gerar-ordem-servico] Buscando dados do ticket')
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
        ),
        prestadores:tecnico_responsavel_id(
          nome,
          email,
          telefone
        )
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      console.error('[gerar-ordem-servico] Erro ao buscar ticket:', ticketError)
      return new Response(
        JSON.stringify({ error: 'Ticket não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[gerar-ordem-servico] Ticket encontrado:', ticket.numero_ticket)

    // Validar que há um técnico atribuído
    if (!ticket.tecnico_responsavel_id) {
      console.error('[gerar-ordem-servico] Ticket sem técnico atribuído')
      return new Response(
        JSON.stringify({ error: 'É necessário atribuir um técnico antes de gerar a OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar que o ticket está aprovado
    if (ticket.status !== 'aprovado') {
      console.error('[gerar-ordem-servico] Ticket não está aprovado:', ticket.status)
      return new Response(
        JSON.stringify({ error: 'Apenas tickets aprovados com técnico atribuído podem gerar OS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[gerar-ordem-servico] Validações concluídas, gerando número da OS')

    // Gerar número da OS
    const { data: numeroOS } = await supabaseClient
      .rpc('gerar_numero_os')

    console.log('[gerar-ordem-servico] Número da OS gerado:', numeroOS)

    // Criar ordem de serviço no banco
    const { data: ordemServico, error: osError } = await supabaseClient
      .from('ordens_servico')
      .insert({
        ticket_id: ticketId,
        numero_os: numeroOS,
        tecnico_id: ticket.tecnico_responsavel_id,
        data_programada: ticket.data_vencimento,
        qr_code: `OS-${numeroOS}-${ticketId}`
      })
      .select()
      .single()

    if (osError) {
      console.error('[gerar-ordem-servico] Erro ao criar OS no banco:', osError)
      throw osError
    }

    console.log('[gerar-ordem-servico] OS criada no banco, ID:', ordemServico.id)

    // Gerar PDF
    console.log('[gerar-ordem-servico] Gerando PDF')
    const doc = new jsPDF()
    
    // Cabeçalho
    doc.setFontSize(20)
    doc.text('ORDEM DE SERVIÇO', 20, 20)
    
    doc.setFontSize(12)
    doc.text(`N°: ${numeroOS}`, 20, 35)
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 120, 35)
    
    // Dados do cliente
    doc.setFontSize(14)
    doc.text('DADOS DO CLIENTE', 20, 55)
    doc.setFontSize(10)
    
    const cliente = ticket.clientes
    doc.text(`Cliente: ${cliente.empresa || cliente.profiles?.nome || 'N/A'}`, 20, 65)
    doc.text(`Email: ${cliente.profiles?.email || 'N/A'}`, 20, 72)
    doc.text(`Telefone: ${cliente.profiles?.telefone || 'N/A'}`, 20, 79)
    doc.text(`CNPJ/CPF: ${cliente.cnpj_cpf || 'N/A'}`, 20, 86)
    
    // Dados do técnico
    if (ticket.prestadores) {
      doc.text(`Técnico: ${ticket.prestadores.nome}`, 20, 93)
    }
    
    // Endereço
    doc.text('ENDEREÇO DO SERVIÇO:', 20, 100)
    doc.text(ticket.endereco_servico, 20, 107)
    
    // Dados do serviço
    doc.setFontSize(14)
    doc.text('DADOS DO SERVIÇO', 20, 125)
    doc.setFontSize(10)
    
    doc.text(`Título: ${ticket.titulo}`, 20, 135)
    doc.text(`Descrição: ${ticket.descricao}`, 20, 142)
    doc.text(`Equipamento: ${ticket.equipamento_tipo.replace('_', ' ')}`, 20, 149)
    doc.text(`Prioridade: ${ticket.prioridade.toUpperCase()}`, 20, 156)
    
    if (ticket.tempo_estimado) {
      doc.text(`Tempo Estimado: ${ticket.tempo_estimado} horas`, 20, 163)
    }
    
    if (ticket.data_vencimento) {
      doc.text(`Data Programada: ${new Date(ticket.data_vencimento).toLocaleDateString('pt-BR')}`, 20, 170)
    }
    
    // Observações
    if (ticket.observacoes) {
      doc.setFontSize(14)
      doc.text('OBSERVAÇÕES', 20, 190)
      doc.setFontSize(10)
      doc.text(ticket.observacoes, 20, 200)
    }
    
    // Assinaturas
    doc.setFontSize(12)
    doc.text('ASSINATURAS', 20, 230)
    
    doc.setFontSize(10)
    doc.text('_________________________', 20, 250)
    doc.text('Técnico Responsável', 20, 255)
    
    doc.text('_________________________', 120, 250)
    doc.text('Cliente', 120, 255)
    
    // QR Code (simulado com texto)
    doc.text(`QR Code: ${ordemServico.qr_code}`, 20, 270)

    // Converter para buffer
    const pdfBuffer = doc.output('arraybuffer')
    
    console.log('[gerar-ordem-servico] PDF gerado, iniciando upload')

    // Upload para storage
    const fileName = `OS_${numeroOS}_${Date.now()}.pdf`
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('ordens-servico')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf'
      })

    if (uploadError) {
      console.error('[gerar-ordem-servico] Erro ao fazer upload do PDF:', uploadError)
      throw uploadError
    }

    console.log('[gerar-ordem-servico] PDF enviado para storage:', fileName)

    // Gerar URL assinada (válida por 7 dias)
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('ordens-servico')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 dias

    if (signedUrlError) {
      console.error('[gerar-ordem-servico] Erro ao gerar URL assinada:', signedUrlError)
    }

    const signedUrl = signedUrlData?.signedUrl || null
    console.log('[gerar-ordem-servico] URL assinada gerada:', signedUrl ? 'sim' : 'não')

    // Atualizar OS com caminho do arquivo
    await supabaseClient
      .from('ordens_servico')
      .update({ pdf_url: fileName })
      .eq('id', ordemServico.id)

    console.log('[gerar-ordem-servico] OS atualizada com caminho do PDF')

    // Atualizar status do ticket
    const { error: updateTicketError } = await supabaseClient
      .from('tickets')
      .update({ status: 'ordem_servico_gerada' })
      .eq('id', ticketId)

    if (updateTicketError) {
      console.error('[gerar-ordem-servico] Erro ao atualizar status do ticket:', updateTicketError)
    } else {
      console.log('[gerar-ordem-servico] Status do ticket atualizado para ordem_servico_gerada')
    }

    console.log('[gerar-ordem-servico] Processo concluído com sucesso')

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