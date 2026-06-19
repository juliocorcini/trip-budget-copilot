# Debt ("está me devendo") + Bill-Split — Deep Dive, Councils & Implementation Plan

> Last updated: 2026-06-19
> Status: **BUILD-READY** — councils run, decisions locked, gates defined. Implementation starts immediately (G1 → G2 → G3), one deploy per version.
> Scope owner: Julio (delegated all decisions to the council for this batch: "o que o conselho achar, você faz").
> Method note: all councils below were run **inline, in a single session (no subagents)** per `inline-council-no-subagents.mdc`. Every diagnosis claim is grounded in the current code (file refs inline). No competitive "uniqueness" claims (per `fact-verification.mdc`); Splitwise/Tricount patterns are cited as general, industry-standard knowledge (MEDIUM confidence).

---

## 0. TL;DR (the one finding that matters)

TripPilot has **two** money-sharing features that people confuse:

1. **`Dividir conta` (live table)** — `domain/split/*`, the "passa a nota" epic, hardened to v0.99.4. Works well on two devices.
2. **The debt / "está me devendo" feature** — `domain/splitting/*` + `domain/types/settlement.ts` + the `/shared` page. This is the one Julio says "não está funcionando tão bem".

**Root cause of "não está funcionando":** an **asymmetry** baked into the share-confirmation model (DEC-071).

When the owner registers an expense and splits it (or commits a live table):
- the owner's **own** share is born `confirmed`;
- **everyone else's** share is born `pending`;
- and `calculateDebts` **only counts `confirmed` shares** (`splitting.ts:210-215`).

Therefore:
- **"Eu devo a alguém"** → shows immediately (owner's own share is confirmed). ✅
- **"Alguém me deve"** → **invisible** in the balances and in "Dívidas pendentes" until that person confirms through a synced channel — which never happens for a friend who doesn't have the app. ❌

For offline friends (the 90% case), the owner splits a R$100 bill, gives João R$50, and the `/shared` page shows João as **"Em dia"** (zero), with **no pending debt to collect** — only a confusing dashboard card asking the **owner** to confirm a split the owner just created, with copy that says *"a pessoa ainda não confirmou"* (`pt-BR.json:1684`).

**The fix is localized and low-risk:** owner-authored shares for **non-connected** participants are born `confirmed` (the debt is real from the owner's ledger — coherent with DEC-106 "owner is the source of truth"). **Connected** participants (paired `linkedActorId`, or an active shared link) stay `pending`, because there the confirm/reject loop is real and meaningful. `calculateDebts` stays untouched.

Everything else in this plan (page redesign, summary hero, "lembrar/cobrar", split polish) is built on top of that corrected foundation.

---

## 1. Current-state map (grounded in code)

### 1.1 The two features

| | `Dividir conta` (live table) | Debt / "está me devendo" |
|---|---|---|
| Domain | `domain/split/*` (`split.ts`, `commit.ts`, `history.ts`, `claim-response.ts`) | `domain/splitting/splitting.ts`, `domain/types/settlement.ts` |
| Data | `SplitRecord` (`splitMeta`), `Session`, one expense + `ParticipantShare[]` | `Transaction.isShared` + `ParticipantShare[]` + `Settlement[]` |
| UI | `features/split/*` (SplitPage, SplitTablePage, history, pass-the-phone) | `features/shared/SharedExpensesPage.tsx` (`/shared`), `MirroredStatementsSection.tsx`, dashboard cards |
| Entry | FAB → "Dividir conta" | `/shared` (titled **"Participantes"**) reached from More/TripHub, Settings, Copilot, and a dashboard insight tap |
| State | v0.99.4, proven on 2 devices | the feature under review |

They **converge** on the same debt engine: a committed live table calls `commitSplit` (`orchestrators/split-orchestrators.ts`) which produces `ParticipantShare[]` exactly like QuickAdd, so **both** feed the "está me devendo" ledger.

### 1.2 The debt engine (`domain/splitting/splitting.ts`)

- `resolvePayerExpense` (DEC-114 truth table) — the single source for "who owes whom" at registration. Owner's own share remapped to `confirmed` (`splitting.ts:168-172`); third-party shares stay `pending` (from `buildSharesWithPayer`, only the payer is confirmed).
- `calculateDebts` — **filters `confirmationStatus === 'confirmed'`** (`splitting.ts:210-215`), nets balances, allocates against mutable remaining credits (BUG-003 fix).
- `buildParticipantStatement` (DEC-102) — itemized per-person statement (owes / is_owed lines + settlements).
- `suggestSimplifiedSettlements` (GAP-032) — minimal-transfer netting.
- `createSettlement` / `findPendingConfirmationShares` / `calculateOwnerPersonalCost` / `collectSplitNotifyTargets`.

### 1.3 The live-table commit (`orchestrators/split-orchestrators.ts:114-125`)

```
confirmationStatus: share.isOwner ? 'confirmed' : 'pending'
```

→ same asymmetry; after a table split, every guest's debt is `pending` → invisible in `/shared` until the owner confirms.

### 1.4 Where it surfaces

- **`/shared` (SharedExpensesPage)** — titled `more.participants` ("Participantes"). Sections in order: SplitExplainer → participant list with per-person balance (computed from **confirmed-only** debts) → add participant / QR → receive-from-device → MirroredStatements → **shared expenses** (with pending/confirmed/rejected pills) → **Dívidas pendentes** (settle) → settlements log. **6+ heavy sections; P2P/QR machinery dominates.**
- **Dashboard** — `useDashboardModel` computes `pendingShares` (third-party pending) → a "X pendências de confirmação · R$Y" card (`DashboardCards.tsx:1002,1327`) that opens the owner's confirm/reject sheet (`DashboardSheets.tsx:182-232`). Confirmed debt only appears as a **rotating insight** (`participant_balance`), never as a fixed "te devem R$X".

### 1.5 The contradiction the user sees

- `/shared` participant balance uses **confirmed-only** debts → shows **"Em dia"**.
- Right below, "Gastos compartilhados" shows the same expense's share as **"Pendente"**.
- The dashboard asks the **owner** to confirm it, but the copy says **the other person** must confirm.
- Net effect: "I clearly split a bill, but the app says nobody owes me and nags me to confirm my own entry."

---

## 2. Diagnosis — prioritized problems

| ID | Problem | Evidence | Severity |
|----|---------|----------|----------|
| **D-P1** | "Alguém me deve" is invisible for offline friends (confirmed-only gate + third-party born pending) | `splitting.ts:210-215`, `splitting.ts` buildSharesWithPayer, `split-orchestrators.ts:122` | **P0 — the core complaint** |
| **D-P2** | Owner must re-confirm a split they authored; copy says the *other* person must confirm | `DashboardSheets.tsx:182-232`, `pt-BR.json:1684` | **P0** |
| **D-P3** | Balance (confirmed-only) contradicts the "Pendente" pill on the same expense | `SharedExpensesPage.tsx:307,338-375,480-514` | P1 |
| **D-P4** | Discoverability + naming: the debt hub is titled "Participantes", buried in More; no "te devem/você deve" home surface | `SharedExpensesPage.tsx:318`, `TripHubPage.tsx:245`, dashboard insight only | P1 |
| **D-P5** | No settle-up summary hero (A receber / A pagar); settling is per-pair only; no "lembrar/cobrar" action | `SharedExpensesPage.tsx:519-570` | P1 |
| **D-P6** | P2P machinery (QR identity, receive-from-device, mirrored statements, pairing) overloads the page for the simple "track who owes me" need | `SharedExpensesPage.tsx:441-456,793-948` | P2 |
| **D-P7** | Live-table debts inherit the same pending invisibility (consistency) | `split-orchestrators.ts:114-125` | P1 (folded into D-P1) |
| **D-S1** | Split (live table) is solid but has small polish gaps (post-commit "cobrar todos", clearer owner cost) | `SplitPage.tsx`, history | P2 |
| **D-A\*** | App-wide quick wins (see §4 brainstorm) | various | P2/P3 (mostly deferred) |

---

## 3. Inline councils

### Council A — DEBATE: the debt-confirmation model fix

**Mode:** debate · **Roles:** Proponent / Opponent / Judge · _Inline, 1 request, no subagents._

**Decision Brief (neutral):** Today every third-party share is born `pending` and `calculateDebts` counts only `confirmed`, so "someone owes me" is invisible until the counterparty confirms via a synced channel. Proposition under debate: **"Owner-authored shares for NON-connected participants should be born `confirmed` (counted as a real debt immediately); only CONNECTED participants (`linkedActorId !== null` or an active shared link) stay `pending`."** Verified facts: owner is the financial source of truth (DEC-106); `calculateDebts` filters confirmed (`splitting.ts:210`); the owner can already self-confirm via the dashboard sheet. Chat lean to resist: "just make everything confirmed" (would break the legit mirror confirm/reject loop).

**Proponent (FOR).** The confirmation gate solves a real problem only when a real counterparty can act. For an offline friend there is **no one to confirm** — so the gate degrades into "the owner's own debt is hidden from the owner". Born-confirmed for non-connected restores the obvious mental model: *I split it, therefore they owe me, now.* It is **coherent with DEC-106** (owner is truth) and **surgical**: it changes only the `confirmationStatus` chosen at creation, leaving `calculateDebts`, statements, settlements, and the mirror loop byte-identical. It also removes the contradictory dashboard nag for the 90% case. **Rec:** adopt. **Confidence:** HIGH. **Others miss:** it shrinks, not grows, the surface — fewer "pending" states to reason about.

**Opponent (AGAINST).** Born-confirmed risks **silent over-claiming**: the owner could mistype a split and the debt is immediately "real" with no second look. It also splits behavior by a hidden attribute (`linkedActorId`), so two identical-looking participants behave differently — a debuggability and support trap. And it forks the data model history: some shares confirmed-at-birth, some not, complicating any future audit. **Rec:** instead, **count owner-authored shares regardless of status** and show an "aguardando aceite" badge — one rule, no fork. **Confidence:** MED. **Others miss:** the `linkedActorId` signal misses shared-link guests (DEC-207) who are reachable but not paired.

**Judge.** Both agree the status quo is broken; the split is *how* to make the debt real. The Opponent's "count regardless of status" (Option B) is elegant but **changes `calculateDebts` semantics globally** — it ripples into dashboard pending math, insights, statements, and the mirror reconciliation, exactly the blast radius we must avoid under a "no-bugs" mandate. The Proponent's born-confirmed (Option A) is **localized to two creation sites** and leaves the engine intact. The Opponent's two valid worries are addressable **without** Option B: (1) over-claiming → keep an **Undo** on registration (already exists) + the debt is editable; (2) shared-link guests → define **"connected" = `linkedActorId !== null` OR an active share link/peerLink**, and additionally **surface connected-pending debts in the UI** (display-only) so nothing is ever hidden. **Verdict: Option A wins**, with the "connected" predicate broadened and a display-layer for connected-pending. **Confidence:** HIGH. **Minority-wins scenario:** if we later add multi-owner/group editing, Option B's single-rule model becomes worth the migration.

### Council B — REVIEW: the redesigned debt hub UX ("Acerto de contas")

**Mode:** council/review · **Roles:** Advocate(user) / Architect / Critic / Strategist · _Inline, 1 request, no subagents._

**Decision Brief (neutral):** `/shared` is titled "Participantes", opens with an explainer, and stacks participant balances, add/QR, receive-from-device, mirrored statements, shared expenses, pending debts, settlements. The job-to-be-done is "see who owes whom and settle it." Verified: balances read confirmed-only; settle is per-pair via a sheet; `suggestSimplifiedSettlements` exists but is opt-in.

**Advocate (user).** People come here to answer one question — *"quem me deve e quanto?"* — and to nudge/settle. The page should **open with the answer**: a hero "A receber X · A pagar Y", then a list of people each with a net and two buttons: **Lembrar** (send "você me deve R$X" via WhatsApp/share, Pix later) and **Liquidar**. Adding people, QR, statements are secondary. **Rec:** answer-first layout. **Confidence:** HIGH. **Others miss:** "Lembrar" is the action people actually want and it's entirely absent today.

**Architect.** Keep the engine; **reorganize, don't rewrite**. The hero is a pure derivation from existing `calculateDebts` + balances. P2P (QR/receive/mirror/pairing) goes behind a collapsible **"Conexões"** section — same components, moved. New copy keys, no new tables. Risk lives in keeping `MirroredStatementsSection`'s live sockets mounted while collapsed (don't unmount on collapse). **Rec:** layout + section extraction only. **Confidence:** HIGH. **Others miss:** the live-socket lifecycle must survive the reorg.

**Critic.** Renaming "Participantes" → "Acerto de contas" can confuse users who used it to *manage people*; keep an explicit "Pessoas" subsection. A summary hero that shows "A receber X" while connected-pending debts are excluded re-creates the very contradiction we're fixing — the hero must reflect the **post-G1** numbers and clearly mark "aguardando aceite". **Rec:** ship G1 before G2; label pending clearly. **Confidence:** MED. **Others miss:** entry points (More, Settings, Copilot, dashboard) all say "Participantes" — rename must be consistent or it's worse.

**Strategist.** This hub is the spine of the social-money story (split → owe → settle → pay). Investing in clarity here compounds with the live-table epic and the future Pix/payment feature (DEC-207 §16). Position it as **"Acerto de contas"** with people inside — it reads as a destination, not a roster. **Rec:** rename + hero + remind. **Confidence:** HIGH. **Others miss:** the dashboard "te devem/você deve" card is the discoverability unlock, not the page title.

**Red team (kill the redesign).** If G1 is wrong, G2 paints a confident "A receber R$X" that's still incomplete → worse trust than today. Mitigation: **G1 is a hard prerequisite**, verified by tests + a 2-device pass before G2 ships. Also: don't over-collapse P2P — paired users rely on mirrored statements; keep them one tap away, not buried.

**Synthesis (Chair).** Consensus: **answer-first hub, engine untouched, P2P demoted not deleted, G1 before G2.** Tensions: rename risk (Critic) vs. destination framing (Strategist) → resolve by retitling to **"Acerto de contas"** with a visible **"Pessoas"** subsection and consistent entry-point copy. Recommendation: build G2 as pure reorganization + derived hero + "Lembrar/Liquidar", after G1. **Confidence:** HIGH.

### Council C — ASSESS: scope, risk & sequencing of the whole batch

**Mode:** assess · **Roles:** Risk / Opportunity / Cost / Timeline · _Inline, 1 request, no subagents._

**Decision Brief (neutral):** Deliver (a) the debt-model fix, (b) the hub redesign, (c) remind/settle + split polish + select app-wide wins — autonomously, one deploy per version, with tests/Playwright, "no bugs". Existing tests assert third-party `pending` in a few suites.

**Risk Analyst.** Top risk: **regression in the confirmation contract** (tests in `split-commit`, `splitting`, `payer-semantics`, mirror cycle). Probability MED, impact HIGH. Mitigation: thread `connectedParticipantIds` as an explicit input (default = none connected), update the affected unit tests to the new semantics, add connected-case tests, and re-run the full split+sync suites at the G1 gate. Second risk: the demo seeds a hand-made `pending` share (`demo-data.ts:292`) — align it or a screenshot test drifts. **Rec:** G1 is a self-contained, fully-tested gate. **Confidence:** HIGH. **Others miss:** backup/migration tests touch confirmationStatus too (`migration-v3`, `backup`).

**Opportunity Scout.** Fixing D-P1/D-P2 turns the most-confusing feature into a showcase: split a bill → instantly see "te devem R$X" → one-tap "Lembrar". It also de-risks the future Pix/payment feature by giving it a home (the hub). **Rec:** ship the trio; it's the highest-leverage UX win available right now. **Confidence:** HIGH.

**Cost Analyst.** Effort (Tier-3): G1 ~6–8h (domain + tests), G2 ~8–10h (UI reorg + hero + copy + E2E), G3 ~6–8h (remind + split polish + 1–2 wins). Total ~20–26h structured ≈ 7–9h real. Each gate = 1 version + 1 Pages deploy (no APK unless native changes — none planned). **Rec:** 3 versions (0.99.5/6/7). **Confidence:** MED.

**Timeline Realist.** The dependency is strict: **G1 → G2 → G3**. Don't parallelize. Buffer for the test-update churn in G1. App-wide "other improvements" must be **capped** (1–2, low-risk) or they balloon the batch and threaten "no bugs". **Rec:** hard scope cap on G3 extras; everything else → backlog. **Confidence:** HIGH. **Optimism flag:** "other functions of the app" is open-ended — resist it.

**Red team.** The biggest way this fails is scope creep from "também junta outras melhorias do app". Kill it by pre-committing the backlog (§5) and shipping only the debt/split trio now.

**Synthesis (Chair).** Consensus: **3 gates, strict order, G1 fully tested in isolation, hard cap on app-wide extras.** Recommendation: proceed; treat the confirmation-contract tests as the primary gate. **Confidence:** HIGH. **What would flip it:** if updating the confirmation tests reveals the mirror/share-link flow *depends* on third-party born-pending in a way that breaks → fall back to Option B's display-only counting for non-connected and keep born-pending. (Pre-checked: the mirror reject affordance only needs pending for **connected** participants, which we preserve — so this is unlikely.)

### Council D — BRAINSTORM: split polish + app-wide improvements

**Mode:** brainstorm · **Roles:** Visionary / Analyst / Connector / Simplifier · _Inline, 1 request, no subagents._

**Decision Brief (neutral):** Surface improvements to the split/debt area and the wider app; we will implement only the highest-value, lowest-risk few now and backlog the rest.

**Visionary.** "Acerto de contas" becomes a social-money cockpit: one-tap **"Cobrar todos"** after a table commit (sends each debtor their amount), **Pix QR** per debt, a trip-end **"fechar a conta da viagem"** that nets everyone with minimal transfers. **Rec:** seed Pix-ready "Lembrar" now; full Pix later. **Confidence:** MED.

**Analyst.** Industry-standard (Splitwise/Tricount, general knowledge — MEDIUM confidence): the killer features are (1) a persistent net balance per person, (2) "remind", (3) "settle up" with simplification, (4) activity log. We already have 1, 3 (opt-in), partial 4 (statement). Missing: **remind** and **always-on simplification visibility**. **Rec:** prioritize remind + make simplify discoverable. **Confidence:** HIGH.

**Connector.** Borrow from the live-table epic: its **history/"esse item foi pra quem"** and **channel attribution** (owner/adhoc/linked) are exactly what a debt statement wants. Reuse the segmented person/item view idea in the per-person statement. **Rec:** unify statement visuals with split history. **Confidence:** MED.

**Simplifier.** The 20% that yields 80%: **(1) born-confirmed (G1), (2) a dashboard "te devem/você deve" card, (3) a "Lembrar" button.** Everything else is gravy. Resist app-wide detours. **Rec:** do exactly those three; backlog the rest. **Confidence:** HIGH. **Others miss:** the cheapest win is the dashboard card — pure derivation, no new model.

**Red team (why the boldest idea fails).** Pix QR / "fechar a conta da viagem" need payment metadata + more reconciliation → out of scope now; shipping them half-done erodes trust. Keep them in the backlog with a clear seam (the "Lembrar" message is the seam).

**Synthesis (Chair).** Adopt the **Simplifier's three** + a Pix-ready "Lembrar" message (copyable text now, Pix later) + a small split post-commit "cobrar" affordance. Everything else (Pix QR, trip-end netting, statement-visual unification, app-wide items) → **backlog (§5)**. **Confidence:** HIGH.

---

## 4. Locked decisions (council outcome)

- **DL-1 (debt model).** Owner-authored third-party shares are born `confirmed` when the participant is **NOT connected**; `pending` only when **connected** = `linkedActorId !== null` OR has an active shared link / `peerLink`. Implemented via an explicit `connectedParticipantIds` input to `resolvePayerExpense` and `commitSplit`. `calculateDebts` unchanged. (Council A)
- **DL-2 (copy).** "Pendente" is reframed to mean "aguardando o aceite de quem tem o app/link" and is shown only for connected-pending. Offline friends never produce a "pending" state. (Council A/B)
- **DL-3 (hub redesign).** `/shared` → **"Acerto de contas"** with a derived **summary hero** (A receber / A pagar / em dia), per-person **Liquidar** + **Lembrar**, a visible **"Pessoas"** subsection, and P2P machinery moved into a collapsible **"Conexões"** (components unchanged, live sockets kept mounted). Connected-pending debts shown as an explicit **"Aguardando aceite"** group (display-only). (Council B)
- **DL-4 (discoverability).** A dashboard **"te devem R$X · você deve R$Y"** card linking to the hub; the legacy "pendências de confirmação" card shows only when there are genuinely connected-pending items. (Council B/D)
- **DL-5 (remind/cobrar).** A **"Lembrar"** action that shares a localized message ("Você me deve {amount} da viagem {trip}") via the OS share sheet / clipboard, Pix-ready (Pix QR deferred). A post-commit "cobrar" affordance on the split. (Council D)
- **DL-6 (scope cap).** App-wide "other improvements" are capped to **0–2 low-risk wins** in G3; the rest is backlog (§5). Strict gate order G1→G2→G3, one deploy per version, no APK (no native change). (Council C)

---

## 5. Backlog (explicitly deferred, not lost)

- Pix QR per debt + "fechar a conta da viagem" (trip-end minimal-transfer settle-all).
- Unify per-person statement visuals with the live-table history (person/item segmented view).
- Always-on "simplify debts" visibility (currently opt-in).
- App-wide items to be triaged later (none promoted into this batch beyond the cap).

---

## 6. Implementation plan (gates)

### G1 — Debt becomes real from the owner's ledger · **v0.99.5**

**Scope (surgical):**
1. Add a pure helper in `domain/splitting/splitting.ts`: decide a non-owner share's birth status from a `connectedParticipantIds` set.
2. Thread `connectedParticipantIds: string[]` (default `[]`) into `PayerExpenseInput`/`resolvePayerExpense` (and `BuildSharesInput` as needed). Rule: owner → `confirmed`; non-owner → `connected ? 'pending' : 'confirmed'`.
3. `commitSplit` (`split-orchestrators.ts`): compute connected ids from trip participants (`linkedActorId !== null` or active peerLink/shareLink) and apply the same rule (replace line 122).
4. `QuickAddPage` `buildExpense`: pass the connected set (derived from `participants` + peerLinks).
5. Align demo data (`demo-data.ts`) so the seeded example matches the new model (keep one *connected*-pending example to still demo the mirror flow).

**Acceptance criteria:**
- AC1: owner pays + splits with a **non-connected** friend → friend's share born `confirmed`; `calculateDebts` shows "friend owes me" **immediately** (no manual confirm).
- AC2: owner pays + splits with a **connected** participant (`linkedActorId` set) → that share born `pending` (mirror loop preserved).
- AC3: live-table commit with non-connected guests → debts appear in `/shared` without owner confirmation.
- AC4: "eu devo" cases (someone else paid) unchanged (still immediate).
- AC5: full split + sync unit suites green; tsc clean.

**Tests:** update `payer-semantics.test.ts`, `splitting.test.ts`, `split-share.test.ts`, `split-commit.test.ts`, mirror/statement suites to the new semantics; add connected-vs-non-connected cases; verify `calculateDebts` output unchanged for confirmed inputs.

**Risk/mitigation:** confirmation-contract regressions → explicit param + test updates + run `migration-v3`/`backup` suites. **Deploy:** Pages, no APK.

### G2 — "Acerto de contas" hub redesign · **v0.99.6**

**Scope:** retitle `/shared` to "Acerto de contas" (+ consistent entry-point labels); add a derived **summary hero**; per-person **Liquidar** + **Lembrar (stub→G3)**; **"Pessoas"** subsection; move QR identity / receive-from-device / mirrored statements into a collapsible **"Conexões"** (keep `MirroredStatementsSection` mounted so live sockets persist); add an explicit **"Aguardando aceite"** group for connected-pending; add the dashboard **"te devem/você deve"** card (DL-4).

**Acceptance criteria:** hero math equals `calculateDebts` net; rename consistent across More/Settings/Copilot/dashboard; P2P still reachable in ≤1 tap; connected-pending visible; dashboard card links to the hub. Targeted E2E for the hub; unit for the summary builder.

**Risk/mitigation:** live-socket lifecycle on collapse (don't unmount); rename consistency (grep all `more.participants` usages). **Deploy:** Pages.

### G3 — Lembrar/Cobrar + split polish + capped wins · **v0.99.7**

**Scope:** implement **"Lembrar"** (share localized "você me deve {amount}" via OS share/clipboard, Pix-ready); a post-commit **"cobrar"** affordance on the split; make **simplify debts** discoverable; **0–2** capped low-risk app-wide wins (chosen at G3 start, logged in dev-log). 

**Acceptance criteria:** "Lembrar" produces a correct localized message per person; nothing else regresses; capped wins each have a test. Targeted E2E. **Deploy:** Pages.

---

## 7. Anti-regression & verification protocol

- Per gate: run the **scoped** suites first (split/splitting/sync/dashboard), then `tsc --noEmit`, then a focused Playwright pass for the touched screens; full unit suite at each gate boundary.
- G1 is verified in isolation (it changes a financial contract) before any UI work.
- Update the brain: this doc + a `decision-log.md` DEC (DL-1..DL-6) + `project-status.md` + `dev-log.md` per version.
- One Pages deploy per version; verify live `version.json` + embedded `APP_VERSION`. No APK (no native change).

## 8. File index (touch list)

- `domain/splitting/splitting.ts` (G1: birth-status helper + `resolvePayerExpense` input)
- `domain/orchestrators/split-orchestrators.ts` (G1: `commitSplit` status rule)
- `features/expenses/QuickAddPage.tsx` (G1: pass connected set)
- `domain/demo/demo-data.ts` (G1: align seeded example)
- `features/shared/SharedExpensesPage.tsx` (G2: hub redesign)
- `features/shared/MirroredStatementsSection.tsx` (G2: move under "Conexões", keep mounted)
- `features/dashboard/DashboardCards.tsx` + `useDashboardModel.ts` (G2: te devem/você deve card)
- `i18n/locales/{pt-BR,en,es}.json` (G2/G3: copy, rename, remind message)
- tests across `tests/unit/domain/splitting|orchestrators|sync` + `e2e/*` (all gates)
