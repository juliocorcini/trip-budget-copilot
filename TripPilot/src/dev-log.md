# Dev Log — TripPilot Implementation

## Current State
- **Active Delivery**: Post-APK Improvements — Phase 1 (Native Shell Hardening)
- **Active Milestone**: Gate 1B DONE → native persistence reality + GPS permission + native notifications
- **Last Green Test Run**: Gate 1B (0.29.0) — 941 pass / 0 fail
- **Total Tests**: 941 pass / 0 fail
- **Build Status**: clean (web build + cap sync 4 plugins + type-check all green)
- **APK**: `Downloads/TripPilot-0.29.0-debug.apk` (versionCode 3)
- **Next**: Gate 1C — N7 DPI/scaling calibration + N8 haptics
- **Confidence**: 90% (N5/N6 are [device]-pending validation)

## Post-APK Improvements — Phase 1 (Native Shell Hardening)
Master plan: `brain/documents/post-apk-improvements-plan-2026-06-15.md`
Phase 1 package: `brain/documents/phase1-native-execution-package-2026-06-15.md`
Live Update spec: `brain/documents/live-update-nowbar-technical-spec-2026-06-15.md`

### Gate 1B — Permissions & services ✅ (0.29.0) — [device]-pending: N5, N6
- [x] **M1B.1 — Native persistence reality (N4)**: storage is app-private in the
      APK (no browser eviction), so the data-loss warning + the persistent-storage
      Settings section are gated behind `!isNativeApp()`. Dashboard `showStorageWarning`
      and the Settings section hidden natively; Web/PWA unchanged; manual backup intact.
- [x] **M1B.2 — Native GPS permission (N5)** [device]: `utils/geolocation.ts` is now
      native-aware — `ensureLocationPermission()` calls Capacitor Geolocation
      (check/request) on the APK; `getCurrentCoords()` reads via the plugin natively
      and via `navigator.geolocation` on the Web (unchanged → existing tests pass).
      Settings location toggle requests permission BEFORE enabling and toasts on
      denial (`settings.location_denied`, 3 locales). Manifest gains
      `ACCESS_FINE/COARSE_LOCATION`.
- [x] **M1B.3 — Native notification base (N6)** [device]: new `utils/native/notifications.ts`
      (Capacitor LocalNotifications, lazy-imported). `outing-notification.ts` routes to
      the native path when `isNativeApp()` — permission (kills "browser does not support"),
      ongoing active-outing notification reusing the domain payload (`buildOutingNotificationPayload`,
      rich body), and a working "open" action (listener → `/outings/active`). Quick-add
      action buttons that WRITE to the DB are deferred to Track B (Live Update / foreground
      service). Web/PWA keeps the SW path untouched. Manifest gains `POST_NOTIFICATIONS`.
      Settings refreshes the async native permission on mount.
- [x] **Verify**: 941 tests pass, type-check (tsc -b) clean, web build OK,
      `cap sync` reports 4 plugins (app, geolocation, local-notifications, status-bar).
- **Self-check / regression**: every native path guarded by `isNativeApp()`; Web bundle
      keeps the plugins out via lazy `import()`; geolocation/outing-notification unit
      tests still green (web branch unchanged). Changes confined to `utils/geolocation.ts`,
      `utils/native/notifications.ts`, `utils/native/index.ts`, `utils/outing-notification.ts`,
      `SettingsPage`, `DashboardPage`, manifest, locales, version files.
- **[device] pending**: N5 OS dialog + coords on a real phone; N6 permission prompt +
      ongoing notification + open action on a real phone.
- **Next (Gate 1C)**: N7 DPI/scaling calibration (measure APK vs PWA), N8 haptics.

### Gate 1A — Native shell foundations ✅ (0.28.0)
- [x] **M1A.0 — Native boundary (N0)**: installed `@capacitor/status-bar@8` +
      `@capacitor/app@8`. New `src/utils/native/` module isolates all native calls
      behind `isNativeApp()` (Capacitor.isNativePlatform). Bootstrap via
      `initNativeShell()` in `main.tsx` — no-op on web, so PWA/domain stay pure.
- [x] **M1A.1 — Safe-area top (N1)**: `--safe-top` token = `env(safe-area-inset-top)`.
      AppShell pads `pt-[var(--safe-top)]`; sticky headers use `top: var(--safe-top)`.
      Fixes content (titles/back button) hiding behind the status bar.
- [x] **M1A.2 — Status bar follows theme (N2)** (DEC-192): `applyNativeStatusBar()`
      runs on every theme change in RootLayout — sets bar background to app color and
      icon style (Light/Dark) so icons stay legible in light theme.
- [x] **M1A.3 — Native back button (N3)** (DEC-193): `@capacitor/app` backButton
      listener → LIFO overlay-dismiss registry (BottomSheet registers on open) →
      `history.back()` → on home, double-tap-to-exit toast (`common.press_again_to_exit`,
      3 locales). PWA `useBackButtonGuard` history hack gated off when native.
- [x] **Verify**: tsc clean, 941 tests pass, web build OK, cap sync OK,
      `assembleDebug` BUILD SUCCESSFUL, APK copied to Downloads.
- **Self-check / regression**: changes confined to `utils/native/*`, `overlay-dismiss.ts`,
      `AppShell`, `RootLayout`, `BottomSheet`, tokens/globals CSS, locales, version files.
      Web behavior unchanged (every native path guarded by `isNativeApp()`).
- **Next (Gate 1B)**: N4 persistence reality (hide banner/toggle), N5 native GPS
      permission, N7 DPI/scaling calibration, N8 haptics.

## Redesign 2026-06-15 — Navigation & Copiloto (G1–G8)
Plan: `brain/documents/navigation-redesign-plan-2026-06-15.md`
Copiloto intelligence (G3): `brain/documents/copilot-intelligence-2026-06-15.md`
Copiloto expansion (G8): `brain/documents/copilot-expansion-2026-06-15.md`

### G8 — Copiloto intelligence expansion ✅ (0.27.0, sw v44)
- [x] 2ª rodada de conselho (inline, 4 lentes brainstorm + priorização) →
      `copilot-expansion-2026-06-15.md`. Auditou a matéria-prima subaproveitada;
      escolheu 4 cruzamentos NOVOS que "mudam uma decisão" (regra do Simplificador).
- [x] **Rota corrigindo** (DEC-181): `summarizeForecastTrend(snapshots)` sobre a
      série de `forecast_snapshots` (a única série temporal do app, já persistida e
      quase não exibida). "Há N dias projetava €X; agora €Y." Gate: ≥2 snapshots e
      Δ acima da tolerância (3%, piso €5). Repo ganhou `getByPhaseId`.
- [x] **Runway** (DEC-182): `calculateRunway(fts, avgDaily, daysLeft)` — "seu livre
      dura ~N dias (até DATA)" ou "cobre a fase com folga". Reuso puro; sem dado novo.
- [x] **Dia da semana** (DEC-183): `summarizeWeekdayPattern(tx)` — fds × dia útil
      (média por dia distinto, bucket via localDayOf). Gate: ≥1 de cada com gasto.
- [x] **Eficiência de saídas** (DEC-184): `summarizeOutingEfficiency(outings)` —
      bateu o alvo + economia média. Gate: ≥2 saídas fechadas com alvo.
- [x] Ordem na tela (conselho): trend+runway logo após "Pra onde vai"; weekday após
      o mapa do mês; outings após a comparação de fases. Todos data-gated (anti-poluição).
- [x] i18n pt/en/es: bloco copilot.{trend_*,runway_*,weekday_*,outings_*}. +`addDaysIso`.
- [x] Tests: +13 em copilot-insights.test.ts (math verificada p/ cada fn) → 941 total.
- Tests 941/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g8/g8-copiloto.png`). Backlog (conselho): cash×cartão, total em R$,
  hora/streak, Wrapped de fim de viagem.

### G7 — Guide "Tudo que dá pra fazer" ✅ (0.26.0, sw v43)
- [x] Julio: "tem muita função que fica escondida — uma página falando todas as
      funções, o que faz, como faz, e um atalho pra ir". Built as a data-driven
      catalog so the page only renders (Core Rule 8).
- [x] Domain `guide/guide-catalog.ts`: 6 sections / 21 entries (daily, planning,
      trip & phases, people, copilot, settings). Each: icon + titleKey + descKey
      + route. Routes are real router paths — unit-guarded.
- [x] `GuidePage` (`/guide`, lazy, under AppShell): grouped tappable rows
      (icon chip + title + one-line "what you can do" + chevron → navigate).
- [x] Entry points: prominent highlighted card at the TOP of Settings (the gear =
      catch-all menu now) + a row in the Copiloto tools footer (`copilot.guide`).
- [x] i18n pt/en/es: full `guide.*` block (title, intro, 6 section titles, 21
      title+desc pairs) + `settings.guide_hint` + `copilot.guide`/`guide_desc`.
- [x] Test `guide-catalog.test.ts` (11): unique section/entry ids, every route is
      registered in the actual router (traverses `router.routes`), every key
      resolves to a string in all 3 locales.
- Tests 928/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g7/g7-guide.png`, `g7-settings-top.png`).

### G6 — Amigo sincero reconciled (category × phase slack) ✅ (0.25.0, sw v42)
- [x] Root of Julio's confusion: amigo's `over_pace` count is CATEGORY-scoped
      ("only 3 of 4 bars fit") while the phase shows slack ("€115 under plan") —
      both true, but unreconciled they read as broken.
- [x] Domain (honest-friend `over_pace`): added `overflowCount`, `phaseFreeCents`,
      `overflowFitsPhase` (phase slack ≥ overflow × typical). Pure; +1 test
      asserting both the with-slack and no-slack branches.
- [x] Shared `AmigoSinceroCard` (one source for Home + Copiloto, plan §4): when
      `overflowFitsPhase`, shows `amigo_over_pace_slack` — "no plano de {type}
      cabem só {fit}; mas a fase tem €X livres — o resto cabe sem culpa; pra
      seguir o plano, segura {hold}". Else keeps the reserve-date warning (tight
      case). Card now takes `currency` (threaded from Dashboard + Copiloto).
- [x] i18n pt/en/es: `amigo_over_pace_slack`. No colored side-bar (already).
- Tests 917/0 · typecheck clean · build clean · Playwright OK (Copiloto amigo
  renders + simulate button; `.ux-shots/g6/g6-copiloto.png`). over_pace copy
  path is unit-verified (demo seed shows the `no_plan` state).

### G5 — Check-in: real effect + 'Sem gastos' + microcopy ✅ (0.24.0, sw v41)
- [x] Micro-explanation on the prompt: "Diz como vai ser o dia que eu mostro
      quanto dá pra gastar e ajusto o ritmo dos próximos dias" — answers Julio's
      "pra que serve / o que significa".
- [x] New `no_spend` intent (CheckInIntent + catalog + lens + planCheckInDay):
      a no-spend day → primary €0, the whole free amount carries forward.
- [x] "Efeito real" (still READ-ONLY — ÂNCORA 12 preserved, per plan §3): new pure
      `projectDailyBoostCents(saved, effDaysAfterToday)`. Calm & no-spend now show
      "Guardando €X hoje, seus próximos dias ganham +€Y/dia" (trending_up). Page
      derives effDaysAfter from the phase weights (`calculateEffectiveSpendingDays
      − getDaySpendingWeight`). Verified math: €38,12/10d ≈ +€3,81/d; €95,29/10d
      ≈ +€9,53/d.
- [x] 4 modes fit one row (Tranquilo/Passeio/Noite/Sem gastos) — no wrap.
- [x] i18n pt/en/es: checkin_no_spend, checkin_plan_no_spend, stat labels,
      checkin_redistribute, reworded checkin_prompt.
- [x] Tests: catalog now 4 intents; +no_spend plan asserts; +3
      `projectDailyBoostCents` tests (916 total).
- Tests 916/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g5/g5-no-spend.png`, `g5-calm.png`, `g5-night.png`).
- ÂNCORA 12 note: the check-in stays a projection/lens — it never writes an
  expense nor moves the hero's free-today (plan §3: "projeção/realce, reversível,
  nunca grava gasto"). Julio's "muda o livre dos outros dias" is shown AS a
  projection, not by mutating data.

### G4 — Início: focus + hero clarity ✅ (0.23.0, sw v40)
- [x] Hero overline reframed: `dashboard.free_to_spend_phase` ("Livre para usar
      nesta fase") instead of repeating the phase end date already shown in the
      header (Julio: "ele repete 2× 25 de junho"). Robust to long phase names.
- [x] Kept everything Julio asked to keep on the home: explicit "Livre para usar
      hoje: €X", rotating INSIGHTS carousel, Amigo sincero (no colored side-bar —
      verified none exists), divisões, compras pessoais, gastos recentes.
- [x] Analytics focus: the deep analysis (month map, phase pace, projection) now
      lives in Copiloto (G3). Home keeps the `trip_analytics` drawer COLLAPSED by
      default (D3) — zero regression, recap preserved, one tap to peek.
- [x] Backup advisory already correct (DEC-176): routine reminder is in the
      notifications center; only the urgent eviction-risk warning stays on the
      home, and only when storage isn't persisted (not the case on Julio's
      device, persisted=true). No change needed.
- Removed now-unused `formatDate` import from DashboardCards.
- Tests 913/0 · typecheck clean · build clean · Playwright visual OK
  (`.ux-shots/g4/g4-home.png`, `g4-home-top.png`).
- Regression check: insights carousel intact (insight-rotation test green); card
  catalog unchanged; no business logic touched.

### G3 — Copiloto (the intelligence) ✅ (0.22.0, sw v39)
- [x] New pure domain module `src/domain/copilot/` (DEC-178): verdict, category
      summary, daily-spend summary, social×solo, phase-pace comparison. 15 unit
      tests (math-verified).
- [x] `CopilotPage` rewritten to orchestrate `useDashboardModel` + the new
      module into the council narrative (DEC-177): Verdict → Where it's heading
      (reuses phase_projection insight) → Amigo (shared card) → Where it came
      from (category bars) → Month map (HeatmapCard + biggest day/avg) → Phase
      pace (BurndownCard) → vs previous phase → Social×solo → Settlements →
      Tools. Each module data-gated; empty trip shows a warming-up invite.
- [x] Extracted `cards/AmigoSinceroCard.tsx` so Home + Copiloto share ONE source
      (G6 reconciles the copy once). Dashboard refactored to use it.
- [x] i18n: full `copilot.*` block (verdict/where/from/map/rhythm/social/debts/
      compare/empty) in pt-BR, en, es.
- Tests 913/0 · typecheck clean · build clean · Playwright visual OK (all
  modules render with demo data).
- Regression check: Dashboard amigo unchanged (same keys via shared card); no
  new routes; reuses existing derivations; no business logic in the page.

### G2 — Viagem hub + cross-phase ✅ (0.21.0, sw v38)
- [x] Phase selector at top (chips): `Todas as fases` × each phase — filters the whole page. Lets user view/plan past, current or future phases.
- [x] "All phases" view: trip summary card (budget × spent) + a card per phase (spent / free), funds, structure.
- [x] Specific-phase view: inline planning preview (free-to-spend + per-category allocation from forecasts) with "Editar plano" → `/planner`.
- [x] Planned purchases section (open items + reserved remaining) — conditional render.
- [x] Funds section context-aware (selected phase pool or all), with plain microcopy explaining what a fund is + "Gerenciar fundos".
- [x] Structure links: overview, phases, profiles, participants, wallets, outing history. Nothing lost vs old Mais/Planner.
- Tests 898/0 · typecheck clean · build clean · Playwright visual OK (phase + all views).
- Regression check: reuses existing domain fns (calculateFreeToSpend, createPoolSummary, calculateOccasionForecasts, plannedPurchase helpers); no new shared modules.

### G1 — Navigation & Settings entry ✅ (0.20.0, sw v37)
- [x] Bottom bar: removed "Mais"/"Planejar"; now `Início · Gastos · ( + ) · Viagem · Copiloto`.
- [x] New `/viagem` hub (TripHubPage): Planning (planner, planned) + Structure (overview, phases, funds, wallets, profiles, people, outing history). Nothing lost.
- [x] New `/copiloto` (CopilotPage): tools (impact, simulator, rescue). Narrative lands in G3.
- [x] Gear in Início header → `/settings`; Settings now exposes backup/CSV export + About (the old "Mais → Dados/App").
- [x] `/more` → redirect to `/viagem`; MorePage.tsx deleted (superseded). Copiloto is `advanced` (hidden in simple mode).
- Tests 898/0 · typecheck clean · build clean · Playwright visual OK.
- Regression check: nav routes intact, no other `/more` references, demo data renders all screens.

## Completed

### D1 — Foundation ✅ (52 tests at completion)
- [x] D1.M1 - Project Scaffold
- [x] D1.M2 - Domain Types + Validation (8 tests)
- [x] D1.M3 - Repositories (base + 9 entity repos)
- [x] D1.M4 - Budget Engine (26 tests)
- [x] D1.M5 - Backup Engine (8 tests)
- [x] D1.M6 - Demo Data + Onboarding
- [x] D1.M7 - Shell + Dashboard
- [x] D1.M8 - Expense Form (QuickAdd)
- [x] D1.M9 - Expense List
- [x] D1.M10 - Planner
- [x] D1.M11 - Settings + Backup UI
- [x] D1.M12 - Polish

### D2 — Splitting ✅ (+9 tests = 61 cumulative)
- [x] Split engine (equal/custom shares)
- [x] Debt tracker (calculateDebts)
- [x] Settlement creation
- [x] ParticipantShare + Settlement repositories
- [x] SharedExpensesPage UI

### D3 — Forecasting ✅ (+9 tests = 70 cumulative)
- [x] Profile learning engine (weighted avg, confidence)
- [x] Occasion forecasts (remaining/planned/spent)
- [x] Simulator (risk levels: low/medium/high/critical)
- [x] Scenario cost calculator
- [x] SimulatorPage UI

### D4 — Outing Mode ✅ (+10 tests = 80 cumulative)
- [x] Session engine (create/end)
- [x] Quick-add buttons (configurable per profile)
- [x] Progressive alerts (50/75/90/100%)
- [x] Next drink impact calculator
- [x] OutingPage UI with real-time tracking

### D5 — PWA ✅
- [x] manifest.json with shortcuts
- [x] Service worker (stale-while-revalidate)
- [x] PWA registration
- [x] Persistent storage utility
- [x] Apple mobile web app meta tags

### D6 — Native Layer ✅
- [x] capacitor.config.ts
- [x] Notification utilities (Web API + Capacitor ready)
- [x] APK-ready configuration

## Decisions Made (not in decision-log)
- EntityTable ID casting with `as any` for Dexie 4 strict types
- parseISO in tests for timezone safety
- Service worker: stale-while-revalidate strategy
- Capacitor config with @anthropic/capacitor-cli type reference (placeholder)
- Web Notifications API as fallback, Capacitor for native

## Known Issues
- Bundle size > 500KB (needs code-splitting with lazy imports)
- No PWA icon images generated (need actual PNG files in /icons/)
- Capacitor not installed as dep (requires `npx cap init` at build time)
- E2E Playwright tests not written (future iteration)
