

# Recibo de Confirmação de Presença

## Problema
Após confirmar presença, o técnico vê apenas uma tela de sucesso sem opção de salvar um comprovante. Não há recibo formal.

## Solução
Adicionar na tela de sucesso (`PresenceConfirmation.tsx`) um botão "Baixar Comprovante" que gera um recibo visual em PDF ou imagem compartilhável.

---

## Implementação

### 1. `src/pages/PresenceConfirmation.tsx`

- Extrair mais detalhes da resposta HTML: endereço, cliente (se disponível)
- Após status `success`, renderizar botão "Baixar Comprovante"
- Ao clicar, gerar um canvas/imagem com layout de recibo contendo:
  - Logo SunFlow + branding
  - Número da OS
  - Serviço, Data/Hora, Técnico
  - Timestamp da confirmação (hora atual formatada)
  - Texto: "Presença confirmada com sucesso"
  - Código de verificação (últimos 8 chars do token)
- Usar `html2canvas` ou canvas nativo para gerar imagem PNG baixável
- Adicionar também botão "Compartilhar" (Web Share API) para mobile

### 2. Dependência

- Instalar `html2canvas` para captura do recibo como imagem
- Alternativa: usar canvas nativo (sem dependência extra) para desenhar o recibo programaticamente

### 3. Layout do recibo

```text
┌─────────────────────────────┐
│     ☀ SunFlow               │
│  Comprovante de Presença    │
│─────────────────────────────│
│  OS: OS000123               │
│  Serviço: Manutenção Prev.  │
│  Data: 25/03/2026 às 08:00  │
│  Técnico: João Silva        │
│─────────────────────────────│
│  ✅ Presença confirmada     │
│  em 25/03/2026 às 07:45     │
│                             │
│  Código: A1B2C3D4           │
│─────────────────────────────│
│  Evolight Solar O&M         │
└─────────────────────────────┘
```

### 4. Detalhes técnicos

- Renderizar um `div` oculto com o layout do recibo (ref)
- `html2canvas` captura esse div como PNG
- Download automático: `recibo-OS000123.png`
- Web Share API para compartilhar em mobile (WhatsApp, etc.)
- Fallback: se Web Share não disponível, mostrar apenas botão de download

## Arquivos
1. `src/pages/PresenceConfirmation.tsx` — adicionar recibo + botões
2. `package.json` — adicionar `html2canvas`

