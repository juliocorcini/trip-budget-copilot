# TripPilot — Orquestrador "AI Copilot Field Bugs" (fonte de verdade de execução)

> **Última atualização:** 2026-07-10 · **App:** 2.10.6-rc → 2.10.9-rc por gate
> **Status:** ⏳ AWAITING LOCK (§16)
>
> **Origem:** teste de campo do AI Copilot (Julio, 10/07/2026). Bugs críticos + UX issues no fluxo de perguntas, resultado e planejador.

---

## 0. Missão

Você é um engenheiro full-stack sênior aplicando a leva "AI Copilot Field Bugs" de ponta a ponta, sozinho, nesta sessão. O app já existe, está testado e no ar (2.10.6-rc). Seu trabalho é:

1. **Corrigir bugs críticos** — NaN nos totais do resultado, chips não selecionáveis na tela de perguntas
2. **Corrigir bugs funcionais** — texto em inglês quando app está em pt-BR, spending style ignorado, campo de texto não abre ao selecionar opções que precisam de especificação
3. **Melhorar a UX do Planner** — botão "Refazer com IA" quando já existe plano, header "já usado / reservado" que esconde no scroll
4. **Melhorar a qualidade das perguntas da IA** — limitar ao que o app suporta, forçar língua do app, filtrar perguntas inúteis no client

**Não reconstruir nada que já funciona. Preservar tudo que já está bonito e no ar.**

**Vá para §17 para começar.**

---

## 1. Identidade & regras absolutas

Você é o **executor**, não um coordenador.

1. SEM subagents / SEM Task tool. Tudo inline, nesta sessão.
2. NÃO peça permissão para avançar. Milestone done → commit → deploy → next.
3. NÃO pare porque "é muito trabalho". Continue até §12 ser toda TRUE.
4. NÃO resuma o que vai fazer — FAÇA. Minimize narração.
5. Código → inglês. UI → `t()` com pt-BR/en/es.
6. Domínio antes de UI, uma mudança por vez, teste junto com a mudança.
7. Reuse o que §4 diz que já existe.
8. Terminal WSL: sempre `git --no-pager`, sempre `git commit -m`. Nunca pager/editor.
9. Brain em sincronia: dev-log cada milestone, decision-log cada decisão nova.

---

## 2. Ordem de leitura

1. Este documento §0–§9, depois o gate ativo em §10.
2. `src/dev-log.md`
3. `brain/decision-log.md` — DEC-501→DEC-504
4. Arquivos citados na §6

---

## 3. Não-negociáveis (ÂNCORA)

**Herdados do app:**
- Dinheiro = inteiro em centavos. Domínio = TS puro, zero React.
- Texto de UI sempre via `t()`, três idiomas.
- Esconder, nunca deletar.
- Invariância de dados.
- Nunca bloquear o registro de gasto.

**Herdados da AI wave:**
- ÂNCORA-AI-1: App NUNCA confia na aritmética da IA.
- ÂNCORA-AI-2: cost ≤ 0 ou qty ≤ 0 = rejeição automática.
- ÂNCORA-AI-3: Zero dados pessoais enviados à IA.
- ÂNCORA-AI-4: Offline = funcional. IA é upgrade, não dependência.
- ÂNCORA-AI-5: Modo manual continua existindo.

**Novos, desta leva:**
- ÂNCORA-COPILOT-1: O client DEVE validar defensivamente toda resposta da IA. IDs podem ser números, strings podem faltar — coagir sempre.
- ÂNCORA-COPILOT-2: Perguntas da IA que não mapeiam para features do app = ruído. Filtrar no client ou limitar no prompt.

---

## 4. Baseline — o que já existe

| Área | Arquivo(s) | Status |
|------|-----------|--------|
| PlanCopilotQuestions | `src/features/plan-copilot/PlanCopilotQuestions.tsx` | ✅ Existe — **chips não selecionáveis (opt.id numérico vs string), GAP D01** |
| PlanCopilotResult | `src/features/plan-copilot/PlanCopilotResult.tsx` | ✅ Existe — **NaN nos totais (computed nested), GAP D02** |
| GenerateResult type | `src/utils/ai-plan-copilot.ts` | ✅ Existe — **interface desalinhada com Worker, GAP D02** |
| PlanCopilotFlow | `src/features/plan-copilot/PlanCopilotFlow.tsx` | ✅ Existe |
| Worker analyze prompt | `worker/src/index.ts` → `ANALYZE_SYSTEM_PROMPT` | ✅ Existe — **sem forçar língua, perguntas sem whitelist, GAP D06/D07** |
| Worker generate prompt | `worker/src/index.ts` → `GENERATE_SYSTEM_PROMPT` | ✅ Existe — **sem forçar língua, GAP D06** |
| PlannerPage toggle | `src/features/planning/PlannerPage.tsx` | ✅ Existe — **sem botão "refazer com IA" quando plano existe, GAP D05** |
| BottomSheet | `src/components/BottomSheet.tsx` | ✅ Existe — drag-to-close body é DEC-407, by design |

---

## 5. Change-set normalizado

| ID | Item | Prioridade | Gate |
|----|------|:----------:|:----:|
| D01 | Chips não selecionáveis na tela de perguntas (opt.id numérico) | P0 | G1 |
| D02 | NaN nos totais do resultado (computed nested no Worker) | P0 | G1 |
| D03 | Texto em inglês: insights/reasoning/dicas vêm em EN quando app está em pt-BR | P1 | G2 |
| D04 | Spending style ignorado: header mostra "Equilibrado" quando user escolheu "budget" | P1 | G2 |
| D05 | Planner: botão "Refazer com IA" quando já existe plano | P1 | G3 |
| D06 | Prompt: forçar língua do app no ANALYZE e GENERATE | P1 | G2 |
| D07 | Prompt: limitar perguntas ao que o app suporta + filtro no client | P2 | G3 |
| D08 | "Sim, especificar" deve abrir campo de texto automaticamente | P1 | G2 |
| D09 | Planner: header "já usado / reservado" esconde no scroll | P2 | G3 |

---

## 6. Root-cause map (código ↔ mudança)

| Sintoma | Root cause | Direção do fix | Gate |
|---------|-----------|----------------|:----:|
| Chips não selecionam | `PlanCopilotQuestions.tsx:66` — `answers[q.id] === opt.id`. IA retorna `opt.id` como número (JSON), `selectOption` armazena `String(optionId)`, mas a comparação usa `===` estrita. `"1" !== 1` → visual nunca atualiza. | Coagir `opt.id` para string na comparação: `answers[q.id] === String(opt.id)`. Também: coagir a key do map para string. | G1 |
| NaN no total | `ai-plan-copilot.ts:67-69` — `GenerateResult` espera `total_planned_cents` no root. Worker (`index.ts:615-617`) retorna `{ computed: { total_planned_cents, margin_cents, margin_percent } }`. Campo no root é `undefined` → `fromCents(undefined)` → `NaN`. | Alinhar interface com `computed: {}` nested, ou flattear na response. | G1 |
| Texto em inglês | `ANALYZE_SYSTEM_PROMPT` (L414) diz "Options in the user language" — mas `reasoning`, `insights`, `context_summary` não têm instrução de língua. `GENERATE_SYSTEM_PROMPT` não menciona língua. | Adicionar "IMPORTANT: ALL text fields (reasoning, insights, labels, summaries) MUST be in the language: {language}" em ambos os prompts. | G2 |
| Spending style ignorado | `PlanCopilotResult.tsx:57` — `contextUsed?.spending_style ?? 'balanced'`. O `context_used` é o que a IA retorna, não o que o user escolheu. Se a IA ignorou, mostra o default. | Passar as `answers` do user ao Result e usar `answers['spending_style']` em vez de `context_used`. | G2 |
| "Sim, especificar" sem campo | `PlanCopilotQuestions.tsx:84-101` — "Outro" abre campo de texto. Mas opções como "sim, especificar" que a IA gera com ID tipo "specify" não ativam campo de texto. | Detectar opções com `id` que contém "specify"/"yes_specify"/"custom" ou label que contém "especificar"/"specify", e auto-selecionar como "other" com campo de texto aberto. | G2 |
| Sem botão "refazer com IA" | `PlannerPage.tsx:1726` — o CTA "Gerar com copiloto" / "Replanejar" só aparece se `!copilotStarted`. Depois de usar o copilot uma vez, `copilotStarted = true` e o botão some. | Resetar `copilotStarted` quando o plano muda, ou mostrar botão "Refazer com IA" sempre no modo assistido. | G3 |
| Header fixo no scroll | `PlannerPage.tsx` — o bloco "já usado / reservado" é estático. | Usar `useScrolled()` (já existe no projeto) para esconder o bloco quando `scrolled > threshold`. | G3 |
| Perguntas inúteis da IA | `ANALYZE_SYSTEM_PROMPT` não restringe os tipos de pergunta. A IA pergunta sobre seguro de viagem, equipamento esportivo, interesses artísticos — coisas que o app não modela. | Adicionar whitelist no prompt: "Only ask about: spending_style, priority_categories, meal preferences, transport style, nightlife frequency, trip pace." No client: filtrar perguntas cujo `id` não está na whitelist conhecida. | G3 |

---

## 7. Decisões + councils

### DEC-501 — Coagir opt.id para string na comparação de chips ✅ PROPOSED
A IA retorna IDs numéricos no JSON. O fix é defensivo: `String(opt.id)` em toda comparação e key de map. Sem mudança no Worker — o client é o responsável por coagir tipos de resposta de IA (ÂNCORA-COPILOT-1).

### DEC-502 — Flattear computed no client ✅ PROPOSED
Alinhar a interface `GenerateResult` para ler de `result.computed.total_planned_cents`. Alternativa: flattear no `post<T>()`. Decisão: manter o shape do Worker e ajustar a interface + o componente de resultado — é mais explícito e documenta a estrutura real.

### DEC-503 — Spending style do user, não da IA ✅ PROPOSED
O header do resultado deve mostrar o `spending_style` que o USER escolheu (das `answers`), não o que a IA reporta no `context_used`. O `context_used` é informacional mas não é confiável.

### DEC-504 — Whitelist de perguntas no prompt + filtro no client ✅ PROPOSED
Prompt: limitar a `spending_style`, `priority_categories`, `meal_preference`, `transport_style`, `nightlife_frequency`, `trip_pace` + 1 pergunta livre sobre o destino. Client: aceitar só IDs conhecidos + `spending_style` (obrigatório) + `priority_categories` + até 3 extras. Perguntas com IDs desconhecidos → `allow_other: true` forçado + texto genérico de fallback.

---

## 8. Estratégia de testes

- **Domínio puro:** Coerção de IDs (`String(opt.id)`), parsing do computed nested, whitelist filter.
- **Worker:** Curl manual dos 2 endpoints com `language: 'pt-BR'`.
- **Component:** Mock do GenerateResult com `computed` nested.
- **Suite verde entre gates:** 0 failures novas (baseline: 2 split-live-loop).

---

## 9. Protocolo por milestone

Antes de cada commit:
1. Listar ACs satisfeitas
2. Nomear 3 ACs anteriores com risco de regressão e verificar
3. Rodar testes — 0 failures novas
4. Flaggar arquivos fora do escopo
5. Atualizar `src/dev-log.md`

---

## 10. THE BUILD — Gates G0→G3

### G0 — Setup & Baseline (2.10.6-rc)

**Milestones:**
- M0.1: `npm install` + `npm run test` + `npm run build` + `tsc --noEmit` → baseline
- M0.2: Semear dev-log com tabela desta wave
- M0.3: Adicionar DEC-501→504 como PROPOSED no decision-log

**AC:** Suite verde documentada, dev-log semeado, DECs registrados.
**Version:** 2.10.6-rc (sem bump)

---

### G1 — P0 Fixes: Chips + NaN (D01, D02) → 2.10.7-rc

**Why:** Sem esses fixes o AI Copilot é inutilizável.

**Change D01 (chips):**
- `PlanCopilotQuestions.tsx:66` — trocar `answers[q.id] === opt.id` por `answers[q.id] === String(opt.id)`
- Na key do map (`key={opt.id}`) → `key={String(opt.id)}`
- No `selectOption`: já faz `String(optionId)` — OK
- No "Outro" `isOther` check: já usa `startsWith` em string — OK

**Change D02 (NaN):**
- `ai-plan-copilot.ts` → ajustar `GenerateResult` para ter `computed: { total_planned_cents, margin_cents, margin_percent }`
- `PlanCopilotResult.tsx` → ler de `result.computed.total_planned_cents` (com fallback defensivo 0)
- Fallback: `result.computed?.total_planned_cents ?? 0`

**Tests:** Unit test: dado um GenerateResult com computed nested, o fmtEuro NÃO retorna NaN.

**AC:**
- [ ] G1-AC1: Chips selecionáveis no mobile (tap seleciona, visual atualiza)
- [ ] G1-AC2: Totais numéricos no resultado (sem NaN)
- [ ] G1-AC3: Fallback defensivo para computed undefined

**Commit + deploy → 2.10.7-rc**

---

### G2 — P1 Fixes: Língua + Style + Especificar (D03, D04, D06, D08) → 2.10.8-rc

**Why:** Funcional mas degradado — texto em inglês e estilo ignorado confundem o user.

**Change D03 + D06 (língua nos prompts):**
- Worker `ANALYZE_SYSTEM_PROMPT` → adicionar: "IMPORTANT: ALL text in questions, labels, reasoning, summaries MUST be in the language specified by the user (see Language field). This is MANDATORY."
- Worker `GENERATE_SYSTEM_PROMPT` → adicionar: "IMPORTANT: ALL text fields (reasoning, insights) MUST be in the language specified by the user. This is MANDATORY."

**Change D04 (spending style):**
- `PlanCopilotFlow.tsx` → passar `userAnswers` ao `PlanCopilotResult`
- `PlanCopilotResult.tsx` → nova prop `userAnswers?: Record<string, string>`, usar `userAnswers?.['spending_style'] ?? contextUsed?.spending_style ?? 'balanced'`

**Change D08 (campo de texto para "especificar"):**
- `PlanCopilotQuestions.tsx` → quando o user seleciona uma opção cujo `id` contém "specify", "custom", "yes_specify", ou cujo `label` contém "especificar"/"specify", auto-setar como "other:" + abrir o campo de texto

**Tests:** Teste de coerção de spending_style do user vs IA.

**AC:**
- [ ] G2-AC1: Insights e reasoning em pt-BR quando app está em pt-BR
- [ ] G2-AC2: Header mostra o spending_style escolhido pelo user
- [ ] G2-AC3: "Sim, especificar" abre campo de texto automaticamente
- [ ] G2-AC4: Worker deploy com novos prompts

**Commit + deploy Worker + Pages → 2.10.8-rc**

---

### G3 — UX Polish: Planner + Prompt Quality (D05, D07, D09) → 2.10.9-rc

**Why:** Melhorias de experiência e qualidade das perguntas.

**Change D05 (refazer com IA):**
- `PlannerPage.tsx` → no modo assistido, quando já existe plano (`planRef.current != null`), mostrar botão "Refazer plano com IA" que reseta `copilotStarted` e inicia o flow novamente

**Change D07 (prompt quality):**
- Worker `ANALYZE_SYSTEM_PROMPT` → adicionar whitelist: "Beyond spending_style and priority_categories, you may ask about: meal_preference, transport_style, nightlife_frequency, trip_pace, and ONE destination-specific question. Do NOT ask about: insurance, equipment, artistic/sport interests, or anything the budget app does not model."
- Client `PlanCopilotQuestions.tsx` → filtrar perguntas: aceitar `spending_style`, `priority_categories` + até 3 extras com `id` no formato string

**Change D09 (header scroll):**
- `PlannerPage.tsx` → usar hook `useScrolled()` ou `IntersectionObserver` para esconder o bloco "já usado / reservado" quando scroll > 0

**AC:**
- [ ] G3-AC1: Botão "Refazer com IA" visível quando plano existe no modo assistido
- [ ] G3-AC2: Perguntas limitadas ao que o app suporta
- [ ] G3-AC3: Header "já usado / reservado" esconde no scroll

**Commit + deploy Worker + Pages → 2.10.9-rc**

---

## 11. Terminal safety (WSL)

- Sempre `git --no-pager log/diff/show/status`
- Commit: `G=/usr/bin/git; "$G" commit -m "…"`
- Nunca `less`, `more`, `vim`, `nano`, flags `-i`

---

## 12. Definition of Done

- [ ] G1-AC1→AC3 (chips + NaN)
- [ ] G2-AC1→AC4 (língua + style + especificar)
- [ ] G3-AC1→AC3 (planner UX + prompt quality)
- [ ] Suite verde (0 failures novas)
- [ ] Build OK
- [ ] Deploy OK (Pages + Worker)
- [ ] Brain atualizado

---

## 13. Anti-patterns

- ❌ Confiar que a IA retorna tipos corretos (ÂNCORA-COPILOT-1)
- ❌ Hardcodar strings de UI
- ❌ Mudar o Worker sem testar os endpoints
- ❌ Remover features existentes
- ❌ Subagents ou Task tool

---

## 14. Brain sync

- `src/dev-log.md` — cada milestone
- `brain/decision-log.md` — DEC-501→504 PROPOSED em G0; APPROVED no gate que shipa

---

## 15. Smoke matrix

| Jornada | Web Chrome | Web Safari | Android APK |
|---------|:---------:|:---------:|:----------:|
| Copilot: perguntas → chips selecionáveis | - | - | - |
| Copilot: resultado sem NaN | - | - | - |
| Copilot: resultado em pt-BR | - | - | - |
| Planner: refazer com IA | - | - | - |

---

## 16. Decisões para o user (lock)

### Q1: Deploy do Worker → ⏳ AWAITING LOCK
O Worker precisa de deploy para os fixes de prompt (D03/D06/D07). Confirmar que o agente pode rodar `wrangler deploy`.

### Q2: Perguntas irrelevantes da IA → ⏳ AWAITING LOCK
O conselho recomenda whitelist no prompt + filtro no client. Alternativa: só whitelist no prompt (mais simples, menos robusto). Qual preferir?

---

## 17. GO — comece aqui

**G0 commands:**
```bash
cd TripPilot && npm install
npm run test
npm run build
tsc --noEmit
```

Depois: semear dev-log, registrar DEC-501→504. **Então execute G1→G3 na ordem, sem parar.**

**ANCHOR block:**
```
━━━ ANCHOR (AI Copilot Field Bugs) ━━━
ÂNCORA-COPILOT-1: Client VALIDA defensivamente toda resposta da IA
ÂNCORA-COPILOT-2: Perguntas que não mapeiam para features = ruído
ÂNCORA-AI-1: App NUNCA confia na aritmética da IA
ÂNCORA-AI-4: Offline = funcional
Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete
CURRENT STATE: Gate=G_ | Last=M_._ | Tests=_/_ | Risks=_ | Scope=on-track
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
