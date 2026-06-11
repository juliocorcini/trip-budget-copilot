# Gap-Fix Log — R6 (audit bugs + field test fixes)

- **Prompt**: `brain/documents/r6-full-fix-prompt.md`
- **Baseline (Gate 0)**: 317 unit ✅ · typecheck ✅ · build ✅ · 29 E2E ✅ (v0.5.1)
- **Nota node**: wrangler/playwright exigem Node 22 → `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- Active gate: G7 (housekeeping + deploy)
- Last milestone: G6 complete (R6-19..22)
- Tests: 343 unit / 29 e2e
- Build: OK (typecheck clean)
- Risks: date projection now local everywhere — watch DashboardPage day card (already local via GAP-R2-007)

## Gates

- [x] G0 — Setup + baseline
- [x] G1 — Domain bugs (R6-01..05: BUG-001..004, PAR-006)
- [x] G2 — P2P sync reliability (R6-06..07)
- [x] G3 — QR scanner camera switch + zoom (R6-08..10)
- [x] G4 — UI polish: carousel, gauge, iOS banner, keyboard (R6-11..14)
- [x] G5 — Locale formatting (R6-15..18)
- [x] G6 — Simulator v3 + learning prior (R6-19..22)
- [ ] G7 — Housekeeping + validation + deploy (R6-23..25)

## Milestones

### G6 — Simulator v3 + learning prior (R6-19..22)

- **R6-19 (R-12)**: each metric card shows the derivation in one line (`math` prop):
  total "free − amount = after", daily "amount ÷ daily/day ≈ N days" (locale-formatted),
  plan "amount ÷ typical ≈ N× profile" (top impact) — all from `simulateSpendMultiMetric`
  outputs, no new domain logic.
- **R6-20**: quick value chips €5/€10/€20 below the amount input (free field preserved).
- **R6-21**: post-verdict CTAs — "Registrar esse gasto" (→ `/quick-add?amount=`; QuickAddPage
  now pre-fills from the param) and "Ver no planner" (→ `/planner`).
  *Deferred to R7 (product decision needed): per-category simulation weighting when the
  category plan is already blown.*
- **R6-22 (PAR-003a)**: `ESTIMATE_PRIOR_WEIGHT = 3` in `updateProfileFromTransaction` —
  preset counts as 3 virtual data points; typical 1500 + first datum 9000 → 3375 (test added).
- i18n: `simulator.math_total/math_daily/math_plan/cta_register/cta_planner` ×3 (754/754/754).
- 343 unit ✅, typecheck ✅, build ✅. Regression named: forecasting averaging tests (range
  assertions still hold), DEC-094 multi-metric verdicts (unchanged), QuickAdd `?cat=` prefill.

### G5 — Locale formatting (R6-15..18)

- **R6-15 (PAR-001)**: new `domain/locale` bridge (`setActiveLanguage` + date-fns locale +
  data-driven pattern map pt→en); `formatDate`/`formatShortDate` translate the pt reference
  patterns ("d 'de' MMMM" → "MMMM d", dd/MM → MM/dd) and use the active date-fns locale.
  i18n `languageChanged` wired to the bridge in `i18n/index.ts`.
- **R6-16 (PAR-002)**: `formatMoney` default locale comes from the bridge (88 call sites
  unchanged); Dashboard `splitMoneyDisplay` decimal separator per language.
- **R6-17 (PAR-004)**: `createOnboardingEntities` receives `poolName`/`reserveName` translated
  from the UI; "Fundo X"/"Reserva protegida"/"Eu" hardcodes removed from onboarding path.
- **R6-18 (PAR-005)**: `wallets.type_*` keys (5 types × 3 languages); creation now offers
  credit_card and other; list shows the translated type.
- Tests: +5 (`active-locale.test.ts`). 342 unit ✅, typecheck ✅, build ✅, parity 749/749/749.
- Regression named: money tests (explicit locale arg unaffected), dates tests (pt-BR default
  preserved), onboarding flow (names now passed by caller).

### G4 — UI polish (R6-11..14)

- **R6-11 (R-02)**: Dashboard carousel cards now `w-[calc((100%-1.5rem)/3)]` — exactly 3 per
  page, snap aligns with edges; `COUNTER_ACCENTS` restores per-category icon colors
  (mediterranean palette) instead of fixed terracotta.
- **R6-12 (R5-09)**: Outing gauge labels absolutely anchored at the real segment boundaries
  (`GAUGE_TARGET_END` ≈43%, `GAUGE_CEILING_END` ≈71%, max 86%, clamped at edges) + colored
  tick marks on the bar at each boundary. Constants exported from `domain/outing`.
- **R6-13 (R5-03)**: honest iOS persistence story — `utils/platform.ts`
  (`isIosDevice`/`isStandaloneDisplayMode`). Dashboard banner: hidden on installed iOS PWA,
  install-to-home-screen guidance on iOS Safari, unchanged elsewhere. Settings: iOS shows
  guidance text instead of the impossible "Enable" button.
- **R6-14 (R5-04)**: `useKeyboardInset` forces `window.scrollTo(0, 0)` when the inset
  returns to 0 and on `focusout` (250ms, skips focus moving to another field).
- i18n: `dashboard.storage_install_ios`, `settings.storage_ios_hint`,
  `settings.storage_ios_installed` in pt-BR/en/es (parity 741/741/741).
- 337 unit ✅, typecheck ✅, build ✅. Regression named: R3 carousel snap behavior,
  R5 gauge math (`buildOutingGauge` untouched — UI only), R5-02 keyboard inset spacer.

### G3 — QR scanner camera switch + zoom (R6-08..10)

- **R6-08 (P2P-06)**: QrScanner enumerates video inputs after permission, shows a
  switch-camera button (cycles devices), remembers the last used camera in localStorage
  and recovers from a stale id (OverconstrainedError → environment default).
- **R6-09**: zoom chips (1×/2×/3× clamped to track capabilities) via applyConstraints;
  hidden when the lens does not support zoom.
- **R6-10 (P2P-07)**: denied/unavailable error states preserved (verified path).
- i18n: `sync.switch_camera` added to pt-BR/en/es. 337 unit ✅, typecheck ✅.

### G2 — P2P sync reliability (R6-06..07)

- **R6-06 (P2P-09/12/13 "sender always errors")**: `runSender` now consumes the receiver's
  hello symmetrically (tolerant 15s expect). Previously the orphan hello was dequeued by
  `expect('ack')` → protocol_error → error screen on every successful send; same defect
  broke `waitForResponses` on the owner side.
- **R6-07 (P2P-09 "first attempt fails")**: `createMessageBuffer` in `data/sync/channel.ts`;
  `wrapDataChannel` (webrtc/manual) and `createRelayChannel` (relay) buffer frames until
  `setMessageHandler` attaches — no more silent drops in the open-to-listen window.
- Tests: +3 (`sync-reliability.test.ts`) — buffer ordering, first-attempt race simulation,
  full statement round-trip (hello × 2 → payload → ack → responses → ack). 337 unit ✅.
- Regression named: R4 channel kinds untouched (webrtc/relay/manual), sync-session tests
  still green, crypto/signaling untouched.

### G1 — Domain bugs (R6-01..05)

- **R6-01 (BUG-001)**: added `localDayOf`/`localClockTime`/`moveToLocalDay` to `domain/dates`;
  used in `calculateSpentOnDate`, `sumSpentInOccurrenceInterval`, `buildNoSpendStreak`, CSV
  date/time columns, ExpenseList/Detail/OutingReview/ImpactDetail displays and date editing.
  Stored timestamps stay UTC; only the day projection changed (no data migration).
- **R6-02 (BUG-002)**: `findActivePhase` compares local day strings (end date inclusive);
  QuickAdd/Wallets/Simulator switched from `findActivePhase ?? phases[0]` to `resolveActivePhase`.
- **R6-03 (BUG-003)**: `calculateDebts` allocates against mutable remaining credits.
- **R6-04 (BUG-004)**: shared-expense edit uses `calculateOwnerPersonalCost` (DEC-071).
- **R6-05 (PAR-006)**: rhythm cursor uses local day instead of `toISOString()`.
- Tests: +17 (`r6-gate1-fixes.test.ts`), csv-export test updated to local time expectation.
  334 unit ✅, typecheck ✅. Regression check: DEC-088 free-today (U), R-25 statement (U),
  GAP-027 retroactive (covered by moveToLocalDay test).
