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

    // Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select(`
        *,
        clientes!inner(
          empresa,
          cnpj_cpf,
          endereco,
          cidade,
          estado,
          cep,
          profiles!inner(nome, email, telefone)
        )
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError) throw ticketError

    // Gerar número da OS
    const { data: numeroOS } = await supabaseClient
      .rpc('gerar_numero_os')

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

    if (osError) throw osError

    // Gerar PDF
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
    doc.text(`Cliente: ${cliente.empresa || cliente.profiles.nome}`, 20, 65)
    doc.text(`Email: ${cliente.profiles.email}`, 20, 72)
    doc.text(`Telefone: ${cliente.profiles.telefone || 'N/A'}`, 20, 79)
    doc.text(`CNPJ/CPF: ${cliente.cnpj_cpf || 'N/A'}`, 20, 86)
    
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
    
    // Upload para storage
    const fileName = `OS_${numeroOS}_${Date.now()}.pdf`
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('ordens-servico')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf'
      })

    if (uploadError) throw uploadError

    // Atualizar OS com URL do PDF
    const { data: publicURL } = supabaseClient.storage
      .from('ordens-servico')
      .getPublicUrl(fileName)

    await supabaseClient
      .from('ordens_servico')
      .update({ pdf_url: publicURL.publicUrl })
      .eq('id', ordemServico.id)

    // Atualizar status do ticket
    await supabaseClient
      .from('tickets')
      .update({ status: 'ordem_servico_gerada' })
      .eq('id', ticketId)

    return new Response(JSON.stringify({ 
      success: true, 
      ordemServico,
      pdfUrl: publicURL.publicUrl
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