# TripPilot — Project Status

> Last updated: 2026-06-15 (v0.40.0 — Wise CSV statement import: turn each card purchase into an expense with category/city/phase guessed, cross-source dedupe via `externalRef`, editable review + undo. Caps the native-Android arc v0.28.0→v0.40.0: Capacitor shell + safe-areas + back-button + haptics + permissions, app-wide motion system, the post-animation regression fixes, the active-outing height + FAB redesign, and the rich active-outing notification with no-open quick-add buttons.)

## Current Phase

**Implementation — D1–D5 + gap-fix R1..R3 + P2P sync R4 + reliability R5 + full-fix R6 + field review R4 + field feedback fixes + brainstorm features v0.8.0/v0.8.1 + stability hardening v0.8.2 + Feature Expansion Package 1 v0.8.3→v0.10.1 (Phases 1 & 2) + Feature Expansion Package 2 v0.10.2→v0.12.1 (Phases 3 & 4) + Feature Expansion Package 3 v0.12.2→v0.14.1 (Phases 5 & 6) + UX Polish Pass v0.14.2→v0.14.5 + UX Feedback & Continuity Pass R2 v0.14.6→v0.14.10 deployed** ✅ — **V1 EXPANDED COMPLETE** (Fase 7 = V2)

### Field Feedback Round 2 (v0.50.0 → …) — 2026-06-16 — 🚧 IN PROGRESS
- **Mandate** (Julio): a 22-item field list (round 2). Plan `brain/documents/improvements-master-plan-2026-06-16-round2.md`; council ran inline; decisions locked via AskQuestion. Order **F→A→B→C→D→E** (native first). Per-wave detail in `src/dev-log.md`.
- **Shipped (native APK, 0.50.0 — Wave F)**: **F12** QR camera permission (manifest `CAMERA`; Capacitor 8 already requests the runtime grant), **F1** backup → public Downloads (native `DeviceFile` plugin via `MediaStore.Downloads`, fallback Documents), **F13** no overscroll stretch (WebView `OVER_SCROLL_NEVER`). APK versionCode **16** / 0.50.0 (8.26 MB). `requiredNativeVersion` 0.50.0. See DEC-205.
- **🚧 PIVOT (2026-06-16)**: Waves A–E **PAUSED**. New top-priority epic = **Receipt OCR/AI → items → split** (DEC-206 + addendum). After Julio's constraints (app NOT on Play Store; iOS users are web-only), the plan went **CLOUD-FIRST**: **G1 ✅ shipped (0.51.0, OTA)** attach photos to any expense (schema v8 `attachments`, device-local, never in backup) → **G2** cloud extraction (Groq via Worker `/ocr`) → review/split → Outing (universal iOS+web+Android, OTA) → **G3** on-device OCR (ML Kit **bundled** = no Play Services/Store + tesseract.js web; private/offline default; needs APK) → **G4** polish. Research/spec `brain/documents/receipt-ocr-item-split-research-2026-06-16.md`.
- **Next waves (PAUSED, resume after receipt epic — web, OTA to the 0.50.0 APK)**: A (UX quick wins + interactive drag F10), B (phase calendar maps + per-day math F4/F20/F22), C (settings Samsung-style F11 + connection hub + link pairing F19), D (future-phase income F17 + phase preview F18), E (smart Wise import F16 + create-phase + CSV share-target F15).
- **Quality**: 1046 unit tests green (118 files; +8 image-compress); tsc 0; web build clean (**Node 22 required**). G1 shipped OTA — no APK rebuild (the 0.50.0 APK runs the 0.51.0 bundle).
- **Build env note**: this machine defaults to Node v18 (no `globalThis.crypto.subtle` → 6 ecies tests fail); run tests/build/cap/gradle under Node 22 (`nvm`).

### Field Feedback Round (v0.41.0 → v0.49.0) — 2026-06-16 — ✅ ALL 20 ITEMS LANDED
- **Mandate** (Julio): a 20-item field list after the native+Wise arc. Plan `brain/documents/improvements-master-plan-2026-06-16.md`; gates G1→G8. Detail per gate lives in `src/dev-log.md`.
- **Shipped (web)**: G1 navigation/swipe/scroll/recents (0.41), G2 home numbers — true-free + check-in lens (0.42–0.43), G3 Wise import visibility + TRANSFER intelligence/split (0.43–0.44), FIELD-19 per-day allowance map (0.45), G4 settings overhaul + savings goal on card + 2-up grid (0.46), G5 P2P encrypted mailbox (0.47), G6 reset-app (item 3) + G8a version awareness (item 20) (0.48).
- **Shipped (one native APK, 0.49)**: **G6 native backup share/save** (`@capacitor/share`+`@capacitor/filesystem`, items 6/7), **G7** active-outing notif-value→screen (item 10, native `quickAdd` event) + zoom/shake (item 11, `--native-zoom` height), **G8b live-update** (`@capgo/capacitor-updater` self-hosted; OTA bundle + manifest on Pages; cold-start apply, gated by `requiredNativeVersion`). APK versionCode **15** / 0.49.0 (8.2 MB). See DEC-204.
- **Quality**: 1038 unit tests green (117 files); tsc 0; web build + `cap sync` (8 plugins) + `assembleDebug` all green.
- **OTA from here**: web-only releases ship over the internet to APK ≥0.49 (bump version → `npm run build` → `cap sync` → `node scripts/make-ota-bundle.mjs` → deploy `--branch=master`); only native changes need a new APK (+`requiredNativeVersion`/versionCode).
- **Device-pending ACs** (need a physical Android): native share sheet + save-to-Documents, notif quick-add live reflection, no outing zoom/shake, Capgo download/apply on the next web-only release.
- **⚠️ Deploy topology (since 0.48)**: the Pages PRODUCTION branch is **`master`** (apex `trippilot.pages.dev`); CLI deploys to `--branch=main` are **Preview** (`main.trippilot.pages.dev`). Deploy production with **`--branch=master`** (apex serves the current bundle + `/version.json` + `/bundles/<v>.zip` + `/trippilot.apk`). See DEC-203.

### Native Android arc + Wise import (v0.28.0 → v0.40.0) — 2026-06-15 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): make the web PWA a real Android app for the Play Store, with first-class native touches (widgets, Spotify/Samsung-Now-Bar-style notifications), then a fluid/professional motion layer, then fix the regressions it introduced, and finally import the real Wise card statements as expenses. Delivered gate-by-gate (commit → deploy → APK) per the team workflow.
- **Native shell (v0.28.0→v0.35.0)**: Capacitor 8 Android wrapper; CSS-driven safe-areas (`--safe-top/--safe-bottom`, opaque status band, light/dark icons); hardware back-button stack; softened haptics; runtime GPS + notification permission flows; persistent storage; DPI/zoom pass. Native Live Update (Android 16 `ProgressStyle`) + a rich fallback path. Crash fix: `LocalNotifications.then()` (plugin proxy made non-thenable).
- **Motion system (v0.36.0, DEC-194)**: CSS-first page transitions (transform/opacity only, M3 curves, global `prefers-reduced-motion`), staggered lists, FAB/sheet/toast/nav/money micro-interactions; FAB shortcut overlap fixed.
- **Post-animation fixes (v0.37.0→v0.39.0, DEC-195…199/201)**: detail sheets back at the viewport bottom (portal + `transform:none` rest); first-entry transition (RouteView inside Suspense); bidirectional swipe with directional slide (Expenses + Viagem); active-outing fits one screen; FAB speed-dial redesign; active-outing notification with quick-add **value buttons that log without opening the app** (native `OutingNotifier` plugin + broadcast receiver + queue reconciliation) and a rich fallback.
- **Wise import (v0.40.0, DEC-200)**: `/import/wise` — pick the .csv files, the app parses (RFC4180, locale-robust amounts), dedupes cross-file by `TransferWise ID`, guesses category/city, assigns phase by date, flags already-imported / possible-manual-dup, and commits atomically with undo. Additive `Transaction.externalRef` (no migration). i18n ×3.
- **Quality**: 968 unit tests green (110 files; +24 import tests against the 3 real statements); tsc -b 0; web build + cap sync + `assembleDebug` all green; APK `Downloads/TripPilot-0.40.0-debug.apk` (versionCode 14).
- **Deploy**: every gate to **Production** via `--branch=main` → `trippilot.pages.dev` (latest `main.trippilot.pages.dev`), 0.29.0 → 0.40.0 live.
- **Device-pending** (by design, needs a physical Android): Android 16 Live Update promotion visuals + the One UI 7 no-open notification tap-to-log; motion feel on the S23.

### Planned Purchases — earmark known future buys (v0.17.0, DEC-175) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): "vou fazer uma compra que sei que preciso… colocar como algo que já vai sair do orçamento para ver o que realmente posso gastar" — creams across pharmacy/Primor/Druni, clothes "at some point". No clean home existed; the user was confused as a user. Chose direction `lista_earmark`, scope "função madura, completa".
- **What shipped**: a new `PlannedPurchase` entity (Dexie **V6**, backup **V6**) with two modes via one toggle — **Reserve ON** subtracts the estimate from free-to-spend now (new `plannedPurchasesCents` term + FTS breakdown line; reserve shrinks by real linked spend, no double count) and **Track only** records the intention without touching FTS. **"Comprei"** logs a real expense (standard expense/payer path), links it, optionally closes — with **undo**; multi-store is first-class (tap per store, keep open, reserve draws down). Surfaces: `/planned` page (list, add/edit, progress, `estimated − spent = remaining` breakdown, Done bucket), dashboard card `planned_purchases` (hidden when empty), FAB "Plan a purchase", More-menu entry, 5-topic help screen, and a **simulator target** reusing the event-reserve mechanic & copy (no new verdict/fact kinds).
- **Reuse, not reinvention**: FTS deduction (event reserves DEC-072), `Breakdown` (DEC-172), `EmptyState` (DEC-171), expense orchestration. **Cut**: a redundant QuickAdd-prefill route for "Comprei" (the in-page sheet is fewer taps and already links+closes); retroactive linking of arbitrary pre-existing expenses deferred.
- **Quality**: 898 unit tests green (+ planned-purchases domain/orchestrator/FTS/simulator suites); tsc 0; build OK (PlannedPurchasesPage chunk 17 kB). i18n ×3 for every string.
- **Deploy**: shipped to **Production** via `--branch=main` → `trippilot.pages.dev` as 0.17.0 (SW cache `trippilot-v34`).

### Stability hardening + UX Gates V–Y (v0.15.0 / v0.16.0) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **v0.15.0 (DEC-170)**: permanent mitigation for the critical "Não foi possível carregar seus dados" lockup (WebKit/Safari IndexedDB stalls) — layered self-healing (watchdog timeouts, background reconnect, internal restart, working retry/reload, emergency backup) so the user never hits a dead-end recovery screen.
- **v0.16.0 (DEC-171/172/173/174 — Gates V·W·X·Y)**: interaction feedback with undo (edit/delete expense, outing rounds, wallet reconcile); spread the "where this number comes from" breakdown (funds, planner margin); friendly first-use empty states (`EmptyState`); deepened active-outing + end-of-outing recap. app-lock crypto test pinned to the node env.

### UX Feedback & Continuity Pass (Round 2, Gates A–E) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): "quero sentir que tudo que faço tem motivo e resultado — visual, explicado, sentido"; fix the page that "reloads and jumps to top" on in-page taps (e.g. the new collapse button); give the daily check-in a real, visible function ("mexo nele e não vejo nada mudando"). Informed by a 4-role council brainstorm (Visionary/Analyst/Connector/Simplifier) that converged on the same root causes. Full state file: `src/ux-polish-log.md` (RODADA 2).
- **Gate A (continuity, app-wide)** v0.14.6: `useAppData.reload()` always flipped `loading=true`, so every in-page mutation remounted the page tree at the top (scroll jump + "reloaded" feeling). Split into `runLoad({showLoading})`: only the first load + explicit recovery show the loader; every in-page reload is now SILENT → component tree stays mounted, scroll preserved. One fix, whole app. (Playwright `ux-scroll.mjs`: scroll 1203→1203, no loader flash.)
- **Gate B (check-in result)** v0.14.7: the check-in only highlighted a button (dead toggle). Added a read-only framing line (`getCheckInFraming`) that reframes the day's real `freeTodayCents` by intent (calm/outing/night) — never changes the budget (ÂNCORA 12). +CSS `checkin-reveal`.
- **Gate C (invisible money actions)** v0.14.8: value-suggestion accept + phase-leftover move now fire contextual confirmation toasts (amount + destination).
- **Gate D (the #1 action)** v0.14.9: saving an expense was SILENT (`QuickAddPage` was the only mutating page with no `showToast`). Now a success toast "<amount> registered" WITH undo (reuses DEC-126 `softDeleteTransactionsBatch`; `registerExpense` only inserts so the undo is symmetric); the dashboard already shows the new "free today" in place (Gate A).
- **Gate E (consistency + instant)** v0.14.10: transfers/withdrawals confirm too; the check-in is now OPTIMISTIC (framing shows on tap, reconciles after persist). A consistency sweep confirmed nearly all other mutating pages already had toasts — the broad "várias partes na mesma forma" was the scroll/reload (Gate A).
- **Deliberately NOT done** (over-engineering / honesty risk): animated hero count-up (shows transient false values on the most important number + the navigation remount breaks its main trigger), tone-engine per intent, scroll-restoration library.
- **Quality**: 820 unit tests green (+1 check-in framing vs UX Polish's 819); tsc 0; lint 0; build no chunk >500KB; i18n ×3 for every string.
- **Deploy**: EVERY gate shipped to **Production** via `--branch=main` → `trippilot.pages.dev`: 0.14.6 (SW v16), 0.14.7 (v17), 0.14.8 (v18), 0.14.9 (v19), 0.14.10 (v20). Latest production deploy: https://b5383138.trippilot.pages.dev

### UX Polish Pass (Gates 0–7) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate**: reorganize for clarity/density/hierarchy — **ZERO functionality removed**, design system untouched, protected zone (insights carousel DEC-077/091/150 + occasion counters DEC-076) preserved. Visual loop: Playwright mobile screenshots BEFORE/AFTER per change (`src/ux-polish-log.md` is the full state file with the BEFORE×AFTER table).
- **Gate 2 (Dashboard)** v0.14.2 (DEC-162): consolidated the two data-safety banners to one-at-a-time; reordered cards (actionable on top); grouped the 3 read-only analytics into one collapsible "Trip analytics" drawer (collapsed by default, persisted in `AppSettings.collapsedDashboardCards`, no migration).
- **Gate 3 (Capture)** v0.14.3 (DEC-163): QuickAdd Cancel/Save pinned to a sticky bottom bar (no scroll to save). Active outing / `/outings/new` / expense-list density reviewed, left as-is.
- **Gate 4 (Planning/finance)**: planner, simulator, funds, wallets reviewed — already clean, NO change (no bump).
- **Gate 5 (Secondary)** v0.14.4 (DEC-164): Settings flat list grouped into 7 labeled sections (order preserved). Backup/Shared/About/More/Dashboard-config already consistent, left as-is.
- **Gate 6 (Navigation)** v0.14.5 (DEC-165): unified the back-button + title style of the 2 outliers (Notifications, ImpactDetail) to the 16-page majority (sticky preserved). Bottom nav, padding token, empty states audited — already consistent.
- **Gate 7 (Verification)**: final screenshot pass over all 21 routes (no screen worse than Gate 1 baseline); 9/9 interaction smoke checks green (analytics collapse persists across reload; bottom nav reaches every tab; simple↔complete toggles advanced surfaces); mock lives only in the ephemeral Playwright IndexedDB — never in the build/deploy.
- **Quality**: 819 unit tests green (+5 dashboard-collapse helpers vs Package 3's 814); tsc 0; build no chunk >500KB; i18n ×3 for every new string.
- **Deploy**: EVERY gate with code shipped to **Production** via `--branch=main` → `trippilot.pages.dev`: 0.14.2 (SW v12), 0.14.3 (v13), 0.14.4 (v14), 0.14.5 (v15). Latest production deploy: https://65c3082b.trippilot.pages.dev

### Feature Expansion Package 3 (Phases 5 & 6) — 2026-06-13 ✅ SHIPPED TO PRODUCTION
- **Phase 5 (location & time + multi-currency)** v0.12.2→v0.13.0: opt-in on-device location + sticky place + nearby reverse-geocode (online) + offline recents + manual name + time/place on list/detail + spend-by-place (DEC-157); multi-currency expenses (original preserved + base-currency budget), currency-aware wallet debit, opt-in frozen FX snapshot (DEC-158).
- **Phase 6 (data security & sharing + Share Target)** v0.13.1→v0.14.0: local daily snapshots + restore-to-yesterday — the package's ONE Dexie migration v4→v5 `localSnapshots` (DEC-159); vault via share sheet + read-only self-contained HTML trip report (DEC-160); opt-in PIN app lock (PBKDF2/Web Crypto, off by default, recovery never trapped; biometrics deferred) + Web Share Target pre-fill (DEC-161).
- **Quality**: 814 unit tests green (+106 vs Package 2 baseline of 708); tsc 0; build no chunk >500KB. ÂNCORA invariants held: location is opt-in/on-device, original currency preserved, budget routed through base, the lock never traps recovery, Share Target only pre-fills.
- **Deploy**: EVERY gate shipped to **Production** via `--branch=main` → `trippilot.pages.dev` (per Julio's request): 0.12.2, 0.12.3, 0.13.0, 0.13.1, 0.13.2, 0.14.0, 0.14.1.

### Feature Expansion Package 2 (Phases 3 & 4) — 2026-06-13 ✅ SHIPPED TO PRODUCTION
- **Phase 3 (insights v2 + check-in + phase cycle)** v0.10.2→v0.11.0: insights uncapped + priority-ordered + auto-rotation (DEC-150); calibrated builders category-rhythm/dangerous-day/end-of-day, anti-spam (DEC-151); daily check-in card + responsive notification (DEC-152); phase leftover sheet + atomic move (preserves total) + countdown (DEC-153).
- **Phase 4 (motivation + continuity)** v0.11.1→v0.12.0: savings goal + piggy bank (read-only, never touch free-to-spend — DEC-154); in-trip occasion-average value suggestion, accept-only (DEC-155); end-of-trip priors + save/apply trip templates (DEC-156).
- **Quality**: 708 unit tests green (+94 vs Package 1 baseline of 614); tsc 0; build no chunk >500KB. All ÂNCORA invariants proven by tests (free-to-spend untouched by goal/piggy; learning never auto-writes; templates mint new ids).
- **Deploy**: Phase 4 (v0.12.0) + final (v0.12.1) shipped to **Production** via `--branch=main` → `trippilot.pages.dev`; intermediate gates (0.10.2→0.11.2) were Preview (`master.trippilot.pages.dev`).

## Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Project structure | ✅ DONE | Cursor workspace with Director + Febracorp methodology |
| Product spec | ✅ DONE | Full MVP specification + R2 features (events, rhythm, per-phase activities) |
| Technical direction | ✅ DONE | Stack locked: React/TS/Vite/Dexie/Cloudflare + Router v7 + i18next |
| Competitive analysis | ✅ DONE | TravelSpend gap analysis, positioning defined |
| Decision log | ✅ DONE | 165 decisions (DEC-001 to DEC-165); DEC-063 superseded by DEC-071; DEC-162..165 = UX Polish Pass |
| Implementation phases | ✅ DONE | 6 deliveries defined (~50h Tier 3) + Feature Expansion Phases 1–6 (V1 expanded complete) |
| Data model | ✅ DONE | 24 entities + `localSnapshots` (device-local restore points); Dexie schema **v5** (peerLinks, mirroredStatements, linkedActorId, localSnapshots); backup **v5** (location fields); non-indexed expense location + multi-currency (`baseCurrencyAmountCents`/`exchangeRate`) + app-lock fields |
| Domain rules | ✅ DONE | Forecasting, three-limit system, learning, rhythm weighting, event reserves, insights |
| Design system | ✅ DONE | Theme v4; BottomSheet/Toast primitives; zero native dialogs; zero hardcoded colors (tokens only) |
| Implementation D1–D6 | ✅ DONE | All deliveries implemented and deployed to Cloudflare Pages |
| Gap analysis R1 2026-06-09 | ✅ RESOLVED | 36/36 gaps fixed (see `src/gap-fix-log.md`) |
| Gap analysis R2 2026-06-09 | ✅ RESOLVED | 23/23 items fixed: 7 field bugs + 9 R2 gaps + 7 planning features (see `src/gap-fix-log-r2.md`) |
| Field review R3 2026-06-10 | ✅ RESOLVED | 26/26 requirements implemented in 7 gates (see `src/gap-fix-log-r3.md`) |
| P2P sync R4 2026-06-10 | ✅ DONE | 14/14 requirements in 7 gates (see `src/gap-fix-log-r4-p2p-sync.md`); DEC-103..108 |
| Reliability R5 2026-06-10 | ✅ DONE | 9/9 requirements in 4 gates (see `src/gap-fix-log-r5.md`); DEC-109..113 |
| Full-fix R6 2026-06-10 | ✅ DONE | 25/25 items in 7 gates: 4 audit bugs + 6 partials + 8 field-test findings + simulator v3 (see `src/gap-fix-log-r6.md`) |
| Field review R4 2026-06-11 | ✅ DONE | 12/12 requirements in 10 gates: payer truth table, occasions=sessions, simulator v3 contextual, outing zones, multi-select, configurable dashboard, PWA notification, help mode (see `src/gap-fix-log-r4.md`); DEC-114..123 |
| Brainstorm features 2026-06-12 | ✅ DONE | 9/9 features (F1–F9): bar mode + wake lock, universal undo, PWA shortcuts, mental anchor, burndown card, heatmap card, recap card, rescue mode, share card; DEC-126..134 |
| i18n | ✅ DONE | pt-BR + en + es complete and synchronized (recovery/restore/PWA-update keys added in v0.8.2) |
| Tests | ✅ DONE | 820 unit tests + 29 Playwright e2e, all green (+110 in Package 1; +94 in Package 2; +106 in Package 3; +5 UX Polish dashboard-collapse helpers; +1 check-in framing R2) |
| Deploy | ✅ DONE | v0.14.5 on Cloudflare Pages + `trippilot-sync` Worker; SW network-first + update toast (CACHE_NAME v15). IMPORTANT: production branch is `main` — deploy with `--branch=main` to update `trippilot.pages.dev`; plain `master` lands as Preview (alias `master.trippilot.pages.dev`). Package 3 (0.12.2→0.14.1) + UX Polish Pass (0.14.2→0.14.5) all shipped to Production via `--branch=main` |
| Repository | ✅ DONE | GitHub `juliocorcini/trip-budget-copilot` (ssh) |

## Gap-Fix Session R2 (2026-06-09)

All 23 items from `documents/gap-analysis-r2-2026-06-09.md` were resolved in a
9-gate session (full log in `src/gap-fix-log-r2.md`). Highlights:

- **Distribution fixed (GAP-R2-001 / DEC-082)**: SW now network-first for navigation with cache fallback; persistent "new version" toast triggers skipWaiting + reload — deploys finally reach users
- **Light theme everywhere (DEC-083)**: 12 hardcoded colors replaced by tokens; `data-theme` + language applied at router root (covers /quick-add, /outings/*, /simulator); dynamic meta theme-color
- **Mobile feel (DEC-081)**: global user-select none (inputs preserved), transparent tap-highlight, touch-action manipulation
- **Dexie v3 unified migration**: share `confirmationStatus`, new `phaseProfileSettings` table, `Phase.rhythmPreset/peakDays`, rich `PlannedOccurrence` (endDate, kind, reservedCents, linkedSessionId); backup v3 with v2 import
- **Share confirmation (DEC-071)**: third-party shares born pending; debts count only confirmed; dashboard card with confirm/reject/adjust sheet (Julio's sister scenario covered by tests)
- **Fund/phase CRUD (DEC-080)**: edit/delete with safety rules (reassign or block), soft-delete cascades via orchestrators
- **Per-phase activities (DEC-074)**: 16-preset catalog + custom; `phaseProfileSettings` drives Planner/counters/outing start; kills cross-phase contamination
- **Phase rhythm (DEC-075)**: intensity presets + peak days; weighted free-to-spend per day with peak microcopy
- **Planned events (DEC-072/073)**: events/sub-destinations per phase with reserves deducting from free-to-spend until confirmed; dashboard day card (start now / postpone); one-off sessions create occurrences, not profiles
- **Rich outing (DEC-078/079)**: post-add enrichment stepper (category → payer → split, skippable, never blocks logging); outing history tab + read-only review
- **Final dashboard (DEC-076/077)**: counters carousel ordered by usage; rotating insights (6 V1 builders with significance rules) persisting daily `forecastSnapshots`; exact 11-position layout
- **Quality**: aria-labels across icon buttons; 7 new e2e tests (29 total); timezone bug fixed (UTC vs local date on day card)

## Gap-Fix Session R3 (2026-06-10)

All 26 requirements from Julio's field review were resolved in a 7-gate session
(full log in `src/gap-fix-log-r3.md`). Highlights:

- **App feel (DEC-084..087)**: sticky headers (Dashboard/Expenses/Planner), unified
  `--page-padding-x` margins, invisible scrollbars (root cause: `no-scrollbar` was never
  defined), no pull-to-refresh in installed PWA
- **Subtractive daily budget (DEC-088)**: "livre hoje" fixed at day start, drops with each
  expense (€6,00 − €2,00 = €4,00), can go negative; average is secondary
- **Notifications center (DEC-090)**: bell → /notifications with 5 derived notification types
- **Honest Friend v2 (DEC-092)**: plan-based (planned vs done vs fits-in-margin) — kills the
  "197 saídas" bug; projects reserve-consumption date; /impact detail page (DEC-093)
- **Multi-metric simulator (DEC-094)**: total + daily + plan perspectives, worst verdict wins
- **Expense taxonomy (DEC-095..097)**: ~110 subcategories, proximity-sorted stepper, 2-level
  event flow, 10s auto-dismiss with interaction reset, split flow enrichment
- **Planner overhaul (DEC-098..101)**: live margin, top over-budget warning, category menu
  (edit value / remove from phase / per-phase classification), real lock, event deep links,
  profile editing with safe removal
- **Debt statement (DEC-102)**: participant tap → itemized breakdown matching the debts engine
- **Clickability sweep (R-26)**: all 22 screens audited; orphan cards now navigate

## P2P Sync Session R4 (2026-06-10)

All 14 requirements from the P2P council session (DEC-103..108, MTG-2026-06-10)
were implemented in 7 gates (full log in `src/gap-fix-log-r4-p2p-sync.md`). Highlights:

- **Sync domain (pure TS)**: actor identity QR, wire protocol (manifest/chunk/ack
  with deflate + CRC32, 12 KB chunks), QR codec (`TPSYNC1:` envelope, 1.6 K char
  budget), statement + migration payloads
- **Worker `trippilot-sync` (DEC-107)**: ephemeral 2-peer rooms (Durable Object,
  SQLite class), opaque relay, 10-min alarm expiry, zero storage — deployed at
  `https://trippilot-sync.trippilot.workers.dev`
- **Transports (DEC-103)**: AES-GCM 256 E2E (key only in the QR), WebRTC DataChannel
  with automatic encrypted-relay fallback after 8 s, offline two-QR manual signaling
- **Device migration (DEC-104)**: BackupPage "send/receive to another device" +
  Welcome "receive from another device"; reuses backup pipeline + import preview
- **Pairing (DEC-105)**: "My QR" + "Add by QR" + retroactive "Connect by QR" +
  link badge; typing a name remains the default path
- **Mirrored debts (DEC-106)**: owner sends read-only statement; mirror confirms/
  rejects lines; responses flow back on the same session or queue offline and flush
  next time; financial truth never merges bidirectionally
- **Data**: Dexie v4 (peerLinks, mirroredStatements), backup v4 with v1-v3 import
  normalization; 35 new unit tests (299 total)

## Reliability Session R5 (2026-06-10)

All 9 requirements from Julio's v0.4/v0.5 field test were resolved in 4 gates
(full log in `src/gap-fix-log-r5.md`). The reported "total data loss" was
diagnosed as: IndexedDB failures being treated as empty state (redirect to
welcome) + an iOS-unsafe blob export that froze the standalone PWA. Highlights:

- **DB failure ≠ empty data (DEC-109)**: `useAppData` error state + 10 s
  watchdog; `DataErrorScreen` ("your data was NOT deleted" + retry that reopens
  Dexie); welcome redirect only after a SUCCESSFUL load; auto-retry on
  visibilitychange
- **iOS-safe export (DEC-110)**: `navigator.share({files})` first, fallback
  anchor `target=_blank` with 10 s deferred `revokeObjectURL`; try/catch +
  busy state on all backup handlers
- **Storage durability (R5-03)**: `requestPersistentStorage()` at boot +
  dashboard banner when not persisted; `repairDemoTripIfNeeded` date rewrite
  gated to `isDemo` (DEC-111 — it was corrupting real future/finished trips)
- **Onboarding keyboard (R5-04)**: `interactive-widget=resizes-content` +
  `useKeyboardInset` (visualViewport) + 100dvh layout — footer buttons stay
  above the keyboard
- **Onboarding details (R5-05)**: dedicated phase step (dates validated in trip
  range, rhythm preset, peak days)
- **Planner (DEC-112)**: itemized "you added 16 transporte, 5 mercado e 2 café"
  headline (was mislabeling the total); deficit = `-liveMargin` so the
  recommendation card survives leaving/re-entering the Planner
- **Outing gauge (DEC-113)**: piecewise `calculateGaugePosition` (spent 40 of
  35/45/55 now lands between meta and teto) + clamped value-pill marker
- **Tests**: +18 unit (317 total), e2e updated for the 5-step onboarding

## Full-Fix Session R6 (2026-06-10)

All 25 items from the full-coverage audit (`documents/full-coverage-audit-2026-06-10.md`)
plus Julio's field-test findings (`documents/field-test-checklist-r3-r5.md`) were resolved
in a 7-gate session (full log in `src/gap-fix-log-r6.md`, prompt in
`documents/r6-full-fix-prompt.md`). Highlights:

- **Timezone bugs killed (BUG-001/002, PAR-006)**: every "which day was this?" projection
  now goes through `localDayOf` (UTC instants no longer shift evening expenses to the next
  day); phase end dates fully inclusive; `resolveActivePhase` replaces `phases[0]` fallbacks
- **Debts engine (BUG-003)**: multi-creditor allocation respects remaining credits
- **Shared edit (BUG-004)**: editing a shared expense re-applies DEC-071 rejected-share math
- **P2P sync reliable on the 1st attempt (P2P-09/12/13)**: sender consumes the receiver's
  hello symmetrically (was erroring on EVERY successful send) + channels buffer messages
  arriving before the app listens (was silently dropping the first attempt)
- **QR scanner (P2P-06/07)**: camera switch button (remembers choice) + zoom chips —
  unblocks the offline 2-QR mode on multi-lens iPhones
- **Dashboard carousel (R-02)**: exactly 3 cards per page + mediterranean per-category colors
- **Outing gauge (R5-09)**: labels/ticks anchored at the real 3:2:1:1 segment boundaries
- **Honest iOS persistence (R5-03)**: install-to-home-screen guidance instead of the
  impossible "enable" CTA; installed PWA no longer alarmed
- **Keyboard viewport (R5-04)**: forced restore on keyboard close
- **Locale formatting (PAR-001/002/004/005)**: dates/numbers/onboarding names/wallet types
  follow the active language via a domain locale bridge
- **Simulator v3 (R-12)**: each metric shows its math, quick chips, post-verdict CTAs;
  learning prior keeps the preset estimate (PAR-003a)
- **Tests**: +26 unit (343 total)

R7 candidate (deferred, product decision): per-category simulation weighting when the
category plan is already blown.

## Field Review Session R4 (2026-06-11)

All 12 requirements from Julio's in-trip audio review were resolved in a 10-gate
session (full log in `src/gap-fix-log-r4.md`, prompt in
`documents/gap-fix-r4-implementation-prompt.md`). Decisions DEC-114..123. Highlights:

- **Payer math fixed (DEC-114, the critical one)**: "Ana paid €15 and we didn't split"
  no longer erases the cost — it stays MY expense AND creates a €15 debt to Ana.
  Single truth-table function `resolvePayerExpense` reused by QuickAdd, outing stepper
  and outing split; end-of-session batch wallet skips items paid by others;
  reconciliation adjusts over the personal total preserving debts
- **Occasions = sessions (DEC-115)**: a 9-item bar night counts as ONE bar occasion
  everywhere (dashboard counters, Honest Friend with new `over_plan` kind, impact,
  simulator) via `countProfileOccasions`
- **Contextual simulator v3 (DEC-116)**: asks WHERE the money goes; explained verdicts
  ("consumes ≈2 of your 4 dinners", "the €60 reserve covers it", "≈4 days of your daily
  free") — zero unlabeled numbers, old raw-equation displays removed
- **Honest outing zones (DEC-117)**: copy/color change AT the target; "can still spend
  comfortably: €0" eliminated; next-drink hint is honest per zone; progressive alerts
  re-anchored (50% target / target / ceiling / max)
- **Multi-select (DEC-118)**: long-press in expense/outing lists → selection bar with
  batch delete / move pool / change category (atomic Dexie orchestrators)
- **Configurable dashboard (DEC-119)**: long-press a card → quick action / hide /
  configure; /settings/dashboard reorder + visibility persisted in AppSettings
- **PWA outing notification (DEC-120, best effort)**: persistent notification with
  +€X quick-add buttons and "what was it?" follow-up; superseded by DEC-124 (v0.7.1):
  the SW now always writes straight to IndexedDB and re-renders itself; research
  VERIFIED 2026-06-11 in `documents/pwa-notification-research.md`; true
  ongoing/media-style → Capacitor backlog (DEC-017)
- **Help mode (DEC-121)**: "?" on 6 complex screens → overlay highlighting the real
  elements with concrete travel examples ×3 languages
- **UI polish (DEC-122)**: carousel opens aligned (3 cards), insights advance one per
  gesture, category chip labels never overflow, `<html lang>` follows the language
- **QuickAdd payer-first (DEC-123)**: "Who paid?" as first-level question with debt hints
- **Tests**: +66 unit (409 total)

### Same-day field feedback on v0.7.0 (→ v0.7.1)

- **Notification v2 (DEC-124)**: SW handles action clicks alone (direct IndexedDB
  write + re-render from fresh DB + broadcast) — v1 window delegation died on
  Android frozen tabs (stuck €0); Settings toggle + outing-screen enable banner +
  boot/refocus re-sync; rich body (total vs target, remaining, ≈N drinks); "open"
  fixed to /outings/active
- **Overlay stacking fix (DEC-125)**: SelectionBar and help overlay portaled to
  <body> (sticky headers trapped them under the bottom nav); help card draggable

## Brainstorm Features Session (2026-06-12, v0.8.0)

Nine features from the creative brainstorm council, all approved by Julio and
implemented in one session. Decisions DEC-126..134. Highlights:

- **Universal undo (DEC-126)**: deletes (single/batch/outing) show a 6s toast with
  "Desfazer" — restore orchestrators clear `deletedAt` on the full cascade;
  `trippilot:data-changed` event refreshes any open page
- **Bar Mode (DEC-127)**: fullscreen dark view for the active outing (huge total,
  giant quick-add buttons, wake lock keeps the screen on); quick-adds skip the
  stepper and offer undo instead
- **Mental anchor (DEC-128)**: "€20 ≈ R$ 124" hints in QuickAdd/detail/bar mode
  with a manual offline rate configured in Settings
- **Dashboard insight cards (DEC-129/130/131)**: yesterday recap (spent vs
  reconstructed allowance + streak), phase burn-down (SVG, rhythm-aware ideal
  line), month heatmap (calendar grid, tap day → transactions sheet) — all
  movable/hideable via DEC-119 infrastructure
- **Rescue mode (DEC-132)**: `/rescue` calculator — "guardar €X" → new daily
  allowance + greedy occasion-skip suggestions; nothing persisted
- **Share card (DEC-133)**: trip overview exports a 1080×1350 PNG via canvas +
  Web Share sheet (local only — DEC-011 stands, no social surface)
- **PWA shortcuts (DEC-134)**: launcher long-press → quick-add / outing / simulator
- **Tests**: +42 unit (456 total); sync-crypto suite moved to node environment
  (jsdom lacks SubtleCrypto)

### Same-day field feedback on v0.8.0 (→ v0.8.1)

- **Install + update controls (DEC-135)**: "Add to home screen" button in More +
  Settings (captured beforeinstallprompt); Settings "App" section shows the real
  version and a "Check for update" button that forces the SW update and reloads —
  covers the "Chrome updated but the installed app is stale" case
- **Burn-down follows the full plan (DEC-136)**: dated events/sub-destinations
  now appear as steps on the ideal line on their planned day (multi-day spread
  evenly); pending reserves added back to the chart envelope; +4 unit tests (460)
- **Width fix**: pending-shares card (and active-outing card) gained `w-full` —
  buttons shrink-to-fit unlike the div cards
- **Repo**: project pushed to GitHub (`juliocorcini/trip-budget-copilot`)

## Stability Fix Session (2026-06-13, v0.8.2)

All 20 bugs from `documents/stability-audit-2026-06-13.md` were fixed in a 7-gate
session (prompt `documents/stability-fix-prompt.md`, full log in
`src/stability-fix-log.md`). Decision DEC-137. The deployed app had become
unusable — cold starts with real data landed on onboarding and transient
IndexedDB hiccups looked like total data loss. Highlights:

- **Boot/onboarding P0 (Gate 1 — BUG-001/003/004/009/014)**: `BootGate` routes
  cold starts (dashboard / recovery / welcome) and only reaches Welcome after a
  SUCCESSFUL empty load; `appSettings.get()` is non-destructive (no default-row
  write); every data screen renders `DataErrorScreen` on error with declarative
  `<Navigate>` — no `navigate()` in the render body (it crashed under React 19).
  New `BootGate`, `TripRecoveryScreen`, `LoadingScreen`.
- **Safety net (Gate 2 — BUG-005/010/016/017/018)**: `safeLocalStorage` helper
  (in-memory fallback, zero direct `localStorage` elsewhere); `formatMoney` and
  `toSafeIsoDate` never throw; root `ErrorBoundary` keeps a crash-log buffer and
  shows a persistent recovery screen after ≥4 crashes (clear-cache / export)
  instead of looping; `window` error + unhandledrejection handlers.
- **SW hardening (Gate 3 — BUG-006/011)**: the Service Worker opens IndexedDB
  version-less, aborts empty-DB creation, rejects on `onblocked`, closes on
  `onversionchange`, guards `hasStores()` before any transaction; SW reloads are
  deferred while an outing is active (`sw-reload.ts`). CACHE_NAME v7→v8.
- **iOS persistence + integrity (Gate 4 — BUG-002/013/015)**: emergency JSON
  snapshot to `localStorage` (every 5 expenses + on outing end); empty DB +
  snapshot → `EmergencyRestoreScreen` (one-tap restore); onboarding wrapped in
  one atomic Dexie transaction (`createTripFromOnboarding`, `activeTrip` flips
  only after commit); demo repair gated by `isDemo` so real trips are untouched.
- **Performance (Gate 5 — BUG-007/008/012/019/020)**: `AppDataProvider` runs the
  loader ONCE (context consumer `useAppData`); `DashboardPage` 1607 → 267 lines
  with heavy math/async moved to a single-memo `useDashboardModel`; Vite
  `manualChunks` (index 729 → 156 KB, QR libs stay lazy, no >500 KB warning);
  foreground auto-retry throttled (30s cooldown, max 3, no `db.close` storm);
  Android back button no longer exits the PWA on home routes.
- **Tests**: +44 unit (460 → 504), all green; build + typecheck clean.

## Feature Expansion Package 1 (2026-06-13, v0.8.3 → v0.10.1)

Phases 1 & 2 of `documents/feature-expansion-master-plan-2026-06-13.md` were built
autonomously in 8 gates (prompt `documents/phase-package-1-capture-simple-mode.md`,
log in `src/phase-1-2-log.md`). Decisions DEC-138..149. A version + deploy + "what's
new" entry per gate. Highlights:

- **What's New screen (DEC-138, M0)**: About lists the current version's notes +
  expandable history; `release-notes.ts` with pt/en/es copy, one entry per gate.
- **Phase 1 — fast capture (DEC-139..142, v0.8.4)**: amount field is a safe
  calculator (`evaluateAmountExpression`, no `eval`); description memory +
  frequent favorites (zero-AI, derived from history); round-trip transport
  duplication; ≥3× median anomaly confirm (never blocks — DEC-053).
- **Phase 1 — outing v2 (DEC-143, v0.8.5)**: amount buttons learn the last value;
  repeat-last-item; round (N × price, atomic); fair payer-rotation hint; "time to
  ceiling" projection. All reuse the atomic session orchestrators; suggestions only.
- **Phase 1 — extras (DEC-144/145, v0.9.0 — Phase 1 complete)**: optional voice
  quick-add (Web Speech behind a support-detected boundary; `parseVoiceExpense`);
  simulator "borrow from tomorrow" honest notice (fits the phase but overflows today).
- **Phase 2 — simple mode (DEC-146, v0.9.1→0.9.2)**: non-indexed `appMode`
  (default complete, backfilled, not merged on import); lean `SimpleHome`
  ("free today" + register); data-driven `visibleInMode` hides Planner/Outing/
  Simulator; `ModeGuard` on advanced routes with a per-visit "open anyway" escape;
  live Settings toggle. Only HIDES — never deletes data or routes (ÂNCORA 9).
- **Phase 2 — smart start (DEC-147/148, v0.9.1)**: one-question onboarding (atomic
  via `createTripFromOnboarding`) with a "customize everything" door to the
  preserved 5-step flow, both ending on the mode choice; trip presets
  (Urban/Family/Festival) seed rhythm/peak days/reserve as editable suggestions.
- **Phase 2 — adaptive reveal (DEC-149, v0.10.0 — Phase 2 complete)**: after ≥5
  expenses in simple mode, a one-time dismissible card offers to unlock complete
  mode; `shouldOfferModeReveal` + `simpleRevealDismissed` flag.
- **Tests**: +110 unit (504 → 614), all green; typecheck + build clean (no >500 KB
  chunk warning). M11 (voice) shipped, not deferred.
- **Deploy note**: all gate deploys (0.8.3→0.10.0) used `--branch master` and
  therefore landed as **Preview** (`master.trippilot.pages.dev`); the 0.10.1 final
  was deployed with `--branch main` to update Production (`trippilot.pages.dev`).

## Registered Technical Debts

| Debt | Origin | Notes |
|------|--------|-------|
| Full orchestrator refactor of untouched pages | DEC-067 (D-H) | Orchestrators exist for expense/outing/wallet/backup/share/CRUD flows; some older pages still call repositories directly |
| Automatic future floor calculation | DEC-069 (D-I) | Manual floor per phase link implemented; automatic calculation is D3+ |
| SW precache via build plugin | GAP-036 | Current approach parses index.html at install; a Workbox/Vite plugin would be more robust |
| E2E (Playwright) in CI | DEC-054 | 29 e2e tests run locally; CI requires browser install |
| Biometric app lock (WebAuthn) | DEC-161 (M20 cut) | PIN-only shipped; WebAuthn platform authenticator deferred — PIN is the baseline |
| Nearby POI list (Overpass) | DEC-157 (M4 cut) | Reverse-geocode + offline recents + manual name shipped; a full POI picker is deferred |

## Next Steps

0. Julio field-tests v0.14.1 (Production `trippilot.pages.dev`) — Package 3 golden path:
   expense with sticky location (offline still logs); foreign-currency expense (original kept,
   wallet debits right); daily snapshot accumulates + restore-to-yesterday; send backup via
   share + open the HTML summary offline; turn the PIN lock on → it asks at boot, recovery
   never trapped; share text into the app → QuickAdd opens pre-filled (never auto-saves).
1. Julio re-tests v0.10.1 in the field at `trippilot.pages.dev` (now Production) —
   Package 1 golden path: one-question onboarding → simple → lean dashboard; capture
   with calculator + memory/favorites; outing with last values, round, projection;
   switch to complete → planner/outing/simulator return; adaptive reveal after a few
   expenses; About shows v0.10.1 + accumulated "what's new"
2. Julio tests v0.8.0 in the field — focus on bar mode at night, undo toasts,
   anchor hints with his real BRL rate, the three new dashboard cards, rescue
   calculator and the share card on his Samsung
3. Re-test v0.7.1 items still pending field validation — payer math (debts after
   "someone else paid"), occasion counters, contextual simulator verdicts,
   notification quick-add
4. Real-data seed (julio-europa-2026) when trip data is ready
5. D6 / V2 features per `implementation-phases.md` (native layer, reports, automatic
   future floor); Capacitor package now also carries the ongoing-notification item
   (DEC-120 research)
6. P2P V2 deferrals per DEC-108 (live split, group sync, settlement handshake)
7. R7 candidate: per-category simulation weighting (product decision pending)

## Blockers

- None.

## Key Decisions Reference

All decisions documented in [decision-log.md](decision-log.md). R2 session added
DEC-071..DEC-083 (approved 2026-06-09); R3 session added DEC-084..DEC-102
(approved 2026-06-10); R4 session added DEC-103..DEC-108 (approved 2026-06-10);
R5 session added DEC-109..DEC-113 (approved 2026-06-10); field review R4 session
added DEC-114..DEC-123 (approved 2026-06-11); brainstorm session added
DEC-126..DEC-134 (approved 2026-06-12); v0.8.1 field feedback added DEC-135/136
(approved 2026-06-12); stability hardening added DEC-137 (approved 2026-06-13);
Feature Expansion Package 1 (Phases 1 & 2) added DEC-138..DEC-149 (approved 2026-06-13);
Feature Expansion Package 2 (Phases 3 & 4) added DEC-150..DEC-156 (approved 2026-06-13);
Feature Expansion Package 3 (Phases 5 & 6) added DEC-157..DEC-161 (approved 2026-06-13).
