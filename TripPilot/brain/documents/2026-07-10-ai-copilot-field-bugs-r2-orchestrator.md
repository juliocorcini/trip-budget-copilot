# TripPilot — Orquestrador "AI Copilot Field Bugs R2" (fonte de verdade de execução)

> **Última atualização:** 2026-07-10 · **App:** 2.10.9-rc → 2.11.2-rc por gate
> **Status:** ACTIVE
>
> **Origem:** teste de campo do AI Copilot round 2 (Julio, 10/07/2026)

---

## 0. Missão

Corrigir bugs restantes do AI Copilot, melhorar a transparência do budget pool, e polir a UX do planejador. Organizado em 3 gates por prioridade.

**Vá para §17 para começar.**

---

## 1. Regras absolutas

1. SEM subagents / SEM Task tool.
2. NÃO peça permissão para avançar.
3. Código → inglês. UI → `t()` com pt-BR/en/es.
4. Terminal WSL: sempre `git --no-pager`. Nunca pager/editor.
5. A cada gate: tests + build + tsc + deploy + release notes + commit.

---

## 3. ÂNCORA

- ÂNCORA-AI-1: App NUNCA confia na aritmética da IA.
- ÂNCORA-COPILOT-1: Client valida defensivamente toda resposta da IA.
- Dinheiro = cents | Domínio = TS puro | UI = t() | Hide never delete

---

## 5. Change-set

| ID | Item | Gate |
|----|------|:----:|
| D01 | Activity card expand vazio (enrichData null) — spending_level da IA não mapeado | G1 |
| D02 | Scroll flicker no header (max-height transition causa layout thrashing) | G1 |
| D03 | priority_categories multi-select (question type + UI) | G1 |
| D04 | Normalizar spending_level da IA para 4 níveis conhecidos | G2 |
| D05 | Preços irreais da IA — clampar no range do enrichment table | G2 |
| D06 | Comparação com gasto atual — layout fix | G2 |
| D07 | Budget pool: "De onde vem" — breakdown de transações | G3 |
| D08 | Budget pool: soft-delete com cascade protection | G3 |
| D09 | Advanced section colapsada por default | G3 |

---

## 6. Root-cause map

| Sintoma | Root cause | Fix |
|---------|-----------|-----|
| Expand vazio | `PlanCopilotResult.tsx:152`: `isExpanded && enrichData` — enrichData null quando spending_level é "moderate"/"economy". | Sempre mostrar: `isExpanded && (enrichData \|\| true)` com fallback para reasoning-only view |
| Scroll flicker | `PlannerPage.tsx:1057`: `max-height` transition + `useScrolled(8px)` → height change → scroll recalc → toggle loop | Usar `opacity:0 + pointer-events:none + h-0` instant (sem transition) |
| Multi-select | `ANALYZE_SYSTEM_PROMPT` diz `priority_categories` type=multi_choice mas `PlanCopilotQuestions` trata como single_choice | Detectar `type === 'multi_choice'` e permitir múltiplas seleções |
| Spending_level mismatch | IA retorna "moderate"/"economy"/"standard" mas tabela só tem 4 níveis | `normalizeSpendingLevel(raw)` mapeando sinônimos |
| Preços baixos | IA ignora DEC-496 e baixa preços para caber no budget | Worker clampa `typical_cost_cents` no range `[min, max]` do enrichment table |

---

## 10. THE BUILD

### G1 — Fixes triviais: expand, flicker, multi-select → 2.10.10-rc

**D01 (expand vazio):**
- `PlanCopilotResult.tsx:152` — mudar `{isExpanded && enrichData && (` para `{isExpanded && (`
- Dentro do bloco expandido, condicionar `includes`/`not_included`/`other_styles` em `enrichData` existir
- Se não tiver enrichData, mostrar só o `reasoning`

**D02 (scroll flicker):**
- `PlannerPage.tsx:1057` — remover transition CSS, usar toggle instant:
  - `className={scrolled ? 'overflow-hidden h-0 opacity-0' : ''}`
  - Sem `transition-[max-height]`

**D03 (multi-select):**
- `PlanCopilotQuestions.tsx` — detectar se a question tem `type === 'multi_choice'`
- Para multi_choice: armazenar respostas como CSV `"food,nightlife"`
- UI: permitir múltiplas seleções (toggle em vez de replace)
- `AnalyzeQuestion` type: adicionar campo `type?: 'single_choice' | 'multi_choice'`

---

### G2 — Qualidade IA: normalização + clamp → 2.10.11-rc

**D04 (normalizeSpendingLevel):**
- Criar `normalizeSpendingLevel(raw: string): SpendingLevel` em `enrichment-lookup.ts`
- Map: moderate/medium/standard → balanced, economy/budget/cheap/limited → budget, premium/luxury/high → flexible, comfort → comfortable
- Usar em `enrichActivity()` antes de lookup

**D05 (clampar preços):**
- Worker `index.ts` — após validar activities, clampar `typical_cost_cents` no range do enrichment table
- Importar a tabela ou passar os ranges como constantes no Worker
- Log quando clamp acontece

**D06 (comparação layout):**
- `PlanCopilotResult.tsx` — o bloco de comparação precisa de dados before/after alinhados
- Se `currentSpending` for vazio, não renderizar a seção

---

### G3 — Pool transparency → 2.11.2-rc

**D07 (breakdown de transações):**
- Criar componente `PoolBreakdown` que lista transações que compõem "Gasto até agora"
- Escondido por default, clicável para expandir

**D08 (soft-delete pool):**
- Botão "Excluir verba" com confirmação — soft-delete se não houver fases vinculadas
- Se houver fases vinculadas, mostrar warning e pedir confirmação

**D09 (advanced colapsado):**
- Seção "AVANÇADO" no pool detail começa colapsada

---

## 17. GO — comece aqui

Execute G1→G3 na ordem, sem parar. A cada gate: build + test + deploy + release notes.
