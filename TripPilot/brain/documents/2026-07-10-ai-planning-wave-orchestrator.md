# TripPilot — Orquestrador de Implementação "AI Planning & Marketing Gaps" (fonte de verdade de execução)

> **Última atualização:** 2026-07-10 · **App:** 2.9.16-rc → 2.9.2x por gate; **2.10.0-rc** quando a Fase 2 (G4) entrar
> **Status:** ✅ ACTIVE — §16 lockada pelo Julio (2026-07-10). Pronto para rodar.
>
> **Origem:** auditoria marketing-vs-realidade (10/07) + sessão de design do AI Copilot (10/07).
> **Spec detalhada:** `docs/reports/2026-07-10-ai-powered-planning-spec.md` (1250 linhas, prompts v5 validados, lookup table completa).
> **DECs desta leva:** DEC-489→DEC-493 (PROPOSED) + DEC-494→DEC-497 (novos nesta leva).

---

## 0. Missão

Você é um engenheiro full-stack sênior **aplicando a leva "AI Planning & Marketing Gaps" do TripPilot de ponta a ponta, sozinho, nesta sessão**. O app **já existe, está testado e no ar** (2.9.16-rc). Seu trabalho é:

1. **Fechar os gaps entre o marketing e o código** — o sublabel dos counters mostra custo típico (G1); a "troca inteligente" existe como insight card (G4); o tom coloquial do Amigo Sincero é coerente (G6).
2. **Entregar o Smart Onboarding (Fase 1, sem IA)** — chips de atividade no onboarding geram automaticamente um ScenarioPlan, fazendo os counters aparecerem desde o primeiro uso.
3. **Entregar o AI Copilot Planning (Fase 2, com IA)** — 2 endpoints no Worker (`/plan-copilot/analyze` e `/plan-copilot/generate`), UX de perguntas bidirecional, disclosure progressivo, spending_level, lookup table de enriquecimento no Client, integração com Onboarding + Planner.
4. **Entregar o Mid-Trip Re-plan (Fase 3)** — botão "Replanejar com IA" no Planner que reutiliza o flow com dados reais de spending.

**Não reconstruir nada que já funciona. Preservar tudo que já está bonito e no ar.**

**A dor central:** O marketing promete "3 noites no bar, 5 idas ao mercado ~€18/ida" no dashboard. Na realidade, esses counters só aparecem quando o usuário configura manualmente um ScenarioPlan. Sem plano = dashboard vazio = a feature headline do marketing é invisível. Além disso, o planejamento manual exige que o usuário saiba os preços locais — a IA resolve isso.

**Vá para §17 para começar.**

---

## 1. Identidade & regras absolutas

Você é o **executor**, não um coordenador.

1. **SEM subagents / SEM Task tool.** Tudo inline, nesta sessão.
2. **NÃO peça permissão para avançar.** Terminar um milestone = commitar → deploy → dev-log → próximo.
3. **NÃO pare porque "é muito trabalho".** Continue até §12 ser toda TRUE ou o contexto acabar.
4. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração.
5. **Código → inglês. UI → `t()` com pt-BR/en/es.** Documento e brain → português.
6. **Domínio antes de UI**, uma mudança por vez, **teste junto com a mudança**.
7. **Reuse o que a §4 e §6 dizem que já existe.**
8. **Terminal WSL:** sempre `git --no-pager`, sempre `git commit -m`. Nunca pager/editor.
9. **Brain em sincronia:** `dev-log.md` cada milestone; `decision-log.md` cada decisão nova.

Ambiguidade nova → council inline → `DEC-NNN (PROPOSED)` → continue.

---

## 2. Ordem de leitura (carregar contexto uma vez)

1. **Este documento** §0–§9, depois o gate ativo em §10.
2. `src/dev-log.md`
3. `brain/decision-log.md` — DEC-489→DEC-497 + DEC-074 (per-phase activities) + DEC-262 (occasion counters)
4. `docs/reports/2026-07-10-ai-powered-planning-spec.md` — seções "Prompt v5", "Lookup Table", "Worker Implementation"
5. `brain/product-spec.md` — entidades ScenarioPlan, ScenarioAllocationItem, ActivityProfile

---

## 3. Não-negociáveis (ÂNCORA — releia antes de CADA gate)

**Herdados do app:**
- Dinheiro = inteiro em centavos (DEC-020). Domínio = TS puro, zero React.
- Texto de UI sempre via `t()` (DEC-054), três idiomas quando o item tiver cópia nova.
- Esconder, nunca deletar — nenhuma ação/feature some (ÂNCORA 9).
- Invariância de dados — recálculos puros; Σ itens de saída == total da saída (ÂNCORA 11).
- Nunca bloquear o registro de gasto (DEC-053). Honestidade da matemática.
- Tokens de tema, sistema de movimento, nav "glass" — preservar.

**Novos, desta leva:**
- **ÂNCORA-AI-1: O app NUNCA confia na aritmética da IA.** `total_planned_cents`, `margin_cents`, `margin_percent` são SEMPRE calculados no servidor/client. Se a IA retornar esses campos, ignorar.
- **ÂNCORA-AI-2: Rejeição automática.** Qualquer atividade com `typical_cost_cents <= 0` ou `suggested_quantity <= 0` = resposta inválida → fallback para Fase 1.
- **ÂNCORA-AI-3: Privacy.** Nenhum dado pessoal enviado à IA (nome, email, etc). Disclosure obrigatório no primeiro uso. Dados processados e descartados — zero storage.
- **ÂNCORA-AI-4: Offline = funcional.** O app funciona 100% sem IA. A IA é upgrade, não dependência. Toast graceful em caso de falha.
- **ÂNCORA-AI-5: O modo manual continua existindo.** Não remover, não esconder, não degradar.

---

## 4. Baseline — o que já existe

| Área | Arquivo(s) | Símbolo/Entidade | Status |
|------|-----------|-----------------|--------|
| OccasionCounter UI | `src/features/dashboard/cards/OccasionCounter.tsx` | `OccasionCounter` component — aceita `{icon, count, label, sublabel, iconBg, iconColor, onClick}` | ✅ Existe |
| Counter logic | `src/domain/dashboard/occasion-counters.ts` | `buildOccasionCounters()` — produz counters com `count`, `remaining`, `done`, `total`, `sublabel` | ✅ Existe |
| Dashboard cards | `src/features/dashboard/DashboardCards.tsx` | Monta o sublabel com `t('dashboard.occasion_done', {count})` | ✅ Existe — **sublabel mostra "X feitas", GAP G1** |
| ScenarioPlan type | `src/domain/types/scenario.ts` | `ScenarioPlan` + `ScenarioAllocationItem` | ✅ Existe |
| Planning domain | `src/domain/planning/planning.ts` | `createScenarioPlan()`, `createAllocationItem()`, `calculateOverAllocationCents()` | ✅ Existe |
| Planner UI | `src/features/planning/PlannerPage.tsx` | Modo manual com [-] [+] | ✅ Existe |
| Onboarding flow | `src/features/onboarding/OnboardingPage.tsx` | Steps de criação de trip/fase | ✅ Existe |
| Onboarding domain | `src/domain/onboarding/onboarding.ts` | `OnboardingInput` + `buildOnboarding()` | ✅ Existe — **sem chips de atividade, GAP Fase 1** |
| Honest Friend extras | `src/domain/budget/honest-friend-extras.ts` | Carousel de insights | ✅ Existe — **sem "troca inteligente", GAP G4** |
| Worker (Groq) | `worker/src/index.ts` | `GROQ_API_KEY`, `GROQ_CHAT_URL`, rate limiting, `/ocr`, `/assistant` | ✅ Existe — **sem `/plan-copilot/*`, GAP Fase 2** |
| Profile presets | `src/domain/profiles/profile-presets.ts` | `getDefaultProfilePresets()` com `typicalValueCents` | ✅ Existe |
| i18n strings | `src/i18n/locales/pt-BR.json`, `en.json`, `es.json` | Strings de dashboard, planning, simulator | ✅ Existe |

---

## 5. Change-set normalizado

| ID | Item | Prioridade | Gate |
|----|------|:----------:|:----:|
| D01 | Sublabel dos counters: "X feitas" → "~€X/{unidade}" | P0 | G1 |
| D02 | Chip grid de atividades no onboarding → gera ScenarioPlan automático | P0 | G2 |
| D03 | Função `buildAutoPlan()` no domínio (Fase 1, sem IA, spending_level=balanced) | P0 | G2 |
| D04 | Insight card "Troca Inteligente" no carousel | P1 | G3 |
| D05 | Função `computeSwapInsight()` no domínio | P1 | G3 |
| D06 | Lookup table de enriquecimento (6 clusters × 5 types × 4 levels) | P0 | G4 |
| D07 | Worker endpoint `POST /plan-copilot/analyze` | P0 | G4 |
| D08 | Worker endpoint `POST /plan-copilot/generate` + validação server-side | P0 | G4 |
| D09 | UX: tela de perguntas (bidirecional, spending_style obrigatória) | P0 | G5 |
| D10 | UX: tela de resultado com disclosure progressivo | P0 | G5 |
| D11 | Privacy disclosure modal (consentimento, primeiro uso) | P0 | G5 |
| D12 | Toggle "Modo manual / Modo assistido" no Planner | P0 | G5 |
| D13 | Integração onboarding: CTA "Quer que o copiloto monte?" após chips | P0 | G5 |
| D14 | Mid-trip re-plan: input enriquecido com spending real + UI de diff | P2 | G6 |
| D15 | Tom coloquial: revisão das strings do Amigo Sincero e feedback | P2 | G7 |

---

## 6. Root-cause map (código ↔ mudança)

| Sintoma | Root cause (arquivo → símbolo) | Direção do fix | Gate |
|---------|-------------------------------|---------------|:----:|
| Sublabel mostra "X feitas" ao invés de custo | `DashboardCards.tsx` → onde monta sublabel com `t('dashboard.occasion_done')` | Trocar por `~${formatMoney(typicalValueCents)}/${unit}` | G1 |
| Dashboard vazio sem plano manual | `onboarding.ts` → `buildOnboarding()` não cria `ScenarioPlan` | Adicionar chip step + `buildAutoPlan()` no domínio | G2 |
| Não existe "troca inteligente" | `honest-friend-extras.ts` não tem insight de swap | Criar `computeSwapInsight()` + registrar no extras builder | G3 |
| Worker não tem endpoints de IA planning | `worker/src/index.ts` → router só tem `/ocr`, `/assistant`, `/transcribe` | Adicionar `/plan-copilot/analyze` e `/plan-copilot/generate` com prompts v5 | G4 |
| Não existe UX de perguntas bidirecional | Não existe componente | Criar `PlanCopilotSheet.tsx` (ou page) com flow analyze→perguntas→generate→resultado | G5 |
| Planner só tem modo manual | `PlannerPage.tsx` não tem toggle | Adicionar toggle manual/assistido + botão "Gerar com copiloto" | G5 |
| Não existe re-plan mid-trip | Worker só aceita trips novas | Estender `/plan-copilot/analyze` para aceitar `current_spending` + UI de diff | G6 |

---

## 7. Decisões + councils

### DEC-489 — Sublabel do counter mostra custo típico (council unânime, 10/07) ✅ PROPOSED
Substituir "X feitas" por "~€X/{unidade}" no sublabel dos planned OccasionCounters. O label principal já mostra remaining. O done count continua acessível ao tap.

### DEC-490 — Insight card "Troca Inteligente" (council validado, 10/07) ✅ PROPOSED
Implementar como insight card no carousel (não no Amigo Sincero). Tom: "💡 1 {from} a menos = {gain} {to} a mais. Ajustar?" O tap leva ao Planner.

### DEC-491 — Smart Onboarding: chips → auto-plan (Fase 1, sem IA) ✅ PROPOSED
Estende DEC-074 (chip grid): ao confirmar chips, ALÉM de criar phaseProfileSettings, cria ScenarioPlan + AllocationItems. Default spending_level = "balanced". Distribuição proporcional por typicalValueCents.

### DEC-492 — AI Copilot Planning (Fase 2, com IA via Groq) ✅ PROPOSED
Dois endpoints Worker. Prompts v5 validados (6 iterações, 3 destinos OK). IA retorna formato lean; Worker calcula totais; Client enriquece via lookup table. Spending_style é pergunta obrigatória (4 níveis). Fallback: Fase 1.

### DEC-493 — Mid-trip re-plan (Fase 3) ✅ PROPOSED
Re-invocação do flow com `current_spending` no payload. Herda spending_style. Plano substitui apenas alocações futuras.

### DEC-494 — Lookup table: IA lean + Client enrichment ✅ PROPOSED (novo)
A IA retorna `{type, spending_level, suggested_quantity, typical_cost_cents, reasoning}`. O Client enriquece com `{includes, usually_not_included, expected_min/max, cost_scope, assumption}` via lookup table determinística `(type × spending_level × destination_cluster)`. 6 clusters: expensive_european, mid_european, cheap_asian, expensive_asian, north_america, latin_america. Fallback: mid_european. Dados baseados em Numbeo Jul 2026 + web research.

### DEC-495 — Spending_level como pergunta obrigatória no analyze ✅ PROPOSED (novo)
A primeira pergunta da IA é SEMPRE `spending_style` (4 opções: budget, balanced, comfortable, flexible; default = balanced). A segunda pergunta opcional é `priority_categories` (multi-select, max 2). Isso muda tanto o preço quanto a quantidade de cada atividade.

### DEC-496 — Orçamento limita estilo, não falsifica preços ✅ PROPOSED (novo)
Se o budget não comporta o spending_level escolhido, a IA não baixa preços abaixo da realidade local. Ela seta confidence="low", explica o conflito em insights, e baixa o nível das categorias não-prioritárias primeiro.

### DEC-497 — Disclosure progressivo na UI do resultado ✅ PROPOSED (novo)
Para cada atividade: (1) visível = valor + frase + faixa, (2) ao tap = includes/not_included + estilos alternativos + fontes. Mensagem "valores consideram o estilo selecionado" sempre visível.

---

## 8. Estratégia de testes

- **Domínio puro (>90%):** `buildAutoPlan()`, `computeSwapInsight()`, lookup table enrichment, server-side validation.
- **Worker:** testes manuais via curl dos 2 endpoints (ou mock do Groq).
- **UI crítica:** testes E2E ou component tests para: chip grid → plano gerado; toggle manual/assistido; disclosure ao tap.
- **Invariância de dados:** o auto-plan NÃO altera nenhum dado existente — só adiciona ScenarioPlan + items.
- **Suite verde entre gates:** 0 failures novas. Baseline confirmada em G0.

---

## 9. Protocolo por milestone

Antes de cada commit:
1. Listar ACs satisfeitas
2. Nomear 3 ACs anteriores com risco de regressão e verificar
3. Rodar testes — 0 failures novas
4. Flaggar arquivos fora do escopo
5. Atualizar `src/dev-log.md`

A cada boundary de gate: re-ler §3 + próximo gate + dev-log. Imprimir ANCHOR + CURRENT STATE.
A cada 3 milestones: refresh leve (§3 + dev-log).

---

## 10. THE BUILD — Gates G0→G7

### G0 — Setup & Baseline (2.9.16-rc)

**Why:** Documentar o ponto de partida e garantir que tudo está verde.

**Milestones:**
- M0.1: `npm install` + `npm run test` + `npm run build` + `tsc --noEmit` → registrar baseline counts
- M0.2: Semear `src/dev-log.md` com tabela desta wave
- M0.3: Adicionar DEC-494→497 como PROPOSED no decision-log

**AC:** Suite verde documentada, dev-log semeado, DECs registrados.
**Version:** 2.9.16-rc (sem bump)

---

### G1 — Sublabel do Counter (D01) → 2.9.17-rc

**Why:** Fechar gap G1 do marketing. O sublabel mostra "X feitas" mas deveria mostrar o custo típico.

**Root cause:** `DashboardCards.tsx` → onde monta sublabel dos planned counters.

**Change:**
- Localizar no `DashboardCards.tsx` onde o sublabel usa `t('dashboard.occasion_done', {count})` para planned counters
- Trocar por: `~${formatMoney(profile.typicalValueCents, currency)}/${unitLabel}`
- `unitLabel` derivado do nome do perfil via i18n (noite, ida, refeição, dia, passeio)
- Gate: mostrar custo quando `typicalValueCents > 0` (sempre verdadeiro com presets)
- Adicionar strings i18n: `dashboard.occasion_cost_per` em pt-BR/en/es

**Tests:** Unit test: dado um counter com typicalValueCents=3500 e currency=EUR, sublabel = "~€35/noite".

**AC:**
- [ ] G1-AC1: Sublabel dos planned counters mostra "~€35/noite" (não "2 feitas")
- [ ] G1-AC2: Counters sem plano continuam mostrando contagem bruta
- [ ] G1-AC3: Strings i18n em 3 idiomas

**Commit + deploy + version → 2.9.17-rc**

---

### G2 — Smart Onboarding sem IA (D02, D03) → 2.9.18-rc

**Why:** Fase 1 — fazer o dashboard mostrar counters desde o primeiro uso, sem dependência de IA.

**Root cause:** O onboarding cria trip+fase+pool mas NÃO cria ScenarioPlan.

**Change:**
- **M2.1: Domínio `buildAutoPlan()`** — nova função pura em `src/domain/planning/planning.ts`:
  - Input: `{selectedProfileIds, profiles: ActivityProfile[], freeToSpendCents}`
  - Output: `{planId, allocations: [{profileId, quantity, estimatedUnitCostCents}], totalAllocatedCents}`
  - Algoritmo: proporcional por typicalValueCents, floor das quantidades, `balanced` default
  - Testes: 3 cenários (2 perfis, 5 perfis, budget insuficiente para todos)
- **M2.2: Chip grid de atividades no onboarding** — estender o step existente (DEC-074):
  - Após confirmar chips → chamar `buildAutoPlan()` → criar ScenarioPlan + AllocationItems
  - Se skip do step, nenhum plano criado
  - Mostrar resumo rápido: "Plano criado! 🍺 4 noites, 🛒 6 mercados, ..."
- **M2.3: Editor de fase** — quando fase existente sem plano:
  - Card "Essa fase não tem plano de ocasiões. Quer criar um?" → abre chips → gera plano
- **M2.4: "Revertível"** — botão no Planner: "Remover plano automático" → soft-delete do ScenarioPlan

**Tests:**
- Unit: `buildAutoPlan()` com 3 cenários
- Component: chip grid + geração automática

**AC:**
- [ ] G2-AC1: `buildAutoPlan()` distribui proporcionalmente e respeita freeToSpend
- [ ] G2-AC2: Onboarding com chips selecionados cria ScenarioPlan + items
- [ ] G2-AC3: Dashboard mostra counters imediatamente após onboarding com chips
- [ ] G2-AC4: Botão "Remover plano automático" funciona (soft-delete)
- [ ] G2-AC5: Skip do step de atividades = nenhum plano criado

**Commit + deploy + version → 2.9.18-rc**

---

### G3 — Troca Inteligente (D04, D05) → 2.9.19-rc

**Why:** Fechar gap G4 do marketing — "1 noite a menos no bar = 2 idas a mais ao mercado".

**Root cause:** `honest-friend-extras.ts` não tem insight de swap.

**Change:**
- **M3.1: Domínio `computeSwapInsight()`** — nova função pura:
  - Input: `allocations (com remaining e typicalCost), threshold (remaining >= 2)`
  - Output: `{from: {name, icon, typical}, to: {name, icon, typical}, gain: number} | null`
  - Lógica: encontrar a alocação com maior custo restante (from) e a com menor custo (to). `gain = floor(from.typical / to.typical)`. Se gain >= 2 e from.remaining >= 2, retorna o swap.
  - Testes: 3 cenários (swap válido, nenhum swap possível, todos iguais)
- **M3.2: Registrar no extras builder** — adicionar em `buildHonestFriendExtras()` ou no builder de insights do carousel
  - Tom: `t('insights.swap_possible', {from, gain, to})` → "💡 1 {{from}} a menos = {{gain}} {{to}} a mais. Ajustar?"
  - Tap → navega ao Planner

**Tests:** Unit: `computeSwapInsight()` com 3 cenários.

**AC:**
- [ ] G3-AC1: `computeSwapInsight()` retorna swap válido quando existe
- [ ] G3-AC2: Insight card aparece no carousel quando swap possível
- [ ] G3-AC3: Tap no card navega ao Planner
- [ ] G3-AC4: String i18n em 3 idiomas

**Commit + deploy + version → 2.9.19-rc**

---

### G4 — Worker: AI Copilot Endpoints (D06, D07, D08) → 2.9.20-rc

**Why:** Fase 2 backend — os 2 endpoints no Worker + lookup table no Client.

**Root cause:** Worker não tem endpoints de IA planning.

**Change:**
- **M4.1: Lookup table module** — `src/domain/plan-copilot/enrichment-lookup.ts`:
  - 6 clusters × 5 types × 4 levels (dados da spec `docs/reports/2026-07-10-ai-powered-planning-spec.md`)
  - `getClusterForCity(city: string): DestinationCluster`
  - `enrichActivity(activity: AIPlanActivity, cluster): EnrichedPlanActivity`
  - Testes: 5 cenários (Amsterdam→expensive_european, Bangkok→cheap_asian, etc.)
- **M4.2: City→cluster mapping** — arquivo ou tabela em `src/domain/plan-copilot/city-clusters.ts`
  - Mapping de ~50 cidades para clusters
  - Fuzzy matching por substring (case-insensitive)
  - Fallback: `mid_european`
- **M4.3: Worker `/plan-copilot/analyze`** — em `worker/src/index.ts`:
  - Rate limit: `RL_AI` (existente)
  - Prompt v5 da spec (spending_style obrigatória)
  - JSON response_format, temperature 0.3
  - Timeout 15s → 503 com `plan_copilot_timeout`
- **M4.4: Worker `/plan-copilot/generate`** — em `worker/src/index.ts`:
  - Prompt v5 da spec (lean, sem totais)
  - Validação server-side: rejeitar se `typical_cost_cents <= 0` ou `suggested_quantity <= 0`
  - Calcular `totalPlannedCents`, `marginCents`, `marginPercent` no Worker
  - Retornar ao client: `{activities (lean), computed: {total, margin, percent}, context_used, insights, confidence}`

**Tests:**
- Unit: `enrichActivity()` com 5 cenários
- Unit: `getClusterForCity()` com cidades conhecidas + desconhecida → fallback
- Manual: curl dos endpoints (ou mock)

**AC:**
- [ ] G4-AC1: Lookup table cobre 6 clusters × 5 types × 4 levels
- [ ] G4-AC2: `enrichActivity()` retorna includes/not_included/min/max corretos
- [ ] G4-AC3: Worker `/plan-copilot/analyze` retorna perguntas estruturadas
- [ ] G4-AC4: Worker `/plan-copilot/generate` calcula totais (não confia na IA)
- [ ] G4-AC5: Worker rejeita respostas com cost ≤ 0
- [ ] G4-AC6: Ambos endpoints respeitam rate limit e timeout

**Commit + deploy Worker + version → 2.9.20-rc**

---

### G5 — UI: AI Copilot Flow (D09–D13) → 2.10.0-rc

**Why:** Fase 2 frontend — a experiência completa do usuário.

**Change:**
- **M5.1: Privacy disclosure modal** — componente `PlanCopilotDisclosure.tsx`:
  - Texto: dados enviados, nada pessoal, nada armazenado, opt-out disponível
  - Flag `hasSeenPlanCopilotDisclosure` em app settings
  - Mostrado UMA VEZ antes do primeiro envio
- **M5.2: Tela de perguntas** — componente `PlanCopilotQuestions.tsx` (ou sheet):
  - Recebe as `questions` do analyze
  - Renderiza chips com emoji, "why" em texto menor
  - spending_style sempre primeira, com default "balanced" pré-selecionado
  - Botões: [Gerar meu plano] [Prefiro manual]
  - Design: single page scrollável, não wizard multi-step
- **M5.3: Tela de resultado** — componente `PlanCopilotResult.tsx`:
  - Cabeçalho: resumo das escolhas (spending_style + respostas)
  - Cada atividade: valor × quantidade + frase do que cobre + faixa (lookup table)
  - Tap → bottom sheet com includes/not_included/estilos alternativos
  - Resumo: total (calculado), margem, %
  - Warning: "Valores consideram o estilo selecionado"
  - Botões: [Usar este plano] [Ajustar no planejador] [Refazer]
- **M5.4: Toggle no Planner** — "Modo manual" / "Modo assistido" no header
  - Manual: [-] [+] como hoje
  - Assistido: botão "Gerar plano com copiloto" → disclosure (se primeiro uso) → analyze → perguntas → generate → resultado
- **M5.5: Integração onboarding** — após chip grid:
  - Se online: "Quer que o copiloto monte seu plano? [Sim] [Prefiro manual]"
  - Se "Sim": disclosure → flow completo
  - Se "Manual" ou offline: `buildAutoPlan()` (Fase 1)
- **M5.6: Fallback + loading states**:
  - Loading: "Analisando sua viagem..." com shimmer/skeleton
  - Timeout 10s → fallback para Fase 1 + toast "Sem internet — criamos um plano básico"
  - Erro → fallback + toast

**Tests:** Component tests: flow completo (mock do Worker).

**AC:**
- [ ] G5-AC1: Disclosure aparece só no primeiro uso
- [ ] G5-AC2: Perguntas renderizadas como chips com "why"
- [ ] G5-AC3: spending_style é sempre a primeira pergunta
- [ ] G5-AC4: Resultado mostra valor + frase + faixa (disclosure progressivo)
- [ ] G5-AC5: Tap expande detalhes (includes/not_included)
- [ ] G5-AC6: [Usar este plano] cria ScenarioPlan + items
- [ ] G5-AC7: Toggle manual/assistido funciona no Planner
- [ ] G5-AC8: Onboarding integrado (online → copilot, offline → auto)
- [ ] G5-AC9: Fallback graceful com toast em caso de erro/offline
- [ ] G5-AC10: Strings i18n em 3 idiomas

**Commit + deploy + version → 2.10.0-rc** (major: feature nova visível ao usuário)

---

### G6 — Mid-Trip Re-plan (D14) → 2.10.1-rc (P2, se houver slack)

**Why:** Fase 3 — o AI Copilot re-invocado mid-trip com dados reais.

**Change:**
- **M6.1: Estender payload de analyze** — aceitar `current_spending` (per-profile: occasions_done, avg_cost_cents, total_spent_cents)
- **M6.2: UI de diff** — "Plano atualizado: antes X → agora Y (já fez Z, média €W)"
- **M6.3: Botão "Replanejar com IA"** — no Planner, modo assistido, quando mid-trip
- **M6.4: Herança de spending_style** — o re-plan herda do plano original

**AC:**
- [ ] G6-AC1: Payload inclui current_spending quando mid-trip
- [ ] G6-AC2: UI mostra diff (antes → agora)
- [ ] G6-AC3: Botão visível quando mid-trip
- [ ] G6-AC4: spending_style herdado

**Commit + deploy + version → 2.10.1-rc**

---

### G7 — Tom Coloquial (D15) → 2.10.2-rc (P2, se houver slack)

**Why:** Fechar gap G2 do marketing — strings do Amigo Sincero e feedback mais coloquiais.

**Change:** Revisão de strings i18n: tons mais calorosos, diretos, anti-culpa. Exemplos do marketing: "Para aí", "Manda ver!", "Troca inteligente".

**AC:**
- [ ] G7-AC1: Strings do Amigo Sincero revisadas em 3 idiomas
- [ ] G7-AC2: Tom condiz com o marketing (direto, caloroso, anti-culpa)

**Commit + deploy + version → 2.10.2-rc**

---

## 11. Terminal safety (WSL)

- Sempre `git --no-pager log/diff/show/status`
- Commit: `G=/usr/bin/git; "$G" commit -m "…"`
- Nunca `less`, `more`, `vim`, `nano`, flags `-i`

---

## 12. Definition of Done

- [ ] G1-AC1→AC3 (sublabel com custo)
- [ ] G2-AC1→AC5 (smart onboarding)
- [ ] G3-AC1→AC4 (troca inteligente)
- [ ] G4-AC1→AC6 (worker endpoints + lookup table)
- [ ] G5-AC1→AC10 (UI AI copilot)
- [ ] Suite verde (0 failures novas)
- [ ] Build OK (`npm run build` + `tsc --noEmit`)
- [ ] Deploy OK (Cloudflare Pages + Worker)
- [ ] Brain atualizado (decision-log DECs APPROVED, product-spec, project-status)
- [ ] dev-log.md com hand-off

---

## 13. Anti-patterns

- ❌ Confiar na aritmética da IA (ÂNCORA-AI-1)
- ❌ Enviar dados pessoais ao endpoint (ÂNCORA-AI-3)
- ❌ Esconder ou degradar o modo manual (ÂNCORA-AI-5)
- ❌ Hardcodar strings de UI (usar `t()`)
- ❌ Fazer a IA obrigatória (offline = funcional)
- ❌ Remover features existentes
- ❌ Subagents ou Task tool

---

## 14. Brain sync

- `src/dev-log.md` — cada milestone
- `brain/decision-log.md` — DEC-494→497 PROPOSED em G0; APPROVED no gate que shipa cada um
- `brain/product-spec.md` — registrar AI Copilot Planning quando G5 fechar
- `brain/project-status.md` — status final da wave

---

## 15. Smoke matrix

| Jornada | Web Chrome | Web Safari | Android APK |
|---------|:---------:|:---------:|:----------:|
| Onboarding com chips → counters aparecem | - | - | - |
| Planner toggle manual/assistido | - | - | - |
| Copilot flow: perguntas → plano → aceitar | - | - | - |
| Fallback offline (toast + plano automático) | - | - | - |
| Sublabel mostra custo (não "X feitas") | - | - | - |

---

## 16. Decisões lockadas pelo Julio (2026-07-10)

### Q1: Deploy do Worker → ✅ LOCKED: agente pode rodar `wrangler deploy`
O agente tem acesso ao wrangler. Usar `nvm use 22 && npx wrangler deploy` normalmente.

### Q2: Tela de perguntas → ✅ LOCKED: Bottom sheet (70% da tela)
Usar bottom sheet leve, consistente com o pattern do app. Se o conteúdo ficar muito longo com 5+ perguntas, o sheet pode ser scrollável.

---

## 17. GO — comece aqui

**G0 commands:**
```bash
cd TripPilot && npm install
npm run test 2>&1 | tail -5     # baseline test count
npm run build                    # baseline build
tsc --noEmit                     # baseline types
```

Depois: semear dev-log, registrar DEC-494→497, confirmar deploy pipeline. **Então execute G1→G7 na ordem, sem parar.**

**ANCHOR block (paste every 3 milestones):**
```
━━━ ANCHOR (AI Planning Wave) ━━━
ÂNCORA-AI-1: App NUNCA confia na aritmética da IA
ÂNCORA-AI-2: cost ≤ 0 ou qty ≤ 0 = rejeição automática
ÂNCORA-AI-3: Zero dados pessoais enviados à IA
ÂNCORA-AI-4: Offline = funcional (IA é upgrade, não dependência)
ÂNCORA-AI-5: Modo manual continua existindo
Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete
CURRENT STATE: Gate=G_ | Last=M_._ | Tests=_/_ | Risks=_ | Scope=on-track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
