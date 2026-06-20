# Open Decisions — Councils, Research & Future-Apply Plan

> Last updated: 2026-06-19
> Status: **RESEARCH + DECISION-READY** (not yet implemented — this is the "para aplicar no futuro" doc Julio asked for).
> Scope owner: Julio. Method: all councils run **inline, single session, no subagents** (per `inline-council-no-subagents.mdc`). Claims grounded in the current code + brain (file/DEC refs inline). No "uniqueness" claims (per `fact-verification.mdc`).
> Trigger: Julio (2026-06-19) — "rode o conselho para essas decisões em aberto e faça uma pesquisa grande, crie uma documentação para eu aplicar no futuro." The three are the long-standing non-forced items: G7 Hub×Overview (§6 Q3 of the UX audit), DEC-228 Fundo→Trecho/Pote vocab, DEC-231 Wise split explainer.

---

## 0. TL;DR (the three calls)

| # | Open decision | Council verdict | Confidence | When to apply |
|---|---------------|-----------------|------------|---------------|
| **OD-1** | `/viagem` (Hub) × `/trip` (Overview) — merge into one screen, or keep two with labeled roles? | **Keep two, but make Overview a true read-only "resumo + compartilhar" and Hub the single "planejar/editar" cockpit. Do NOT structurally merge now.** Promote a future *light* consolidation (fold Overview's share-card + total into the Hub header) only if usage shows the Overview is a dead-end. | HIGH | Backlog gate "OD-1" (1 version, web/OTA) — only if you still feel the overlap after the GATE-14 role microcopy. |
| **OD-2** | "Fundo" → Trecho/Pote vocab migration in the advanced editor | **Do it as ONE coherent pass that renames by the pool's actual nature (a pool is a Trecho OR a Pote), never a blanket "Fundo"→"Trecho". Ship a vocab map + a single i18n `funds.*`→nature-aware copy gate. Keep `Fund`/`pool` code identifiers.** | HIGH | Backlog gate "OD-2" (1 version, web/OTA). Self-contained; needs your term validation first. |
| **OD-3** | Wise importer split explainer (DEC-231 deferred) | **Mount the existing `SplitExplainer` inside the Wise allocation sheet, collapsed, behind a one-line anchor — copy source already exists. Lowest-risk of the three.** | HIGH | Backlog gate "OD-3" (can ride any web/OTA release; ~1–2h). |

Net: **none require a structural rewrite**; OD-3 is a quick win, OD-2 is a focused rename pass, OD-1 is the only one that touches navigation and should stay conservative.

---

## 1. OD-1 — `/viagem` (Hub) vs `/trip` (Overview)

### 1.1 Current state (grounded)
- **`/viagem` = `TripHubPage`** (UX audit §4.10, rated 3/5): the "map" of the trip — phase selector (sets the app's active context), per-phase summary cards, inline planning preview, planned purchases, funds, and a 6-tile "Estrutura" grid. **Dense** (selector + summary + phases + planning + purchases + funds + structure in one scroll). It is where you **plan and edit structure**. GATE-14 (DEC-234) already added a role line: *"plano e estrutura"*.
- **`/trip` = `TripOverviewPage`** (§4.11, rated 3/5): total budget (= sum of pools) vs spent, a phase timeline (active/next chips), funds with bars, and a **share card**. Tapping a phase → the editor; tapping a fund → `/funds`. GATE-14 added its role line: *"um resumo só de leitura: total, fases e cartão de compartilhar; para planejar ou editar, use a Viagem"*.
- **The overlap (audit G7 / §6 Q3):** both show phases + funds + totals; `/trip/edit`, `/funds`, `/planner`, `/phase-preview` all hang off them. A first-timer can't tell why there are two.

### 1.2 Inline council — REVIEW (Architect / Advocate / Critic / Strategist)
**Decision Brief (neutral):** Two trip surfaces overlap (phases/funds/totals). GATE-14 already labeled their roles. Question: structurally merge into one screen, or keep two with the labels. Verified: Hub = the active-phase context selector + planning/structure; Overview = read-only total + timeline + share card; both are rated 3/5 mainly for *density/overlap*, not missing function. Chat lean to resist: "merge everything into one screen" (sounds clean, but the Hub is already the densest screen in the app — a naive merge makes it worse).

**Architect (blind).** The Hub is already over-budget on density (the audit's main critique). Merging the Overview *into* it adds the total hero + timeline + share card to the most crowded screen — the opposite of clarity. The clean separation is **by mode of interaction**: Overview = *read* (glance + share), Hub = *act* (select phase, plan, edit). The cheapest correct move is to **sharpen** that split: strip any *editing* affordance from Overview (make it purely read+share) and make sure every *plan/edit* entry funnels through the Hub. A true merge is a multi-screen refactor (routes, deep-links from dashboard/copilot/settings, `/trip/edit` parent) with high regression surface for low upside. **Rec:** keep two; sharpen roles; no structural merge. **Confidence:** HIGH. **Others miss:** `/trip` is also the **share-card home** — merging buries the one "show my trip to someone" action.

**Advocate (user, blind).** People open "Viagem" to *do* something (change the phase, plan a fund) and open the Overview to *see the whole picture or share it*. Two jobs, two screens is fine **if** the names say so. The risk isn't two screens — it's that today they look like siblings with no parent. The fix users actually feel: a one-line purpose at the top of each (done in GATE-14) plus making the Overview feel like a *destination* ("a foto da viagem") not a second Hub. **Rec:** keep two; lean into "resumo/compartilhar" identity for Overview. **Confidence:** MED. **Others miss:** the share card is the emotional payoff — don't hide it inside a cockpit.

**Critic (blind).** Whatever we do, the danger is a half-merge that leaves dangling deep-links (dashboard insight → `/trip`, settings "visão avançada" → `/funds`, copilot → phases). If we merge, we must redirect every entry point or we strand users. A merge also collides with `/trip/edit` being a *child* of the overview conceptually. The role microcopy is reversible and cheap; a merge is neither. **Rec:** do NOT merge under a "no-bugs" mandate; if ever merged, do it as its own gate with an entry-point audit. **Confidence:** HIGH. **Others miss:** `/phase-preview` and `/trip/edit` assume the two-surface topology — a merge ripples into them.

**Strategist (blind).** The trip surfaces are the app's "where am I in this journey" spine. Long term, the *strongest* product is a single "Viagem" that opens on a calm read-only summary and reveals planning on demand — but that's a V2 information-architecture project, not a polish item. For now, the labeled-roles path compounds with Package #1's "total = sum of pools" and the settle-up hub without risk. **Rec:** keep two now; put "unify into one progressive Viagem" on the V2 radar. **Confidence:** MED. **Others miss:** a future merge is more valuable *after* the mode (simple/complete) lever is pushed deeper — simple mode could show only the summary, complete mode the cockpit.

**Red team (kill "keep two").** If keeping two, the failure mode is that Overview stays a confusing near-duplicate and the labels are ignored. Mitigation: don't just label — **remove editing from Overview** so the two can't be confused by behavior, and consider routing simple-mode users to Overview-only. If even that fails to dispel confusion in your own use, escalate to the merge gate.

**Synthesis (Chair).** Consensus: **keep two; do not structurally merge under the no-bugs mandate.** Tension: Strategist's long-term single-Viagem vision vs Architect/Critic's "merge = high-risk refactor now." Resolve by **sharpening, not merging**: (1) make Overview strictly read-only + share (move any edit entry to the Hub); (2) keep the GATE-14 role lines; (3) optionally route simple-mode to Overview as the default trip screen. Recommendation weight: **Architect's density argument dominates** — the Hub cannot absorb the Overview without regressing the app's most-criticized screen. **What would flip it:** if your own usage shows Overview is a dead-end nobody returns to, do the OD-1 merge gate (fold share-card + total into the Hub header, redirect `/trip`→`/viagem`, audit all deep-links). **Confidence:** HIGH.

### 1.3 Future-apply plan (gate "OD-1", only if you still feel the overlap)
**Path A (recommended, low risk) — sharpen roles (1 version, web/OTA):**
1. Audit `TripOverviewPage` for any write/edit affordance → move to Hub; leave only total, timeline (read), funds (read bars), share card.
2. (Optional) In simple mode, make `/trip` (Overview) the default "Viagem" tab target and `/viagem` (Hub) the "advanced" structure screen behind the mode guard.
3. AC: no edit action exists on Overview; every plan/edit deep-link lands on the Hub; share card still one tap from Overview.

**Path B (only if Path A insufficient) — light merge (1 version, web/OTA):**
1. Fold the Overview's **total hero + share card** into the **Hub header**; keep the timeline as a collapsible Hub section.
2. Redirect `/trip` → `/viagem`; update every deep-link (dashboard insight, settings "visão avançada", copilot, share entry).
3. Keep `/trip/edit`, `/funds`, `/phase-preview` as the Hub's children (unchanged).
4. AC: a single trip screen; zero stranded routes (grep `/trip` usages); share card + total still present; full E2E on dashboard→trip + settings→funds deep-links.

---

## 2. OD-2 — "Fundo" → Trecho/Pote vocab migration (DEC-228 deferred half)

### 2.1 Current state (grounded)
- The **happy path already speaks Trecho/Pote** (Package #1: dashboard active-phase, TripHub "Potes e planejados", `AddTrechoSheet`/`PlanExpenseSheet`).
- Residual **"Fundo"** jargon is **intentionally confined** to the advanced `/funds` editor (Settings → "Visão avançada da viagem", DEC-219/D17) and the QuickAdd fund picker (DEC-228).
- DEC-228 deferred the blanket rename because **a pool can be a Trecho OR a Pote**, so a single generic "Fundo"→"Trecho" relabel is **semantically wrong**, and a half-rename (e.g. only the Hub section) makes the vocabulary *inconsistent* with the editor/cards — worse than the status quo.

### 2.2 Inline council — DEBATE (Proponent / Opponent / Judge)
**Decision Brief (neutral):** "Fundo" survives in the advanced funds editor + QuickAdd fund picker. A pool's true nature is **Trecho** (a phase/leg fund) **or Pote** (a goal/pot). Proposition: **"Rename the user-facing 'Fundo' to the pool's actual nature (Trecho/Pote), in one coherent pass, keeping `Fund`/`pool` code identifiers."** Verified: code uses `pool`/`Fund` widely; `scope==='linked_phases'` distinguishes trecho-like pools; Package #1 already shows nature-aware copy elsewhere. Chat lean to resist: "just replace the word Fundo with Trecho everywhere" (semantically wrong for pots).

**Proponent (FOR).** "Fundo" is the last island of pre-reform vocabulary; it contradicts every other screen. Renaming by nature finishes the Package-#1 mental model and removes the one place a user sees a term the rest of the app abandoned. Done right (nature-aware, not blanket), it's a pure i18n + small selector change — no engine touch. **Rec:** do the coherent pass. **Confidence:** HIGH. **Others miss:** the editor is exactly where a *power* user lives — leaving jargon there undercuts the reform precisely for the people who notice.

**Opponent (AGAINST).** Every rename risks muscle-memory breakage and support drift; "Fundo" is confined to advanced surfaces a casual user never sees, so the ROI is low and the regression surface (every `funds.*` key, the picker, the editor headings, backup/export labels) is non-trivial. A pool that is *neither* clearly a trecho nor a pote (edge configs) would render an awkward label. **Rec:** leave it; spend the gate on higher-traffic clarity. **Confidence:** MED. **Others miss:** some pools are ambiguous by configuration — the nature map needs a safe fallback word.

**Judge.** Both agree a *blanket* rename is wrong. The Proponent's **nature-aware** rename is the only correct version and is genuinely low-risk *if* it has a deterministic nature resolver with a safe fallback. The Opponent's real contribution is the **edge case**: define `poolNature(pool)` → `'trecho' | 'pote'` with a neutral fallback label (e.g. keep "Fundo" only for the truly-ambiguous residue, or use a generic "Reserva"). **Verdict: do OD-2 as a nature-aware pass with a fallback**, not a blanket rename, and only after Julio validates the exact terms. **Confidence:** HIGH. **Minority-wins:** if the nature resolver can't cleanly classify a meaningful share of real pools, the Opponent wins — keep "Fundo" as the umbrella and just add a one-line "isto é o seu Trecho/Pote" hint instead of renaming.

### 2.3 Future-apply plan (gate "OD-2", 1 version, web/OTA)
**Prereq:** Julio validates the term map (below) first.

1. **Pure resolver** `domain/funds/pool-nature.ts` → `poolNature(pool): 'trecho' | 'pote' | 'generic'` (trecho = `scope==='linked_phases'`/phase-bound; pote = goal/dated pot; generic = neither). Unit-tested with real pool fixtures.
2. **Nature-aware copy:** replace the static `funds.*` "Fundo" strings with copy keyed by nature — `funds.label_trecho` / `funds.label_pote` / `funds.label_generic` (fallback "Reserva"/"Fundo"). The funds editor headings, the QuickAdd fund picker chips, and any "mover de fundo" copy read the resolved label.
3. **Keep code identifiers** (`Fund`, `pool`, `/funds`, repositories) unchanged — UI strings only (same discipline as DEC-228's "Perfis"→"Atividades").
4. **i18n:** pt-BR/en/es for the three nature labels + the picker/editor strings.
5. **AC:** a trecho-pool reads "Trecho", a pote reads "Pote", an ambiguous pool reads the neutral fallback; no blanket "Fundo"→"Trecho"; `/funds` editor + QuickAdd picker + "mover de fundo" (SelectionBar action) all consistent; full E2E on the funds editor + the expense move-fund flow.
6. **Touch list:** `domain/funds/pool-nature.ts` (new), `features/funds/FundsPage.tsx`, the QuickAdd fund picker, `components/SelectionBar.tsx` action label (the "Mover de fundo" we just touched in 0.99.8), `i18n/locales/*`.

**Term map to validate (Julio):** Trecho = a fund tied to a phase/leg of the trip · Pote = a savings pot/goal (optionally dated) · fallback when neither → propose "Reserva" (or keep "Fundo"). Confirm these three words before the gate runs.

---

## 3. OD-3 — Wise importer split explainer (DEC-231 deferred)

### 3.1 Current state (grounded)
- DEC-231 (GATE 11) shipped a single reusable **`features/shared/SplitExplainer.tsx`** ("Como funciona a divisão", 3 numbered steps) reading one `split.*` i18n namespace, mounted on **QuickAdd, Receipt, Shared**.
- **Wise was deferred** (P3): its split lives inside the per-transfer **allocation BottomSheet** (the app's most complex power-user flow); threading the explainer there was judged deeper/riskier and against "keep advanced flows lean." The **copy source already exists** — only the mount is missing.

### 3.2 Inline council — quick (Advocate / Architect)
**Decision Brief (neutral):** The split explainer is mounted on 3 of 4 split surfaces; the Wise allocation sheet lacks it. Copy is already centralized. Question: mount it in Wise too? Chat lean to resist: "Wise is advanced, leave it bare."

**Advocate (blind).** A power user importing a Wise statement and splitting a transfer is *exactly* who benefits from a one-tap reminder of how splitting becomes a balance — and the copy already exists. Collapsed-by-default means zero added clutter for the returning user. **Rec:** mount it. **Confidence:** HIGH. **Others miss:** consistency across all four surfaces is itself a clarity win (G9's whole point).

**Architect (blind).** The only cost is finding a clean anchor in the allocation `BottomSheet` (top of the "dividir" block, mirroring Receipt). It's the same component, one import, local state — no engine touch, no new copy. The deferral reason ("riskier") was about scope discipline at GATE 11, not a real technical blocker. **Rec:** mount it at the top of the allocation split block, collapsed. **Confidence:** HIGH. **Others miss:** put it above the split toggle so it's seen before the user acts, not after.

**Red team.** Failure mode: the allocation sheet is cramped and the disclosure crowds it. Mitigation: collapsed-by-default + place it as the first row of the split sub-section only (not the whole sheet); if vertical space is tight, render it as a single "?" affordance that opens the same content.

**Synthesis.** Unanimous: **mount the existing `SplitExplainer` in the Wise allocation sheet, collapsed, at the top of the split block.** Lowest-risk of the three open decisions. **Confidence:** HIGH.

### 3.3 Future-apply plan (gate "OD-3", ~1–2h, rides any web/OTA release)
1. In the Wise allocation `BottomSheet` (the per-transfer "dividir" block), mount `<SplitExplainer />` collapsed at the top of the split sub-section.
2. If space is tight, gate it behind a small "Como funciona?" affordance that expands the same component.
3. **AC:** the Wise allocation sheet shows the identical explainer as QuickAdd/Receipt/Shared; collapsed at rest; no other Wise behavior changes; extend `e2e/split-explainer.spec.ts` to assert the Wise mount.
4. **Touch list:** the Wise importer allocation sheet component (`features/wise/*` allocation sheet), `e2e/split-explainer.spec.ts`. No new copy, no domain change.

---

## 4. Cross-cutting recommendation & sequencing

- **Order by risk/ROI:** OD-3 (quick, can ride the next OTA) → OD-2 (focused rename pass, needs your term validation) → OD-1 (only if the overlap still bothers you after GATE-14; prefer Path A "sharpen" over Path B "merge").
- **All three are web/OTA** (no native change, no APK).
- **None block G4** (payment methods) or the broad-audit work; they are independent backlog gates.
- **To execute later:** say "apply OD-1 Path A" / "apply OD-2" (after confirming the term map) / "apply OD-3" and it becomes a normal gated implementation with tests + Playwright + one deploy per version.

## 5. Decision-log hooks
- Add **DEC-242** = "Open decisions councils & future-apply plan (OD-1 keep-two/sharpen, OD-2 nature-aware Fundo→Trecho/Pote, OD-3 Wise explainer mount) — researched, deferred to dedicated gates" once this doc is accepted.
