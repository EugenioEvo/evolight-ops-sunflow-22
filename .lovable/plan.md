

# Melhorar Layout da Tela de Confirmação de Presença

## Problema
A página `/confirmar-presenca` tem um layout minimalista demais — apenas um card centralizado com fundo claro. Falta branding (logo SunFlow/Evolight), informações contextuais da OS, e não é visualmente profissional para o técnico que acessa pelo celular.

A rota está fora do `ProtectedRoute` (correto, pois técnicos acessam via link externo), mas não tem nenhum branding ou identidade visual.

## Correções

### `src/pages/PresenceConfirmation.tsx`
Redesign completo da página:

1. **Branding**: Adicionar logo/nome "SunFlow" no topo da página
2. **Gradient profissional**: Background com gradiente solar (azul → laranja) alinhado ao design system
3. **Card redesenhado**:
   - Ícones maiores com animação de entrada
   - Tipografia mais clara e hierárquica
   - Separar estados (loading, success, error) com cores e ícones distintos
   - No estado de sucesso, mostrar detalhes da OS extraídos da resposta do edge function (número OS, data, técnico)
4. **Footer**: Texto "Powered by SunFlow" ou similar
5. **Responsivo**: Garantir que funcione bem em telas mobile (o técnico acessa pelo celular)
6. **Estado de sucesso aprimorado**: Adicionar um badge/check animado e informações da OS quando disponíveis

### Detalhes técnicos
- Arquivo único a editar: `src/pages/PresenceConfirmation.tsx`
- Usar variáveis CSS do design system (`--primary`, `--success`, gradientes solares)
- Extrair mais dados da resposta HTML do edge function (número OS, técnico, data) via regex para exibir no card de sucesso
- Sem mudanças de backend necessárias

