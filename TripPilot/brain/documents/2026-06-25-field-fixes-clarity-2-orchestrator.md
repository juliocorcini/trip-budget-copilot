# Field Fixes & Clarity #2 — Implementation Orchestrator

> **Status: ACTIVE.** Single source of execution truth for the **third review wave** (Julio's field
> feedback after shipping 1.1.3-rc). Base **1.1.3-rc** (Discovery & Clarity wave complete, web/OTA).
> The app is live and tested — **do not rebuild or inflate**. This wave is *bug fixes + honest
> clarity + small UX corrections*. One continuous session, **deploy per gate**, brain synced per gate.

---

## §0 — Mission

Julio field-tested 1.1.3-rc and reported 13 concrete points. They split into three kinds:

1. **Real bugs that block correct use** — a phase-scoped fund can't be created without polluting the
   current home with a phantom Event; an off-phase fund can't be selected when logging an
   expense/income; the AI button on Quick Add / Income does nothing; the comparator's photo path is
   dead; the horizontal scrollbar came back app-wide.
2. **Honest clarity** — when "free today" goes negative the piggy quietly covers it (say so);
   pace × plan × piggy numbers look contradictory (reconcile/explain); backup screen claims the wrong
   folder and leaks "JSON" jargon; the screen tutorial/coach-marks are stale.
3. **Small UX wins** — label the statement-import entry; first-run "Descobrir" call-to-action; a
   compact, expandable day check-in; the cost-benefit tool back in the visible FAB grid; camera/mic
   parity with a single "camera or gallery" chooser everywhere.

**Prime directive:** fix the mental-model breakage around **Event × Pote/Fundo × Fase** (E01/E02)
first — that is the deepest confusion — then the dead-ends (E03), then clarity and polish. **Never
change the cofrinho/insight/budget MATH** (ÂNCORA 11) — only what is created, what is selectable, and
what is explained.

---

## §1 — Rules & autonomy (inviolable)

1. **No subagents / no Task tool / no delegation.** Everything inline, this session (cost is per
   request). Multiple perspectives = sections of ONE response.
2. **Do not ask permission to advance.** Finishing a milestone/gate is the cue to **commit → deploy →
   update dev-log → next**, not to stop.
3. **Don't narrate what you'll do — do it.** Minimize narration.
4. **Continue until §12 (Definition of Done) is all TRUE** — or until context genuinely runs out
   (then close the current gate clean: commit + deploy + handoff in `dev-log.md`, stop clean), or an
   insurmountable credential/cost blocker. **Only at that final hand-off** does the message end with
   an `AskQuestion`.
5. **Reuse what exists — don't reinvent.** This wave mostly *reshapes, surfaces and explains* existing
   pieces (`getAvailablePoolsForPhase`, `selectActivePhasePool`, `createPlannedExpense`/
   `routePlannedExpense`, `createBudgetPool`/`createEnvelope` `linked_phases`, `AssistantSheet`/
   `assistant-bus`, `buildPiggyLedger`, `resolveSavingDestination`, `ImageSourceChooser`,
   `extractUnitItemViaCloud`, the `no-scrollbar`/universal scrollbar CSS, `HelpMode` coach-marks).

New ambiguity the brain doesn't resolve → run an **inline council** (1 request, no subagents), record
it as `DEC-NNN (PROPOSED)` in `decision-log.md`, and continue.

---

## §2 — Read order (once, before executing)

1. This orchestrator (§0–§13).
2. `brain/decision-log.md` DEC-307→320 (the Discovery & Clarity wave — this wave **extends** D15/DEC-314/315 and DEC-311).
3. `brain/product-spec.md` §30 (cofrinho rule — **do not change the math**).
4. `src/dev-log.md` Discovery & Clarity section (the model + the per-gate state).
5. Before editing any file, **re-read the file cited in §6** (symbols may have moved).

---

## §3 — Non-negotiables (re-read before EACH gate)

**This wave's specifics:**
- **Pote/Fundo ≠ Evento.** A Pote/Fundo never creates a countdown Event and never appears in the
  current phase's Home focus. Only an Event has a date + countdown (DEC-315 stands; E01 sharpens it).
- **A fund of any phase is selectable when logging an expense/income.** Off-phase `linked_phases`
  pools are reachable (in a clearly-labelled secondary group), never auto-selected, never hidden
  (extends D15b/DEC-314, which only covered global pots).
- **No dead controls.** Every visible button does something or is removed (ÂNCORA 9 — prefer giving
  it a function over deleting).
- **One destination per saving, and say where overflow came from.** When the day goes negative and
  the piggy covers it, the Home states it plainly; the other days do not change (DEC-313/314 + E08).
- **The scrollbar never ships again.** Locked by CSS + a regression test (E11).
- **Help/tutorial = mirror of the product.** Coach-marks and the backup copy match the current UI.

**Inherited app anchors (absolute):**
- **Money = integer cents** (DEC-020). **Domain = pure TS, zero React import.** Logic never inside a
  component.
- **The cofrinho/insight/budget math does NOT change this wave** (ÂNCORA 11) — only creation,
  selectability, messaging and explanation. After every gate the numbers are **identical** to the
  1.1.3-rc baseline.
- **UI text = `t()` always** (DEC-054), pt-BR + en/es for any new copy. Zero hardcode. Code in English.
- **ÂNCORA 9 — hide, never delete.** **Never block logging an expense** (DEC-053). **No visible
  scrollbar.** **State dictionary** (DEC-304) for any new copy.
- Additive Dexie fields only (no migration unless justified). Preserve the 60fps motion / theme
  tokens / `tabular-nums` / glass nav / subtle input focus.

---

## §4 — Baseline (verified 2026-06-25, before touching anything)

- **Version**: **1.1.3-rc** live (web/OTA). `package.json` + `app-version.ts` + `public/version.json`.
- **Tests**: unit **2312 pass / 2314 collected** — the **2 failures are the documented WebCrypto
  `split-live-loop` baseline** (`crypto.subtle` needs Node 22; this sandbox is Node 18.17.0; they pass
  in CI). `tsc --noEmit` clean. `npm run build` green (`index` 409.28 KB < 500 KB).
- **E2E**: Playwright cannot load its ESM config under Node 18.17.0 (needs ≥18.19) → **CI-verified per
  gate** (write specs; cannot run locally).
- **Deploy pipeline (unchanged)**: bump `package.json` + `src/utils/app-version.ts` +
  `public/version.json` (+ release note pt/en/es in `src/utils/release-notes.ts`) →
  `G=/usr/bin/git; "$G" commit -m "…"` + push `master` → **Cloudflare Pages auto-build** (`build:pages`
  → `dist/` + `bundles/<v>.zip` OTA). Verify `/version.json` + `/bundles/<v>.zip`. **Worker untouched
  this wave** (UI/clarity only — no route change).
- **Git note (WSL)**: the Shell harness injects `--trailer` (sandbox git 2.25.1 rejects it). **Bypass:**
  `G=/usr/bin/git; "$G" commit -m "…"`. Always `git --no-pager …`; never open a pager/editor.

---

## §5 — Change-set E01–E13

| ID | Title | Kind | Gate |
|----|-------|------|------|
| **E01** | Create door: a Pote/Fundo can target a phase and never becomes an Event/countdown nor pollutes the current Home | bug + design | G3 |
| **E02** | Off-phase funds selectable when logging an expense **and** an income | bug | G2 |
| **E03** | The AI button on Quick Add / Income is a dead end (assistant not mounted off-AppShell) → make the assistant global | bug | G1 |
| **E04** | Statement-import entry needs a text label ("Importar extrato"), like "Escanear" | UX | G1 |
| **E05** | First-run home header: an expanded labelled "Descobrir" CTA (and hide the empty bell) until the hub is opened once | UX | G4 |
| **E06** | Compact, expandable day check-in sharing the "Posso gastar" line | UX | G4 |
| **E07** | Cost-benefit comparator back in the FAB's visible smart-tools grid (above "Dividir") | UX | G5 |
| **E08** | When "Livre hoje" goes negative, say the cofrinho covered it (other days unchanged) | clarity | G4 |
| **E09** | Reconcile + explain pace × plan × piggy (they can all be true at once) | clarity | G6 |
| **E10** | Comparator photo path (multi-image extract) is dead → fix | bug | G5 |
| **E11** | The horizontal scrollbar regressed app-wide → permanent lock + regression test | bug | G1 |
| **E12** | Backup screen: "Downloads" not "Documentos", drop "JSON" jargon, group send vs import, refresh coach-marks | clarity | G6 |
| **E13** | Capture parity: mic + camera always offered (permission on tap), one "camera or gallery" chooser everywhere | UX | G5 |

---

## §6 — Root-cause map (file ↔ change, exact symbols — re-read before editing)

- **E01** — `src/features/trip/PlanExpenseSheet.tsx` (`handleCreate`, Q1 "tem data?" fork) +
  `src/domain/orchestrators/plan-orchestrators.ts` (`createPlannedExpense`) +
  `src/domain/planning/plan-routing.ts` (`routePlannedExpense`, `outcomeCreatesEvent`,
  `outcomeCreatesNewPot`). **Cause:** `hasDate=true` + `funding='new_pot'` routes to `event_new_pot`,
  which creates a `PlannedOccurrence` (countdown Event on the Home) **and** a `global` pot dated to the
  event interval. A user setting money aside for a *future phase that happens to have dates* (e.g.
  "Hospedagem Eurotrip", 15/07–04/08) gets a phantom Event + a dated global pot — exactly what they did
  NOT want. The working mental model is the `/funds` "add fund → vinculado a fases → <phase>" path
  (`linked_phases` pool, no Event, off the current Home, present in its phase). **Fix:** let the door
  create a **phase-scoped Pote/Fundo** (no Event, no countdown, no current-Home pollution); reserve the
  Event branch for genuine dated events. See DEC-321.
- **E02** — `src/domain/budget/budget.ts` (`getAvailablePoolsForPhase` → `{ operational, global }`),
  consumed by `src/features/expenses/QuickAddPage.tsx` (`selectablePools = [...operational, ...global]`,
  l.~213-216) and `src/features/income/IncomePage.tsx` (same, l.~32-39). **Cause:** `operational` =
  only `linked_phases` pools linked to the **current** phase; a `linked_phases` pool linked to another
  phase is neither `operational` nor `global`, so it never appears in the picker. **Fix:** expose
  off-phase operational pools as a third, clearly-labelled, **selectable (not auto)** group. See DEC-322.
- **E03** — `src/app/router.tsx` (`/quick-add` l.191 and `/income` l.192 are **siblings of**
  `<AppShell>`, not children) + `src/app/AppShell.tsx` (`<AssistantSheet />` l.39) +
  `src/features/assistant/assistant-bus.ts` (`openAssistant`/`subscribeAssistantOpen`). **Cause:** on
  those routes `AssistantSheet` is unmounted, so `openAssistant()` publishes to a bus with no
  subscriber → nothing happens. **Fix:** mount `AssistantSheet` once at `RootLayout` (global overlay).
  Verify `AppDataProvider` wraps `RootLayout` so the sheet's data hook still resolves. See DEC-323.
- **E04** — `src/features/expenses/ExpenseListPage.tsx` (l.~387-394): the scan chip has a text label
  (`receiptScan.entry_short`), the import button is icon-only (`upload_file`, aria-label only). **Fix:**
  give the import entry a visible label (`expenses.import_statement`), same chip shape. See DEC-324.
- **E05** — `src/features/dashboard/DashboardPage.tsx` (header l.~461-497: `travel_explore` discover
  button + `notifications` bell). No usage/first-run counter today (`app-settings.ts` has only
  `onboardingCompleted`). **Fix:** additive `discoverHintSeen?: boolean`; show an expanded labelled
  "Descobrir" CTA and hide the (empty) bell until the hub is opened once, then revert. See DEC-325.
- **E06** — `src/features/dashboard/DashboardCards.tsx` (`daily_checkin` case l.~363+ and the
  `AskToSpendShortcut` placement l.~905) + `src/features/dashboard/AskToSpendShortcut.tsx`. **Fix:**
  put the compact check-in on the same row as "Posso gastar", expandable (accordion). See DEC-326.
- **E07** — `src/components/FAB.tsx` (`GROUPED_ACTIONS`: comparator `group: 'other'` l.~106-113;
  `plan` group renders the visible grid l.~417-423). **Fix:** move the comparator to `group: 'plan'`
  (reverses DEC-311's collapse, per Julio 2026-06-25). See DEC-327.
- **E08** — `src/features/dashboard/DashboardCards.tsx` (free-today render + `daily_checkin`
  `resolveSavingDestination`) + `src/domain/budget/piggy-ledger.ts` (`buildPiggyLedger` — read only).
  **Cause:** when the day overspends and the piggy covers it, the Home shows the negative number but
  not the "the piggy covered it, other days unchanged" story. **Fix:** a read-only message under the
  free-today number when the piggy absorbed an overspend. **No math change.** See DEC-328.
- **E09** — `src/domain/budget/budget-signal.ts` (pace / "acima do ritmo") +
  `src/domain/copilot/pattern-reading.ts` ("para onde vai" projection) +
  `src/domain/budget/piggy-ledger.ts` (cumulative buffer). **Cause:** pace (recent trend) + plan
  projection + piggy (cumulative early savings) are different lenses and can all be true at once;
  presented together they read as contradictory. **Fix:** verify consistency with tests, then add a
  one-line plain explanation where they co-appear. **No math change.** See DEC-329.
- **E10** — `src/features/comparator/ComparatorPage.tsx` (`handlePickedFiles` l.~173;
  `cameraInputRef`/gallery inputs l.~438-448) + `src/utils/ai-unit-extract.ts`
  (`extractUnitItemViaCloud`) + `src/utils/image/compress.ts`. **Cause (to confirm at impl):** photo
  pick → compress → cloud extract produces no rows. Suspects: file-input `onChange` not reset (re-pick
  same file = no event), the `/unit-extract` worker call failing silently, or the compress step. **Fix:**
  make the photo path reliably yield review rows; surface a clear error instead of silent nothing. See
  DEC-330.
- **E11** — `src/styles/globals.css` (universal `*` scrollbar hide l.~125-193; `.no-scrollbar`) + the
  C25 style-hygiene test (`src/tests/unit/**` — find it). **Cause:** the rule exists but a bar regressed
  again (engine/zoom/new overflow container). **Fix:** harden the rule to be regression-proof and add a
  test that fails if the universal hide rules are weakened or a raw scrollbar can reach the user. See
  DEC-331.
- **E12** — the backup screen (`/settings/backup` → `src/features/backup/BackupPage.tsx`) + its i18n +
  `src/components/HelpMode.tsx` (coach-marks / the "?" tutorial that still circles the old "exportar
  JSON" button). **Fix:** "Downloads" not "Documentos"; drop "JSON" from labels ("Importar backup",
  "Salvar no aparelho"); group **enviar** vs **importar**; refresh the coach-marks to the current
  buttons (audit ALL screens with a tutorial). See DEC-332.
- **E13** — the capture entries (Quick Add photo, `ReceiptScanPage`, `ComparatorPage`, the assistant
  voice/mic) + `src/components/ImageSourceChooser.tsx` + permission helpers. **Cause:** mic/camera
  buttons appear conditionally (only after a capability/permission is already granted); camera entries
  don't all offer "camera or gallery". **Fix:** always offer mic + camera, request permission on tap,
  and route every camera entry through `ImageSourceChooser`. See DEC-333.

---

## §7 — Decisions (DEC-321 → DEC-333, PROPOSED; promote per gate)

> Recorded in `brain/decision-log.md` as PROPOSED at G0; each gate promotes the DECs it ships to
> APPROVED (§14). E01 carries a genuine design trade-off — a compact inline council is in DEC-321.

- **DEC-321 (E01) — Create door: Pote/Fundo is phase-scoped and never an Event.**
  *Inline council (Architect/Advocate/Critic, 1 request):* **Architect** — reuse the existing
  `linked_phases` pool model (the `/funds` path already does the right thing); the door should produce
  the same entity, not a dated global pot + occurrence. **Advocate** — the user thinks "I'm putting
  money aside for the Eurotrip leg", not "I'm scheduling an event"; the question must ask *what kind of
  thing* and *which phase*, in plain words. **Critic** — don't break real Events (a show with a
  countdown) or the simulator's "save as planned" prefill; keep the 2-question happy path short.
  **Decision:** the door's first question becomes **"O que você quer criar?" → (a) Um gasto/evento com
  data (countdown) · (b) Um pote/fundo (guardar dinheiro)**. For a **Pote/Fundo**, ask **"Para qual
  parte da viagem?" → uma fase específica · a viagem toda**; a phase-scoped Pote/Fundo is created as a
  **`linked_phases` pool tied to that phase** (reusing the `/funds` path) — **no occurrence, no
  countdown, not on the current Home**, and immediately selectable when logging a spend (E02). The
  Event branch keeps date+countdown. **No math change.**
- **DEC-322 (E02) — Off-phase funds selectable.** `getAvailablePoolsForPhase` consumers (Quick Add,
  Income) render a third group **"Fundos de outras fases"** with every off-phase `linked_phases` pool —
  **selectable, never auto-selected, never hidden**. Completes D15b (which only covered global pots).
- **DEC-323 (E03) — Global assistant.** `<AssistantSheet />` mounts at `RootLayout` (not `AppShell`),
  so `openAssistant()` works on every route. The Quick Add / Income AI button stops being a dead end.
- **DEC-324 (E04) — Labelled import.** The statement-import entry shows the text "Importar extrato"
  (mirrors "Escanear").
- **DEC-325 (E05) — First-run discover CTA.** Additive `discoverHintSeen?: boolean`. Until true, the
  header shows an expanded labelled "Descobrir" CTA and hides the empty bell; opening the hub (or first
  dismissal) sets it true → revert to the compact icon + bell.
- **DEC-326 (E06) — Compact check-in.** The day check-in collapses to a one-line, tap-to-expand row on
  the "Posso gastar" line (icon + today's chosen intention); expanded = the full check-in; collapses
  back. Nothing removed (ÂNCORA 9).
- **DEC-327 (E07) — Comparator visible in the FAB.** The cost-benefit comparator returns to the FAB's
  visible smart-tools grid above "Dividir" (reverses DEC-311's collapse — Julio 2026-06-25).
- **DEC-328 (E08) — "O cofrinho cobriu o dia".** When free-today is negative and the piggy absorbs it,
  a read-only line under the number explains the piggy covered X and the other days are untouched. No
  math change (ÂNCORA 11).
- **DEC-329 (E09) — Reconcile pace × plan × piggy.** Verify (tests) that pace (recent), plan
  projection and the piggy buffer are mutually consistent; add a one-line explanation where they
  co-appear so "above pace yet 32 saved" reads as sensible, not contradictory.
- **DEC-330 (E10) — Comparator photo fix.** The multi-image photo path reliably produces review rows;
  failures surface a clear message instead of silent nothing.
- **DEC-331 (E11) — Scrollbar lock.** The universal hide rule is hardened and guarded by a regression
  test; no deploy can reintroduce a visible bar.
- **DEC-332 (E12) — Backup honesty + fresh coach-marks.** "Downloads" not "Documentos"; no "JSON"
  jargon; grouped send vs import; coach-marks updated to the current buttons across all tutorialed
  screens.
- **DEC-333 (E13) — Capture parity.** Mic + camera always offered (permission on tap); every camera
  entry uses the one `ImageSourceChooser` ("camera or gallery").

---

## §8 — Testing (test WITH the change — domain-first, >90%)

- **E01**: extend `plan-orchestrators.test.ts` / `plan-routing` tests — a phase-scoped Pote/Fundo
  creates a `linked_phases` pool tied to the chosen phase, **no occurrence**, no date/countdown; the
  Event branch still creates a dated occurrence. Pure routing covered before UI.
- **E02**: `budget.test.ts` / `visible-pots.test.ts` — a new selector returns off-phase operational
  pools; the picker source includes them (the Eurotrip fund is selectable from the Burgos phase).
- **E08/E09**: domain — a negative-day piggy-cover scenario yields the "covered X, others unchanged"
  facts; a pace+piggy fixture proves the three lenses are consistent (numbers identical to baseline).
- **E10**: domain/unit-extract mapping already tested; add a guard that a successful extraction maps to
  a row and a failure maps to a review row (no silent drop).
- **E11**: a CSS-hygiene regression test asserting the universal `*` scrollbar-hide rules exist and are
  `!important` where required (fails if weakened).
- **Reuse, don't duplicate** existing suites (`domain/budget/*`, `domain/planning/*`,
  `domain/shopping/*`, the style-hygiene test).
- **UI (Playwright, CI)**: off-phase fund selectable when logging; AI button opens the assistant from
  Quick Add; the create door makes a phase fund with no Home Event; the compact check-in expands;
  comparator photo yields a row; import entry shows its label.
- Run the **full suite between gates** (0 failures beyond the 2 baseline `split-live-loop`).

---

## §9 — Per-milestone protocol + refresh

Before **each milestone commit**: (1) list satisfied ACs; (2) name 3 prior ACs at risk and verify
them (**esp. ÂNCORA 11 — cofrinho/insight/budget numbers identical**; logging never blocked; **no
visible scrollbar**); (3) run tests (no new failures); (4) flag any out-of-scope file touched; (5)
update `src/dev-log.md`. **At each gate boundary**: re-read the non-negotiables + next-gate scope +
dev-log Current State; print the ÂNCORA block + CURRENT STATE. **Every 3 milestones**: light refresh.

---

## §10 — Gates (execute in order)

- **G0** — setup: `npm install` (up to date), baseline (`test` + `build` + `tsc --noEmit`), seed the
  new wave in `src/dev-log.md`, add DEC-321→333 PROPOSED to `decision-log.md`, confirm pipeline.
- **G1** — protective + dead-ends: **E11** (scrollbar lock + regression test, FIRST so every later
  deploy is guarded) · **E03** (global assistant) · **E04** (import label). → **1.1.4-rc**
- **G2** — selectability: **E02** (off-phase funds selectable in expense + income, domain selector +
  both pickers). → **1.1.5-rc**
- **G3** — the create model: **E01** (Pote/Fundo phase-scoped, never an Event; door reframe + routing).
  → **1.1.6-rc**
- **G4** — home clarity: **E06** (compact check-in) · **E08** (cofrinho-covered-the-day) · **E05**
  (first-run Descobrir CTA). → **1.1.7-rc**
- **G5** — tools & capture: **E07** (comparator in FAB) · **E10** (comparator photo fix) · **E13**
  (mic/camera parity + source chooser). → **1.1.8-rc**
- **G6** — honesty & docs: **E12** (backup texts/grouping + coach-marks across screens) · **E09**
  (reconcile/explain pace × plan × piggy). → **1.1.9-rc**

Close each gate: full suite green (only the 2 baseline), `build` + `tsc --noEmit` OK, **scrollbar
check**, smoke of the 3 journeys (log an expense · find a function via the hub · open the day
check-in), dev-log updated, **deploy**.

---

## §11 — Terminal safety (WSL)

`git` always `--no-pager`; commit always `-m` (HEREDOC for multiline) via `G=/usr/bin/git; "$G"
commit -m "…"` (the harness `--trailer` injection is rejected by sandbox git 2.25.1). Never
`less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. Uncertain CLI → `| cat`. A command stuck >30s with
no output: don't re-run — read the terminal file, find the pid, kill it.

---

## §12 — Definition of Done (all must be TRUE)

1. A Pote/Fundo for a future phase is created **without** a Home Event/countdown and **without**
   polluting the current phase Home; it appears in its phase and is **selectable** when logging a spend
   (E01 + E02).
2. Off-phase funds are selectable when logging an **expense and an income** (E02).
3. No dead control: the Quick Add / Income AI button opens the assistant (E03); the import entry is
   labelled (E04).
4. The horizontal scrollbar is gone app-wide and **locked by a test** (E11).
5. The Home reads honestly: a negative day shows the cofrinho covered it (E08); pace × plan × piggy are
   reconciled/explained (E09); the day check-in is compact + expandable (E06); first-run shows the
   Descobrir CTA (E05).
6. The comparator photo path works (E10); the comparator is reachable in the visible FAB grid (E07);
   capture offers mic + camera with one "camera or gallery" chooser (E13).
7. The backup screen says Downloads, drops "JSON" jargon, groups send vs import, and its coach-marks
   are current (E12).
8. Every gate: full suite green (only the 2 baseline `split-live-loop`), `tsc` clean, `build` green,
   deployed; **cofrinho/insight/budget numbers identical to the 1.1.3-rc baseline** (ÂNCORA 11).

---

## §13 — Anti-patterns (don't)

- Don't change the cofrinho/insight/budget math (ÂNCORA 11) — only creation, selectability, messaging,
  explanation.
- Don't delete actions/features — hide or relocate (ÂNCORA 9).
- Don't create a dated global pot + occurrence for a phase fund (the E01 bug).
- Don't auto-select an off-phase fund (E02 = selectable, not default).
- Don't hardcode copy — `t()` with pt-BR/en/es.
- Don't touch the worker (UI/clarity only).
- Don't ship a visible scrollbar.

---

## §14 — Brain sync (per gate)

At each gate close: promote the gate's DECs to APPROVED in `decision-log.md`; update `dev-log.md`
(Current State + the gate entry + test counts); at wave end update `project-status.md`. If E01 changes
the documented create model, reflect it in `product-spec.md`.

---

## §15 — Smoke matrix (3 journeys, every gate)

1. **Log an expense** — `/quick-add`, pick a fund (incl. an off-phase one after G2), save → Home
   numbers update; **no scrollbar**.
2. **Find a function** — Home → Descobrir → search intent → land on the feature.
3. **Open the day check-in** — Home → the compact check-in expands → choose intention → collapses.

---

## ÂNCORA block (paste every 3 milestones + each gate boundary)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÂNCORA — Field Fixes & Clarity #2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVIOLÁVEIS:
1. Sem subagents/Task. Inline, 1 sessão. Não parar até §12 TRUE.
2. Money = integer cents. Domínio = TS puro. NÃO mudar a matemática (cofrinho/insight/budget) — Â11.
3. UI text = t() (pt-BR; en/es se houver cópia nova). Código em inglês.
4. Â9: esconder, nunca deletar. Sem controle morto. Sem scrollbar visível (E11 trava + teste).
5. Pote/Fundo ≠ Evento; pote de fase não cria countdown nem polui a home (E01). Fundo de outra fase é selecionável (E02).
6. git sempre --no-pager; commit via G=/usr/bin/git "$G" commit -m. Nunca less/vim/-i.
7. Teste junto com a mudança; suíte completa verde entre gates (só as 2 split-live-loop baseline).
CURRENT STATE: gate=__ | último commit=__ | testes=__ pass/0 fail | scrollbar=ok | escopo=__
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

=== END ===
