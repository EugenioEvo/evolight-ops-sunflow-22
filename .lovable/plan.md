

## Contexto

O usuário solicitou o registro de **Instruções Globais de Comportamento** no CORE da memória do projeto. Essas instruções definem padrões rigorosos para:

1. **Consistência de Padrões** — Registrar decisões, inspecionar padrões existentes, nunca divergir sem justificar
2. **Segurança Operacional** — Nunca executar comandos destrutivos sem autorização explícita
3. **Qualidade de Código** — Verificar tipos, tratar erros, funções puras, evitar duplicação
4. **Comunicação** — Distinguir fatos de hipóteses, investigar causas raiz
5. **Arquitetura Incremental** — Fase 0 (análise), Passo 1 (TDD/tipagem/fail-fast), Passo 2 (SOLID/DI), Passo 3 (padrões de projeto), Passo 4 (performance)

## Análise

O arquivo `mem://index.md` atual possui:
- **Core** (linhas 3-7): 4 regras essenciais (Design, Architecture, Security, Flow/Rules)
- **Memories** (linhas 9-95): 86 memórias detalhadas categorizadas

As novas instruções devem ser incorporadas ao **Core** para que sejam aplicadas universalmente em todas as interações futuras, independentemente do contexto específico.

## Plano de Implementação

### 1. Criar arquivo de memória detalhado
**Arquivo:** `mem://processo/global-behavior-guidelines`

Conteúdo:
```markdown
---
name: Global Behavior Guidelines
description: Core AI behavior rules for pattern consistency, operational safety, code quality, communication, and incremental development
type: preference
---

## Consistência de Padrões

- **Inspecionar antes de implementar**: Sempre verificar como o padrão já estabelecido no projeto resolve problemas similares (rotas, stores, componentes, funções)
- **Nunca divergir sem justificar**: Não adotar padrão diferente do existente sem explicar explicitamente e aguardar aprovação
- **Sinalizar inconsistências**: Se detectar inconsistência no código existente, alertar antes de replicá-la
- **Registrar decisões**: Ao tomar decisão de padrão, registrar imediatamente na memória em local adequado com data e motivo
- **Consultar definições**: Sempre ler definições de Stack, API, Banco e Decisões Registradas antes de implementar

## Segurança Operacional

**NUNCA executar comandos irreversíveis ou destrutivos sem descrever o que fazem e aguardar autorização explícita.**

Comandos que SEMPRE requerem aprovação:
- Drops de banco de dados
- Resets de qualquer natureza
- Force push em Git
- `rm -rf` ou equivalentes
- Migrations destrutivas (DROP TABLE, DROP COLUMN, ALTER com perda de dados)
- Sobrescrita de dados em produção
- Qualquer operação que não possa ser desfeita

**Regra**: Em caso de dúvida se um comando é destrutivo, perguntar antes de executar. Preferir sempre o comando mais conservador disponível.

## Qualidade de Código

- **Verificar tipos**: Executar `tsc --noEmit` ou equivalente após cada mudança significativa
- **Nunca assumir sucesso**: Não retornar sucesso sem verificar o resultado real da operação
- **Tratar erros individualmente**: Nunca permitir falhas silenciosas em `Promise.all` ou `try/catch` vazios
- **Funções puras para cálculos**: Funções de cálculo devem ser puras — sem efeitos colaterais
- **Evitar duplicação**: Antes de criar arquivo novo, verificar se já existe algo equivalente no projeto

## Comunicação

- **Distinguir fato de hipótese**: Comunicar claramente entre o que é observado (fato) e o que é suposição (hipótese)
- **Admitir desconhecimento**: Quando não souber a causa de um erro, dizer explicitamente em vez de assumir e agir
- **Investigar causa raiz**: Se uma correção não resolver o problema, investigar a causa raiz antes de propor outra solução
- **Não assumir ambiente**: Não executar ações com base em suposições sobre servidor, hospedagem ou configuração sem evidência concreta

## Arquitetura e Desenvolvimento Incremental

### Fase 0: Análise de Contexto e Tomada de Decisão
Antes de escrever ou refatorar código:
1. Analisar histórico da conversa para entender a natureza do projeto
2. Se faltar contexto para decidir abordagem ou padrão, **PARAR** e fazer perguntas claras
3. Só prosseguir após definir a melhor solução junto ao usuário

### Sequência Incremental (revisar a cada passo se os ajustes não criaram efeitos negativos)

**Passo 1: Fundações, Testes e Defesa**
- **TDD Simulado**: Pensar primeiro nos casos extremos. Definir interfaces/contratos e estrutura dos testes antes de implementar a lógica principal
- **Tipagem Estrita**: Adicionar tipagem explícita para todos os parâmetros, retornos e variáveis importantes
- **Fail-Fast**: Validar os dados logo no início das funções e lançar erros claros imediatamente

**Passo 2: Arquitetura e Modularização**
- **SOLID**: Garantir que classes e funções tenham responsabilidade única (SRP) e respeitem os demais princípios SOLID
- **Injeção de Dependência**: Estruturar o código para receber suas dependências de fora, mantendo tudo desacoplado e testável

**Passo 3: Padrões de Projeto**
- Avaliar e aplicar os Padrões Criacionais, Estruturais ou Comportamentais que melhor resolverem o problema de forma escalável
- Se houver mais de uma opção, explicar brevemente o motivo da escolha baseado no contexto

**Passo 4: Performance e Execução**
- **Async/Concorrência**: Otimizar chamadas de I/O, rede ou banco utilizando programação assíncrona
- **Lazy Evaluation**: Usar generators ou streams para processamento de listas ou arquivos grandes
- **Memoization/Caching**: Otimizar cálculos pesados ou consultas repetitivas armazenando resultados em cache

**Regra de Execução**: Se o código resultante for muito grande, não entregar tudo de uma vez. Explicar o planejamento, entregar as fundações (Passos 1 e 2) e aguardar confirmação para avançar para otimização final.

## Aplicação

Estas regras devem ser aplicadas universalmente em todas as interações, independentemente do contexto específico. São princípios fundamentais que norteiam todas as decisões técnicas e comunicacionais no projeto.
```

### 2. Atualizar `mem://index.md`

Adicionar nova entrada no **Core** (linha 8, antes da seção Memories):

```markdown
- **Process:** Inspect existing patterns before implementing. NEVER execute destructive commands without explicit approval. Verify types after changes. Incremental development: analyze context → TDD/typing/fail-fast → SOLID/DI → design patterns → performance. [Details](mem://processo/global-behavior-guidelines)
```

**Justificativa**: Manter o Core conciso (≤150 chars) com link para detalhes completos, conforme estrutura estabelecida.

### 3. Validação

Após implementação, verificar:
- [ ] Arquivo `mem://processo/global-behavior-guidelines` criado corretamente
- [ ] `mem://index.md` atualizado com nova entrada no Core
- [ ] Todas as 86 memórias existentes preservadas
- [ ] Formatação Markdown consistente

## Impacto

**Positivo:**
- Estabelece diretrizes claras para todas as futuras interações
- Previne execuções destrutivas acidentais
- Garante consistência arquitetural e de padrões
- Melhora qualidade do código gerado
- Reduz retrabalho por decisões inconsistentes

**Atenção:**
- Nenhuma memória existente será alterada ou removida
- Apenas adição de nova regra no Core e novo arquivo de memória detalhado

