

# Auditoria de Cadastros Existentes

## Resumo dos dados encontrados

### user_roles (12 registros)
| Nome | Email | Role Atual |
|---|---|---|
| Amanda Barbosa | gerenciadeprojetos@grupoevolight.com.br | **admin** |
| Eugenio Garcia | eugenio@grupoevolight.com.br | **admin** |
| Edson Eulalio | manutencao@grupoevolight.com.br | **area_tecnica** |
| Jonh Lucas M Soares | jonh.lucas@grupoevolight.com.br | **area_tecnica** |
| Weldner Alves | weldner@grupoevolight.com.br | **area_tecnica** |
| ADRIAN | adrianmateuszl2k@gmail.com | tecnico_campo |
| DIEGO | diego14borges@gmail.com | tecnico_campo |
| HERCULES ALVES VIEIRA | hercules.vieira@grupoevolight.com.br | tecnico_campo |
| WEBERSON | weberson_gt@live.com | tecnico_campo |
| ze faisca | eugenio.garcia@me.com | tecnico_campo |
| zezinho das couves | genin.garcia@gmail.com | tecnico_campo |
| ⚠️ SEM PERFIL | (user_id: b18c5e50...) | tecnico_campo |

---

## Problemas encontrados

### 1. Registro órfão
- Um `user_role` com `tecnico_campo` existe para user_id `b18c5e50...` mas **não tem profile associado**. Deve ser removido.

### 2. Contas de teste
- **ze faisca** (eugenio.garcia@me.com) — parece conta de teste do Eugenio
- **zezinho das couves** (genin.garcia@gmail.com) — parece conta de teste

### 3. Duplicatas na tabela prestadores
- **ze faisca** tem **2 registros** em prestadores (emails `eugenio.garcia@me.com` e `Eugenio.garcia@me.com` — diferença de capitalização)
- **Eugenio Garcia** (admin) tem registro como prestador/tecnico — inconsistente
- **Edson Eulalio** (area_tecnica) tem registro como prestador/tecnico — pode ser correto se ele também atua em campo

### 4. Categorias em prestadores já existentes
- ADTLHYER ARTHUR e JONH LUCAS já têm `categoria: engenharia` na tabela prestadores
- Weldner Alves tem `categoria: tecnico` mas role `area_tecnica` — inconsistente

### 5. Migração area_tecnica → novos roles
Os 3 usuários com `area_tecnica` precisam de definição:

| Nome | Sugestão | Justificativa |
|---|---|---|
| Edson Eulalio | **supervisao** | Email "manutencao@" sugere operação de campo |
| Jonh Lucas M Soares | **engenharia** | Prestador já categorizado como "engenharia" |
| Weldner Alves | ? | Precisa de sua definição |

---

## Ações recomendadas para limpeza

1. **Remover registro órfão** — deletar user_role sem profile (b18c5e50...)
2. **Decidir sobre contas de teste** — remover ou manter "ze faisca" e "zezinho das couves"
3. **Remover prestador duplicado** — deletar o registro duplicado de "ze faisca" em prestadores
4. **Remover admin de prestadores** — Eugenio Garcia não deveria estar na tabela prestadores como técnico
5. **Definir role do Weldner** — engenharia ou supervisão?
6. **Confirmar mapeamento** — Edson → supervisao, Jonh Lucas → engenharia

Preciso que você confirme:
- Weldner Alves deve ser **engenharia** ou **supervisão**?
- Remover as contas de teste (ze faisca, zezinho das couves)?
- Confirma Edson → supervisão e Jonh Lucas → engenharia?

