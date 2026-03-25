

# Bloqueio de OS sem Email + Email ao Técnico + Sugestão Inteligente

## Resumo
Três melhorias no fluxo de geração de OS:
1. Bloquear geração se técnico não tem email
2. Enviar email ao técnico quando OS é criada
3. Sugerir técnico mais adequado com score

---

## 1. Bloqueio de OS sem email do técnico

### `src/pages/Tickets.tsx`

**`handleGenerateOS`** — Antes de chamar a edge function, buscar o prestador atribuído nos dados locais (`prestadores`) e verificar se `email` existe e não está vazio. Se não tiver, exibir toast destrutivo pedindo atualização do cadastro e retornar sem gerar.

**`handleAssignTechnician`** — Após atribuir com sucesso, verificar se o prestador tem email. Se não tiver, mostrar toast de aviso (não bloqueante, apenas informativo).

### `supabase/functions/gerar-ordem-servico/index.ts`

Após buscar o prestador (linha ~113), adicionar validação:
```typescript
if (!prestador.email || prestador.email.trim() === '') {
  return new Response(
    JSON.stringify({ error: 'O técnico atribuído não possui email cadastrado. Atualize o cadastro do prestador antes de gerar a OS.' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

---

## 2. Enviar email ao técnico na geração da OS

### `supabase/functions/gerar-ordem-servico/index.ts`

Após criar a OS e atualizar o status do ticket (antes do return final ~272), adicionar bloco de envio de email via Resend:

```typescript
// Enviar email de notificação ao técnico
try {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (RESEND_API_KEY && prestador.email) {
    const dataProgramada = ticket.data_vencimento 
      ? new Date(ticket.data_vencimento).toLocaleDateString('pt-BR') 
      : 'A definir'
    
    const horario = osData.hora_inicio && osData.hora_fim
      ? `${osData.hora_inicio} - ${osData.hora_fim}`
      : 'A definir'

    const emailHtml = `
      <h2>Nova Ordem de Serviço: ${numeroOS}</h2>
      <p>Olá <strong>${prestador.nome}</strong>,</p>
      <p>Uma nova OS foi atribuída a você:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Nº OS</strong></td><td style="padding:8px;border:1px solid #ddd">${numeroOS}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Cliente</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.clientes.empresa || ticket.clientes.profiles?.nome || 'N/A'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Serviço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.titulo}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Endereço</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.endereco_servico}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Data</strong></td><td style="padding:8px;border:1px solid #ddd">${dataProgramada}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Horário</strong></td><td style="padding:8px;border:1px solid #ddd">${horario}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Prioridade</strong></td><td style="padding:8px;border:1px solid #ddd">${ticket.prioridade.toUpperCase()}</td></tr>
      </table>
      <p style="margin-top:16px">Acesse o sistema para mais detalhes.</p>
      <p>— Equipe Evolight O&M</p>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'agendamento@grupoevolight.com.br',
        to: [prestador.email],
        subject: `Nova OS Atribuída: ${numeroOS} - ${ticket.clientes.empresa || 'Cliente'}`,
        html: emailHtml,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Erro ao enviar email:', errText)
      // Registrar erro no email_error_log da OS
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
```

Se o ticket também tem `data_programada` + `hora_inicio` + `hora_fim`, opcionalmente chamar `send-calendar-invite` via fetch interno para enviar o .ics (adicional ao email simples).

---

## 3. Sugestão inteligente de técnico

### Novo: `src/components/TechnicianSuggestion.tsx`

Hook/componente que calcula score para cada prestador ativo:

**Dados necessários (já carregados ou query simples):**
- Prestadores ativos (já em `prestadores`)
- OS programadas por técnico na data do ticket: query `ordens_servico` filtrando por `data_programada`
- Coordenadas do ticket atual
- `equipamento_tipo` do ticket vs `especialidades[]` do prestador

**Critérios:**
1. **Agenda livre (40%)** — Conta OS na mesma data. 0 OS = 100%, 1 = 80%, 2 = 60%, 3 = 40%, 4+ = 20%
2. **Distância (30%)** — Haversine entre coordenadas do ticket e coordenadas médias das OS abertas do técnico. < 10km = 100%, < 30km = 70%, < 60km = 40%, > 60km = 20%
3. **Habilidades (30%)** — Match entre `prestador.especialidades` e `ticket.equipamento_tipo`. Match direto = 100%, parcial = 50%, nenhum = 20%

**Score final** = (agenda * 0.4) + (distancia * 0.3) + (habilidades * 0.3)

### `src/pages/Tickets.tsx` — Integração nos Select de técnicos

Nos 4 pontos onde `<SelectContent>` renderiza a lista de prestadores (linhas ~1215, ~1260, ~1313 e dentro do formulário):
- Importar e usar o hook de scoring
- Ordenar prestadores por score decrescente
- Renderizar badge com score ao lado do nome: `{prestador.nome} ⭐ {score}%`
- Destacar o primeiro (recomendado) com cor diferenciada
- Tooltip com breakdown: "Agenda: X OS | Distância: ~Ykm | Habilidades: ✓/✗"

### Lógica de matching equipamento → especialidades:
```typescript
const EQUIPMENT_SKILL_MAP: Record<string, string[]> = {
  'painel_solar': ['painel solar', 'módulo fotovoltaico', 'limpeza de módulos'],
  'inversor': ['inversor', 'eletrônica de potência'],
  'controlador_carga': ['controlador', 'eletrônica'],
  'bateria': ['bateria', 'armazenamento'],
  'cabeamento': ['cabeamento', 'elétrica'],
  'estrutura': ['estrutura', 'mecânica'],
  'monitoramento': ['monitoramento', 'TI', 'comunicação'],
  'outros': []
}
```

---

## Arquivos a editar
1. `src/pages/Tickets.tsx` — Bloqueio + integração de score nos selects
2. `supabase/functions/gerar-ordem-servico/index.ts` — Validação email + envio Resend
3. `src/components/TechnicianSuggestion.tsx` — Novo componente/hook de score

## Sem mudanças de schema
Todas as tabelas necessárias já existem (`ordens_servico`, `prestadores`, `tickets`).

