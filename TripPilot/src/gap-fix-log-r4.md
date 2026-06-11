# Gap-Fix Log — R4 Field Review (Julio's in-trip audio review)

- **Prompt**: `brain/documents/gap-fix-r4-implementation-prompt.md`
- **Note**: the previous file at this path (P2P sync round) was preserved as
  `src/gap-fix-log-r4-p2p-sync.md`. This round's decisions are DEC-114..123
  (D-R4-A..J — last DEC before this round was DEC-113, not DEC-102 as the
  prompt estimated).
- **Node**: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- **Active gate**: GATE 7 (PWA outing notification)
- **Progress**: 10/12 requirements
- **Tests**: 390 unit ✅ · 29 e2e ✅ · typecheck ✅ · build ✅
- **Build**: v0.6.0

## GATE 0 — Baseline + decision-log ✅
- [x] DEC-114..123 (D-R4-A..J) registered as APPROVED in decision-log.md
- [x] State file created (old P2P r4 log renamed, references updated)
- [x] Baseline confirmed: unit ✅ 343 · typecheck ✅ · build ✅ · e2e ✅ 29

## GATE 1 — Visual polish ✅
- [x] R-01 carousel alignment — `scroll-pl/pr-[var(--page-padding-x)]` on the counters
      carousel: rest position = initial render (first card aligned, 3 visible)
- [x] R-02 insights one-per-gesture — `snap-always` on insight slides (and counter cards)
- [x] R-03 chip label fit — chip labels wrap with `break-words hyphens-auto line-clamp-2`
      (QuickAdd + ExpenseDetail); `<html lang>` now follows the active language

## GATE 2 — Payer math (CRITICAL) ✅
- [x] R-04 `resolvePayerExpense` (domain/splitting) — single truth-table function used by
      QuickAdd, outing stepper and outing split. Row 4 fixed: "other paid, not split" =
      full personal cost + full debt (was: cost zeroed, no debt). Owner's own share born
      confirmed → debt appears in /shared immediately. `endOutingSession` no longer
      batch-assigns MY wallet to items paid by someone else (`isPaidByOwner`).
- [x] R-05 reconciliation verified over PERSONAL session total (calculateSessionTotal);
      composite test: own 20 + split (10→5) + other-paid (15) = personal 40; reported 50 →
      adjustment 10; debts to Ana (5+15=20) intact.
- [x] D-R4-J (DEC-123): "Quem pagou?" first-level in QuickAdd — Eu/outros; se outro:
      "Pagou tudo por mim" / "Dividimos" (split prefilled owner+payer); debt hints shown.
- New tests: payer-semantics.test.ts (8) + end-outing-session wallet protection (1).

## GATE 3 — Occasions = sessions ✅
- [x] R-06 `countProfileOccasions` (forecasting) — sessions count once, standalone = 1 each;
      `calculateOccasionForecasts` uses it → dashboard counters, Amigo Sincero (doneQuantity),
      ImpactDetail and Simulator all corrected centrally. New honest-friend kind `over_plan`
      (done > planned ≠ "dentro do plano") + copy ×3. Tests: 9+8+3 items + 2 avulsos = 5.

## GATE 4 — Simulator v3 ✅
- [x] R-07 contextual simulator (DEC-116) — new domain module
      `forecasting/contextual-simulation.ts`: `simulateContextualSpend` asks WHERE
      (profile / event / other) and returns structured FACTS + verdict WITH reason.
      Profile with plan → "consome ≈N das M ocasiões"; plan used up → over_plan;
      event → compares `reservedCents` (covers / short by €X / no reserve);
      no plan → free margin + daily allowance ("≈N dias do seu livre diário").
      SimulatorPage rewritten: amount → "Onde você vai gastar?" chips (enabled
      profiles + unconfirmed phase events + "outro") → verdict card with reason
      sentence + fact cards. Old metric_*/math_* raw-equation keys REMOVED
      (the "10 ÷ 2 ≈ 5× transporte" / "0 dias" displays are gone); 28 new
      simulator keys ×3 (parity 770 keys ✅). CTA register passes profile category.
      `simulateSpendMultiMetric` kept in domain (tested) but no longer used by UI.
- New tests: contextual-simulation.test.ts (10) — with plan (1 occasion ok /
      2.2 attention / whole-plan risk / over_plan), without plan (free + field
      scenario €20 vs €5.24/day ≈ 3.8 days), event (covers / short / no reserve),
      large values (exceeds_free wins even with plan target; large_share 60%).

## GATE 5 — Honest outing limits ✅
- [x] R-08 (DEC-117) `getOutingZone` domain function — zones change AT the target:
      under_target (success) / over_target (warning) / over_ceiling (error) /
      over_max (strong error). Status line per zone: "Você passou da meta em €X —
      isso sai de outras coisas do plano" / "€X acima do teto — comprometendo o
      orçamento da fase" / "€X acima do máximo". "Ainda pode gastar com
      tranquilidade: €0" eliminado (só aparece abaixo da meta, junto com
      "≈N bebidas cabem NA META"). "TETO SEGURO" → "TETO" ×3. Next-drink hint via
      `getNextDrinkMessageKind`: fits_target (convite só DENTRO da meta) /
      crosses_target / over_target ("aumenta o que você está tirando de outras
      coisas"). Alertas progressivos (DEC-048) re-ancorados nas zonas: 50% da
      meta / cruzou meta (warning) / cruzou teto (danger) / máximo (critical),
      ids estáveis 50/100/150/200 em firedAlertPercents; copy ×3 tons ×3 línguas.
      Dashboard: card de saída ativa usa total PESSOAL (calculateSessionTotal,
      coerência R-04) e "bebidas até a META" (era teto).
- New tests: outing.test.ts reescrito p/ zonas (6 alerts + 4 zone + 3 next-drink).

## GATE 6 — Long-press ✅
- [x] R-09 (DEC-118) multi-select in lists — new `useLongPress` hook (pointer events,
      500ms, move-cancel, synthetic-click suppression via onClickCapture) +
      `useMultiSelect` built on top. ExpenseListPage: long-press enters selection
      mode (tab "Gastos" e "Saídas"), tap toggles, `SelectionBar` fixed at bottom.
      Batch actions via new `batch-orchestrators.ts` (Dexie tx, soft delete):
      delete / move pool / change category (expenses); delete with cascade
      items+txs+shares (outings). Confirm sheets + toasts; selection cleared on
      tab change.
- [x] R-10 (DEC-119) configurable dashboard — `domain/dashboard/dashboard-cards.ts`
      catalog: 9 cards, anchors fixed (active_outing, hero), 7 movable with
      quickAction. AppSettings + `hiddenDashboardCards`/`dashboardCardOrder`
      (repo backfills old records). DashboardPage renders by resolved sequence;
      long-press on a card → sheet (quick action / hide / configure home);
      hidden cards → thin "N cards ocultos" entry. New page
      /settings/dashboard (DashboardConfigPage): reorder ↑↓ + show/hide,
      locked anchors marked. Settings entry "Personalizar" added. i18n ×3
      (selection.* + dashboard.* novos, parity ✅).
- New tests: dashboard-cards.test.ts (9) + batch-orchestrators.test.ts (4).

## GATE 7 — PWA outing notification
- [ ] R-11 persistent notification with quick-add actions (research + best effort)

## GATE 8 — Help mode
- [ ] R-12 contextual "?" with annotated screens (Funds, Planner, Wallets, Phase/Events, Outing, Backup)

## GATE 9 — Brain + final verification + deploy
- [ ] Brain updated (decision-log, product-spec, project-status)
- [ ] Version bump minor → 0.7.0
- [ ] Full validation: unit + typecheck + build + e2e
- [ ] R-01..R-12 "DONE quando" table confirmed in code
- [ ] 6 review smokes
- [ ] Deploy + URL

## Extras found (not fixed)

- (none yet)
