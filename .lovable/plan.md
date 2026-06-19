# Painel do Cliente — escopo expandido

Hoje, ao entrar como cliente, o usuário vê apenas um resumo básico (informações, tickets, equipamentos, manutenções) sem poder agir. Vamos transformar o painel em um portal self-service alinhado ao que o cliente precisa após ativar a conta.

## O que o cliente verá

A página `/cliente` ganha três áreas, navegáveis por abas:

### 1. Resumo da conta

- Bloco "Informações pessoais": nome, e-mail, telefone, com botão "Editar perfil" (atualiza `profiles`).
- Bloco "Conta": empresa, CNPJ/CPF, endereço completo, prioridade.
- Bloco "Origem do cadastro": badge da origem (Solarz, Conta Azul, Manual), ID Solarz quando houver, e lista de IDs Conta Azul vinculados (somente leitura — sincronizados pelo backoffice).
- Bloco "Minhas UFVs": cards com nome, endereço, potência e status de cada UFV do cliente.

### 2. O&M  
  
Duas sub-abas dentro de "O&M", todas filtradas pelo `cliente_id` do usuário:

- Tickets:
  - Lista paginada de tickets do cliente, com filtros por status e busca.
  - Botão "Abrir novo chamado" abre um formulário (título, descrição, UFV, equipamento, endereço, urgência).
  - Cada ticket pode ser aberto em um drawer/dialog onde o cliente:
    - Vê o histórico de status, OS vinculadas e RME (se houver).
    - **Edita** título, descrição, endereço, prioridade e UFV — somente enquanto o ticket estiver `aberto` ou `aguardando_aprovacao` (alinhado à regra existente que bloqueia edição quando há OS ativa).
    - Pode cancelar o ticket (não excluir — segue a regra "tickets nunca são excluídos").
      &nbsp;

- **Ordens de Serviço**: número, ticket, técnico, data programada, status de aceite, link "Ver OS", link/modal "Ver RME" (relatórios de manutenção dos tickets do cliente, com status (rascunho/pendente/aprovado/rejeitado) e link para visualizar o PDF/preview.)

### 3. Obras (Obra / RDO)

X sub-abas dentro de "Obras", todas filtradas pelo `cliente_id` do usuário:

- **UFV XYZ - Expande abaixo o nome da UFV em formato árvore**: Contendo as informações da aba "Obras" que o administrativo ve (situação, RDOs abertos, etc).

## Regras e permissões

- Todas as queries usam o `cliente_id` resolvido por `profile_id` (já corrigido). Nenhum dado de outro cliente é exposto.
- Ponto importante: o cliente só consegue editar Tickets abertos para o usuário dele que ELE mesmo tenha criado. Tickets criados pelo time operacional/adm/staff o cliente não pode editar. Ele também não pode criar OS a partir do ticket. O cliente apenas pode criar o ticket e nada mais. é permitido que ele altere o ticket até que ele entre em atendimento.
- Edição de ticket só funciona se não houver OS ativa/concluída vinculada (regra `os-generation/edit-restriction-execution`).
- Cancelamento de ticket reaproveita o fluxo `useCancelOS` adaptado para tickets (cascateia para OS, bloqueado por RME em rascunho).
- RLS: confirmar (e adicionar se faltar) políticas de leitura para o cliente em `tickets`, `ordens_servico`, `rme_relatorios`, `rdo_relatorios`, `cliente_ufvs` e `cliente_conta_azul_ids` restritas ao próprio `profile_id` via `clientes.profile_id = auth.uid()` (através de função `is_owner_of_cliente`).
- Origem e IDs Conta Azul são exibidos como somente-leitura.

## Detalhes técnicos

- Página: refatorar `src/pages/ClientDashboard.tsx` em uma estrutura com `Tabs` (`Resumo`, `Tickets`, `Acompanhamento`).
- Novo hook `useClientFullData` (ou estender `useClientDashData`) para buscar UFVs, conta-azul IDs, RDOs das obras do cliente e OS soltas.
- Reutilizar componentes existentes: `TicketForm` (criar/editar), `RMEDetailDialog`, listas de OS de `WorkOrders`. Onde necessário, criar wrappers de leitura sem ações administrativas.
- Função SQL utilitária `is_cliente_owner(_user_id uuid, _cliente_id uuid)` (security definer) para simplificar policies.
- Migration revisa policies SELECT em `cliente_ufvs`, `cliente_conta_azul_ids`, `rdo_relatorios` (cliente lê quando a obra pertence ao seu cliente), `rme_relatorios` (cliente lê quando o ticket é dele).
- Não mexer em layout do backoffice nem nos fluxos de técnico.
- Garantir Notificações push para o cliente (in-app via `notificacoes e via e-mail também`) ao longo do processo.
- Priorizar a utilização de funções que já existam para não termos retrabalho ou várias fontes verdades

## Fora do escopo desta etapa

- Aprovar/rejeitar RME ou OS pelo cliente (continua sendo ação do backoffice).
- Upload de evidências pelo cliente em RDOs/RMEs.
- Edição de UFVs ou IDs Conta Azul.