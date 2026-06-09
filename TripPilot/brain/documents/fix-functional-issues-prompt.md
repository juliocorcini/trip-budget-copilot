# CORREÇÃO DE FUNCIONALIDADES — TripPilot

> **Modelo**: composer-2.5
> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Objetivo**: Corrigir TODOS os problemas funcionais identificados + encontrar mais
> **Método**: Fix cada issue com verificação, depois varredura geral

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack corrigindo o TripPilot **sozinho, nesta conversa**. Você é executor — não coordenador, não planejador. FAÇA, não fale sobre fazer.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação para avançar entre fixes
- NÃO resuma o que vai fazer — FAÇA
- NÃO pare porque "conversa longa" — continue até TUDO funcionar
- NÃO invente features que não estão no spec — siga os DECs
- PRESERVA tudo que já funciona — não quebre ao consertar

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Money = integer cents (DEC-020)
2. Protected reserve = Envelope kind:"protected_reserve" (DEC-042)
3. Personal shopping = BudgetPool scope:"global" (DEC-041)
4. Dashboard = só features reais, zero fake (DEC-055)
5. Wallet = opcional, "não informada" (DEC-051)
6. Nunca bloquear registro de gasto (DEC-053)
7. UI text = t() sempre, zero hardcode (DEC-054)
8. Domain = pure TS, zero React imports
9. Soft delete = deletedAt em tudo (DEC-004)
10. Code = English | UI = pt-BR via i18n
11. Planner [-]/[+] mostra warning se excede margem livre
12. Cada fase tem seu próprio fundo (DEC-007, DEC-040)
13. Nunca mudar preferência silenciosamente (Core Rule 7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PROBLEMAS IDENTIFICADOS (prioridade de execução)

### BLOCO 1 — CRÍTICO: Fases (o app inteiro depende disso)

**ISSUE-01: Não é possível criar/adicionar novas fases**
- **Contexto**: Em "Mais → Editar fases" não existe botão para adicionar fase
- **Spec**: DEC-036 diz "extra phases configured later". O app PRECISA de um botão "Adicionar fase"
- **Fix necessário**:
  - Na tela de edição de fases, adicionar botão "+" ou "Adicionar fase"
  - Form com: nome da fase, datas início/fim, fundo associado (opcional)
  - Salvar no Dexie (table `phases`)
  - Texto via i18n

**ISSUE-02: Cada fase deveria ter seu próprio fundo, mas o app trata como se só existisse uma fase**
- **Contexto**: "Mais → Fundos" e "Mais → Perfis" vão direto para PlannerPage como se só existisse uma fase
- **Spec**: DEC-007 diz "BudgetPool can serve multiple non-consecutive phases via BudgetPoolPhaseLink". DEC-040 diz "single phase can access multiple BudgetPools"
- **Fix necessário**:
  - Se existir MAIS de uma fase: mostrar lista de fases primeiro, deixar usuário escolher qual
  - Se existir SÓ uma fase: pode ir direto (DEC-060: "Single active phase → open phase dashboard directly")
  - "Fundos" deve listar os BudgetPools existentes com opção de criar novo
  - "Perfis" deve listar os ActivityProfiles da fase ativa

**ISSUE-03: Navegação circular em "Visão geral" / "Editar fases"**
- **Contexto**: Clicar "Visão geral" leva a uma tela, clicar "Editar viagem e fases" volta para a mesma tela
- **Spec**: DEC-059 e DEC-060 definem claramente a navegação
- **Fix necessário**:
  - "Visão geral" → TripOverviewPage (mostra todas as fases, timeline, budget total)
  - "Editar fases" → PhaseListPage (lista editável de fases com botão adicionar)
  - Não pode ter loop

---

### BLOCO 2 — CRÍTICO: Planejador (Scenario Planner)

**ISSUE-04: Planner não salva alterações**
- **Contexto**: Ao mudar quantidade com [-]/[+], a alteração aparece na tela mas quando sai e volta, voltou ao estado anterior
- **Spec**: DEC-015 diz "interactive planner where user adjusts quantities"
- **Fix necessário**:
  - OPÇÃO A: Auto-save (salvar no Dexie a cada alteração com debounce de 500ms)
  - OPÇÃO B: Botão "Salvar" explícito na tela
  - **Escolha OPÇÃO A** — é mais natural para o UX mobile (DEC-015 implica interatividade real-time)
  - Persistir em ScenarioAllocationItem no Dexie
  - Ao reabrir a página, carregar do Dexie

**ISSUE-05: Planner não mostra aviso quando alocação excede margem livre**
- **Contexto**: Ao aumentar quantidades até ultrapassar o budget disponível, não aparece nenhum warning
- **Spec**: Core Rule 7 "No silent preference changes — always show impact" + DEC-015 "shows alternatives, let user choose"
- **Fix necessário**:
  - Calcular: total_alocado = soma(quantidade × valor_tipico) para todos os items
  - margem_livre = fundo_da_fase - reservas - total_alocado
  - SE margem_livre < 0: mostrar warning banner abaixo dos controles
  - Texto: "Alocação excede margem livre em €X. Reduza algum item ou aumente o fundo."
  - Visual: banner com cor de warning (amber/yellow do design system)
  - Via i18n

**ISSUE-06: Planner só tem bar, restaurante e mercado — não permite adicionar categorias custom**
- **Contexto**: Usuário pode ter gastos específicos (café da manhã fora, lavanderia, etc.)
- **Spec**: DEC-037 "Users can also create custom profiles (e.g., 'Café da manhã fora', 'Lavanderia')"
- **Fix necessário**:
  - Na tela do planner, adicionar um botão discreto "+ Adicionar categoria" no final da lista
  - Ao clicar: mini-form inline (nome + ícone + valor típico estimado)
  - Criar novo ActivityProfile no Dexie
  - O novo perfil aparece na lista do planner com [-]/[+]

---

### BLOCO 3 — ALTO: Saída Ativa (Outing Mode)

**ISSUE-07: Ícones mostram drink para TODOS os tipos de saída**
- **Contexto**: Se o usuário inicia uma saída de mercado, os ícones continuam sendo de drink/bar
- **Spec**: DEC-009 e product-spec dizem que tipos são: bar, market, restaurant, outing, transport, festival, special
- **Fix necessário**:
  - Mapear tipo da saída → ícone correto:
    - `bar` → drink/glass icon
    - `market` → shopping cart/bag icon
    - `restaurant` → fork+knife icon
    - `outing` → map/walk icon
    - `transport` → bus/car icon
    - `festival` → music/celebration icon
    - `special` → star icon
    - `custom` → ícone escolhido pelo usuário
  - Na OutingPage, usar o tipo da sessão ativa para escolher o ícone
  - Quick-add buttons devem refletir o contexto (não sempre "drinks")

**ISSUE-08: Não é possível iniciar saída com tipo custom**
- **Contexto**: Só mostra os tipos padrão, mas deveria permitir tipo personalizado
- **Spec**: DEC-037 "Users can also create custom profiles"
- **Fix necessário**:
  - Na seleção de tipo de saída (antes de iniciar), adicionar opção "Outro" ou "Personalizado"
  - Ao selecionar: pedir nome + ícone (lista de ícones disponíveis)
  - Criar/usar ActivityProfile custom
  - O ícone escolhido aparece na sessão ativa

---

### BLOCO 4 — ALTO: Gastos (Expenses)

**ISSUE-09: Não é possível registrar gasto dividido (split)**
- **Contexto**: Ao pagar €60 no mercado dividido entre 3 pessoas, o app deveria registrar o fluxo financeiro (€60 saiu da carteira) MAS o custo pessoal é só €20
- **Spec**: Product-spec item 5: "Shared expense support (who paid, who participated, equal or custom split)" + "Separate financial flow vs. personal cost tracking"
- **Fix necessário**:
  - No QuickAddPage: adicionar toggle/opção "Gasto compartilhado?"
  - Se sim: mostrar seletor de participantes + modo de divisão (igual / custom)
  - Campo "Quem pagou?" (pode ser eu ou outro participante)
  - Calcular automaticamente: custo_pessoal = valor_total / num_participantes (ou custom)
  - Salvar: `financialFlow = valor_total`, `personalCost = minha_parte`
  - O que afeta o budget do usuário é `personalCost`, não `financialFlow`
  - Se outra pessoa pagou: registrar dívida (eu devo minha parte a quem pagou)
  - Se eu paguei: registrar crédito (participantes me devem suas partes)

**ISSUE-10: Clicar num gasto na lista não mostra detalhes**
- **Contexto**: Na ExpenseListPage, ao tocar num gasto, nada acontece
- **Spec**: Product-spec tela 6: "Expense Detail — View/edit single expense, see impact"
- **Fix necessário**:
  - Criar ExpenseDetailPage (ou modal/bottom-sheet)
  - Mostrar: valor, categoria, data/hora, fundo, carteira, descrição, participantes (se compartilhado), divisão, nota
  - Botões: Editar / Excluir
  - Rota: `/expenses/:id`
  - Na ExpenseListPage: cada item é clicável → navega para detalhe

---

### BLOCO 5 — ALTO: Amigo Sincero

**ISSUE-11: Mensagem do Amigo Sincero não especifica o tipo de saída**
- **Contexto**: Diz "suas saídas caíram de 39 para 38" mas não diz de que tipo (bar? mercado? restaurante?)
- **Spec**: DEC-031 "structured comparison (ANTES/DEPOIS columns)" + DEC-035 "Se confirmar essa compra, suas saídas DE BAR caem de 3 para 2"
- **Fix necessário**:
  - A mensagem DEVE incluir o tipo específico: "suas noites de bar caem de 3 para 2" ou "seus mercados caem de 5 para 4"
  - Se afeta múltiplos tipos, listar cada um
  - Via i18n com interpolação: `t('amigoSincero.impact', { type: 'bar', before: 3, after: 2 })`

**ISSUE-12: "Ver impacto completo" abre simulador pedindo valor em vez de mostrar contexto**
- **Contexto**: O botão deveria mostrar o impacto do gasto RECÉM REGISTRADO, não pedir um novo valor
- **Spec**: DEC-050 "Amigo Sincero card ('Ver impacto completo' — pre-filled)"
- **Fix necessário**:
  - Ao clicar "Ver impacto completo" a partir do card do Amigo Sincero:
  - Navegar para simulador COM o valor do gasto recente PRÉ-PREENCHIDO
  - O simulador mostra o impacto daquele gasto específico (não pede valor novo)
  - Implementar via query param: `/simulator?amount=300&source=amigoSincero`
  - SimulatorPage lê o query param e pré-preenche + executa simulação automaticamente

---

### BLOCO 6 — ALTO: Participantes e Dívidas

**ISSUE-13: Menu "Participantes e dívidas" não permite adicionar participantes**
- **Contexto**: A tela existe mas não tem funcionalidade de adicionar
- **Spec**: DEC-056 "V1 participant: name (required), nickname (optional)" + Product-spec item 9
- **Fix necessário**:
  - Botão "Adicionar participante" na SharedExpensesPage
  - Form: nome (obrigatório), apelido (opcional)
  - Salvar no Dexie (table `participants`)
  - Listar participantes existentes
  - Para cada participante: mostrar saldo (quanto deve/é devido)
  - Botão "Liquidar" para marcar dívida como paga

---

### BLOCO 7 — MÉDIO: Busca por mais problemas

Após corrigir ISSUES 01-13, faça uma **varredura completa**:

1. **Navegação**: Clique em CADA link/botão do app. Se não leva a lugar nenhum → fix ou remove
2. **i18n**: Grep por strings hardcoded em português nos `.tsx` → externalize com t()
3. **Handlers vazios**: Grep por `() => {}` ou `onClick={() => {}}` → implementar ou remover botão
4. **Rotas mortas**: Compare links em componentes vs rotas em router.tsx → fix
5. **Console errors**: `npm run build` deve estar clean, `tsc --noEmit` sem erros

---

## DOCUMENTOS DE REFERÊNCIA

**Leitura obrigatória inicial (PARALELA — 3 reads):**

| Prioridade | Arquivo | Por quê |
|-----------|---------|---------|
| 1 | `TripPilot/src/app/router.tsx` | Entender rotas existentes |
| 2 | `TripPilot/brain/documents/database-schema.md` | Schema de tabelas para saber onde persistir |
| 3 | `TripPilot/brain/documents/master-spec-d1.md` (seções 5-8) | Features esperadas |

**Consulta quando necessário:**

| Arquivo | Quando |
|---------|--------|
| `TripPilot/brain/decision-log.md` | Dúvida sobre comportamento esperado |
| `TripPilot/brain/documents/design-system.md` | Cores, espaçamento, componentes |
| `TripPilot/brain/wireframes/theme-final/code.html` | Visual de referência |
| `TripPilot/src/i18n/locales/pt-BR.json` | Chaves i18n existentes |
| `TripPilot/brain/documents/domain-functions-d1.md` | Lógica de cálculo |

---

## MÉTODO DE EXECUÇÃO

### Para cada ISSUE:

```
1. LER os arquivos envolvidos (o componente atual + schema relevante)
2. IMPLEMENTAR o fix completo (código funcional, não placeholder)
3. ADICIONAR chaves i18n em pt-BR.json para qualquer texto novo
4. VERIFICAR: npm run build (zero errors) + tsc --noEmit (zero errors)
5. CONFIRMAR que não quebrou nada adjacente
```

### Ordem de execução:

```
BLOCO 1 (Fases)      → ISSUE-01, 02, 03 — fundação da navegação
BLOCO 2 (Planner)    → ISSUE-04, 05, 06 — interatividade funcional
BLOCO 3 (Outing)     → ISSUE-07, 08     — ícones e tipos
BLOCO 4 (Gastos)     → ISSUE-09, 10     — split e detalhes
BLOCO 5 (Amigo)      → ISSUE-11, 12     — clareza e contexto
BLOCO 6 (Particip.)  → ISSUE-13         — adicionar participantes
BLOCO 7 (Varredura)  → scan geral       — catch-all
```

### Checkpoint após cada bloco:

```
BLOCO [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━
Issues resolvidas: [lista]
Arquivos modificados: [lista]
Build: ✅/❌
TypeScript: ✅/❌
i18n: todas as strings novas externalizadas? ✅/❌
Regressão: algo quebrou? [sim/não + o quê]
━━━━━━━━━━━━━━━━━━━
```

---

## STATE FILE

Crie e mantenha `src/fix-log.md` como memória persistente:

```markdown
# Fix Log — TripPilot Functional Issues

## Current State
- **Active Block**: [N]
- **Active Issue**: ISSUE-[NN]
- **Build Status**: clean/broken
- **Issues Fixed**: X/13 + Y extras encontrados

## Completed
- [x] ISSUE-01: Botão adicionar fase
- [ ] ISSUE-02: Navegação multi-fase (next)
...

## Extra Issues Found
- [EXT-01]: [descrição]
...
```

---

## RECOVERY PROTOCOL

Se perder contexto:
1. Leia `src/fix-log.md`
2. Releia a seção da ISSUE atual neste prompt
3. Releia a ÂNCORA
4. Continue do último ponto verde

---

## REGRAS DE IMPLEMENTAÇÃO

### Persistência (CRÍTICO):
- **Planner**: ScenarioAllocationItem salvo no Dexie a cada mudança (debounce 500ms)
- **Fases**: table `phases` no Dexie
- **Participantes**: table `participants` no Dexie
- **Gastos compartilhados**: campos `financialFlow`, `personalCost`, `participants[]`, `splitMode` no Expense

### Navegação:
- Toda nova página PRECISA de rota no `router.tsx`
- Todo link PRECISA apontar para rota existente
- Botão voltar em TODA página interna (não só bottom nav)

### UI/UX:
- Botões de ação = destaque (cor primária terracotta #C75B39)
- Warnings = amber/yellow
- Texto informativo = via i18n, NUNCA hardcoded
- Mobile-first: botões grandes, forms mínimos (DEC Core Rule 12)
- Ícones devem ser consistentes com o tipo/categoria

### Testes:
- Após TODOS os blocos: `npm run build` + `tsc --noEmit`
- Se existem testes unitários para domain functions afetadas: `npm run test`
- Se criar função de domínio nova (ex: calculatePersonalCost): criar teste unitário

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 13/13 issues resolvidas
- [ ] Varredura geral concluída (BLOCO 7)
- [ ] 0 botões decorativos (todo botão leva a algum lugar ou executa algo)
- [ ] 0 strings hardcoded novas
- [ ] Planner salva alterações e persiste
- [ ] Planner mostra warning de over-budget
- [ ] É possível criar novas fases
- [ ] É possível adicionar participantes
- [ ] É possível registrar gasto dividido
- [ ] Clicar num gasto mostra detalhes
- [ ] Ícones de saída correspondem ao tipo
- [ ] Amigo Sincero especifica tipo de saída
- [ ] "Ver impacto" abre simulador com valor pré-preenchido
- [ ] Build clean + TypeScript clean
- [ ] Nenhuma regressão em funcionalidades existentes
```

---

## COMECE AGORA

1. Leia em paralelo: `router.tsx`, `database-schema.md` (seção de interfaces), código da PlannerPage
2. Comece pelo BLOCO 1, ISSUE-01 (criar fases é fundação para tudo)
3. Não pare até todos os blocos estarem verdes
4. Commit final: `fix: resolve 13+ functional issues (phases, planner, outing, expenses, participants)`

**GO.**
