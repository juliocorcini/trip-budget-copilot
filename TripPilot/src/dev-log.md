# Dev Log — TripPilot Implementation

## Current State
- **Active Delivery**: Field Feedback Round — plan `brain/documents/improvements-master-plan-2026-06-16.md` (18 items, 7 gates G1→G7, 0.41 → …)
- **Active Milestone**: G3a (0.43.0) — Wise import made visible (item 13) — DONE. G3b (item 14, transfer intelligence + split) — BLOCKED on Julio's financial-mapping decisions (AskQuestion sent).
- **Last Green Test Run**: G3a 0.43.0 — 977 tests pass (112 files), tsc --noEmit clean (no domain change in 13)
- **Build Status**: clean (web build + type-check green; cap sync/APK deferred to native gates G6/G7)
- **APK**: `Downloads/TripPilot-0.40.0-debug.apk` (versionCode 14) — no native change yet this round
- **Deploy**: each gate shipped to Production via `wrangler pages deploy dist --branch=main` → `trippilot.pages.dev`; 0.29.0 → 0.43.0
- **Next**: G3b — Wise TRANSFER intelligence (detect person, match participant, pay-debt settlement / wallet transfer / expense, split one transfer into many) — awaiting answers.
- **Confidence**: G3a 95% (pure UI entry point, no logic). G3b held deliberately: new financial WRITE paths from import (settlements / wallet transfers) are high-impact (SWE-guideline 6.2) — confirming mapping before building.

### Field Feedback Round — plan `improvements-master-plan-2026-06-16.md`

#### G3a — Wise import made visible (0.43.0)
Source: Julio field feedback item 13 — the statement importer was buried inside Wallets ("muito escondida"); wanted it at the top of Gastos, kept in Wallets too.
- [x] **Entry on Gastos (item 13)**: an `upload_file` icon button in the Expenses header (visible on both sub-tabs) → `/import/wise`. Kept the existing Wallets entry untouched. Copy `expenses.import_statement` ("Importar gastos e movimentações") pt/en/es.
- [x] **Verify**: 977 tests pass (112 files; no new tests — pure UI entry), tsc --noEmit clean, web build green. No domain/schema/dep change. Deployed to Production (0.43.0).
- [ ] **item 14 (transfer intelligence) — held**: needs Julio's call on how a TRANSFER-to-a-person maps to money (settle existing debt vs. also create the expense; wallet-to-wallet via `transferBetweenWallets`; split one transfer across targets). All primitives exist (`createSettlement`, `transferBetweenWallets`/`withdrawCash`, payer-expense). AskQuestion sent.

#### G2 — Home numbers: truly-free + real check-in lens (0.42.0)
Source: Julio field feedback items 18, 17, 9. The hero "livre na fase" (988) ignored the planner reserve (alocado 414 → margem 574); the check-in was a read-only suggestion that didn't visibly change "free today"; and the piggy bank always sat under the check-in even when it wasn't the day's focus.
- [x] **Truly-free hero (item 18)**: new pure `calculateTrueFree(phaseFree, allocated, allocatedSpent)` in `domain/budget` subtracts only the *remaining* planner reserve (`allocated − allocatedSpent`, ≥0) so already-spent plan money isn't double-counted. `useDashboardModel` accumulates `allocatedCents`/`allocatedSpentCents` per planned profile (spent capped at planned) and exposes `model.trueFree`; hero number + today budget now derive from `trueFree.trueFreeCents`. Secondary line under the big number ("de €X na fase · €Y no plano") + a "Reservado p/ planejador" row in the hero mini-breakdown and in the tap-through sheet (`buildFreeToSpendBreakdown(fts, planReserved)` now reconciles to trueFree).
- [x] **Check-in real lens, compact (item 17)**: the hero "livre hoje" is now reframed by the active mode via existing pure `planCheckInDay` (calm trims, night reserves part, no-spend → 0); the complement ("guardado"/"antes da noite") shows as a small primary line. Read-only (ÂNCORA 12): trueFree hero + budget never move, only today's framing; an already-over day (base ≤ 0) keeps its real negative. The check-in result card lost its two tall stat boxes — now a one-line summary + the redistribute/lens payoff.
- [x] **Focus under check-in (item 9)**: `DashboardCards` reorders the *visible* sequence so the lens `focusCardId` (piggy bank / counters) renders right under `daily_checkin` — what sits below the check-in is the day's focus, not always the piggy bank. Pure reposition of an already-visible card (ÂNCORA 9: nothing hidden/removed).
- [x] **Verify**: 977 tests pass (112 files; +7 `true-free` tests covering the 988→574 example, anti-double-count, zero-reserve, negative clamp), tsc --noEmit clean, web build green. No schema change, no new deps, no budget mutation. Deployed to Production (0.42.0).

#### G1 — Navigation & continuity (0.41.0)
Source: Julio field feedback items 1, 2, 12, 15. Swipe must work from the empty background and page between the bottom-nav tabs; sub-pages opened scrolled; recents too tall.
- [x] **Global swipe pager (items 1+2)**: detector lifted to `AppShell` (full-height container) so a swipe from the background pages the tabs. Order is the single source `app/nav-tabs.ts` (Início · Gastos · Viagem · Copiloto; Copiloto drops in simple mode) via new `useTabPaging`. Gestures starting inside a horizontal scroller (carousels, chip rows — detected by computed `overflow-x` + real overflow) or a `data-inpage-swipe`/`data-no-tab-swipe` region are ignored, so carousels/insights keep their natural gesture. FAB overlay marked `data-no-tab-swipe`.
- [x] **In-page handoff**: Expenses (expenses↔outings) and Viagem (phase sequence) keep their internal swipe but, at the first/last sub-tab, hand the gesture to the neighbouring app tab — full bidirectional chain across all 4 tabs. Their swipe roots are tagged `data-inpage-swipe` so the shell pager defers to them (no double-fire).
- [x] **ScrollRestoration (item 12)**: `<ScrollRestoration/>` added in `RootLayout` — forward navigations reset to top (title + back button visible), back restores. Fixes Compras pessoais/planejadas etc. opening pre-scrolled.
- [x] **Compact recents (item 15)**: home "Gastos recentes" card is now one container with dense divided rows (icon + description + date·category + amount), max 3, "ver todos" → full list. Was a tall stack of full-size cards.
- [x] **Verify**: 970 tests pass (111 files; +2 `nav-tabs` order tests), tsc -b clean, web build green. No domain/logic changes, no new deps, no schema change. Deployed to Production (0.41.0).

### Gate 4 — Wise CSV statement import (0.40.0)
Source: user request — import the Wise card statements (3 real .csv files; file 1 == file 2, file 3 empty) as expenses, "best use of the data, without duplicating what already exists". Plan/council DEC-200. Wise = a wallet; the statement is where the card purchases live.
- [x] **Additive schema (no migration)**: `Transaction.externalRef?: string|null` (non-indexed) + `excludeFromLearning?` on `CreateExpenseInput`/`createExpenseTransaction`; zod `externalRef: z.string().nullable().optional()`. A historical batch never skews quick-value learning and a re-import is recognized by ref.
- [x] **Parser `domain/import/wise-csv.ts`**: RFC4180 tokenizer (quoted fields, escaped quotes, embedded newlines), `parseAmountCents` locale-robust (rightmost `.`/`,` is the decimal → handles `1.234,56` and `1,234.56`), `parseWiseDate` (DD-MM-YYYY[+time] → ISO), `parseWiseCsv` maps headers→`WiseStatementRow`, skips malformed/empty.
- [x] **Classifier `domain/import/wise-import.ts`**: cross-file dedupe by `TransferWise ID` (collapses the duplicated file), `guessCategory` (data-driven keyword rules, accent/case-insensitive, stems match inflections while short tokens like `bar`/`pub` stay whole-word), `extractCity` (trailing UPPERCASE merchant tokens), kind = expense|fee|credit (credits shown, never imported), status = new | duplicate_import (ref already on device) | possible_manual_dup (same day+amount as a MANUAL expense → shown unchecked), phase-by-date via `resolveActivePhase`.
- [x] **Orchestrator `commitWiseImport`**: atomic `bulkAdd` of the chosen drafts as expenses (externalRef `wise:<id>`, excludeFromLearning, exchangeRate null → base = amount, exact for the EUR wallet/EUR trip), returns ids for the undo toast (reuses `softDeleteTransactionsBatch`).
- [x] **UI `features/import/WiseImportPage.tsx`** (route `/import/wise`, entry from the Wallets header): multi-file picker → summary (found / new / already-imported / possible-dup / fees / credits) → target wallet chips (existing or one-tap "Wise EUR" creation) → per-row review (checkbox, category icon, merchant, day·city, signed amount, status chip) with select-new / clear-all → sticky "Import N · total" → undo. i18n pt-BR/en/es (`wiseImport.*` + `wallets.import_statement`).
- [x] **Verify**: 968 tests pass (110 files; +24 import tests run against the 3 real statements), tsc -b clean, web build (`WiseImportPage` chunk 15.96 kB) + cap sync + assembleDebug green, APK 0.40.0 (versionCode 14). Deployed to `main.trippilot.pages.dev`.

### Gate 3 — active-outing notification: value buttons + rich fallback (0.39.0)
Source: user report on One UI 7 (Android 15, no Live Update) — the fallback notification regressed: no value buttons, "visually not nice", and it should let you log an expense WITHOUT opening the app, using the SAME quick-add values as the outing screen. Plan/council DEC-199.
- [x] **Native plugin `OutingNotifier`** (`OutingNotificationPlugin.java`): a styled ongoing notification (accent color + colorized + BigTextStyle body computed from the i18n templates) with one action button per quick-add value. State (title, accent, base total, target, avg-drink, locale/currency, templates, the quick list, and the pending queue) lives in SharedPreferences so it can re-render with no WebView.
- [x] **Background tap → no app launch** (`OutingActionReceiver.java`): each button is a broadcast PendingIntent. The receiver enqueues `{amountCents, ts}`, bumps the running total and re-posts the notification — even if the process was killed (Android cold-starts it for the broadcast). Registered in the manifest (`exported=false`).
- [x] **JS reconciliation** (`utils/outing-notification.ts` + `utils/native/outing-notifier.ts`): the fallback branch now calls `OutingNotifier.show(...)` with the first 3 distinct session quick values (Android's action budget) + accent + body templates. `reconcileOutingQuickAdds()` drains the native queue on boot, on `appStateChange(isActive)` and on visibility-visible, persists each via the canonical `quickAddSessionExpense` orchestrator (same record the in-app quick-add and the SW produce), fires `OUTING_CHANGED_EVENT` (open OutingPage reloads) and re-syncs the authoritative total. End-of-outing drains before cancel so a last-second tap is never lost.
- [x] **Cleanup**: `utils/native/notifications.ts` reduced to the permission flow only (the old `LocalNotifications` outing notification + its open-only action listener are replaced by the plugin). `MainActivity` registers the new plugin.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green (native Java compiles), APK 0.39.0 (versionCode 13). Domain untouched; reconciliation reuses the tested orchestrator. Device-pending: tap-to-log on One UI 7.

### Gate 2 — active-outing height + FAB redesign (0.38.0)
Source: user report — (N4) the active-outing screen "lacks height mid-page", pushing quick-add buttons/values below the fold and forcing a scroll despite empty space; (N7) the "+" menu should look "more beautiful, perfect — what you expect from a FAB". Plan/council DEC-198 + DEC-201.
- [x] **N4 — outing fits one screen (DEC-198)**: root cause = the active-session container used `minHeight: 100vh`, but every route renders inside RootLayout's `.app-safe-top` (padding-top: var(--safe-top)), so the page overflowed the viewport by exactly the status-bar band and the bottom `flex-1` spacer pushed the quick-add grid off-screen. Fix: container → `minHeight: calc(100dvh - var(--safe-top))` (matches the AppShell pattern) and the quick-add block clears the system gesture bar with `padding-bottom: calc(var(--safe-bottom) + 12px)`. Header → quick-add now live on one screen.
- [x] **N7 — FAB speed-dial redesign (DEC-201)**: `components/FAB.tsx` reworked into a titled, sheet-like floating panel (grabber + "Ações rápidas" header, rounded 28px, surface card, shadow). The hero action ("Registrar gasto") spans full width with the primary accent (tint bg + ring + 48px chip + forward arrow); the rest read as a clean 2-col grid of tonal tiles (icon chip + label + 1-line desc). Reuses `sheet-up`/`sheet-down` (panel), `.stagger` (per-cell cascade) and the existing scrim. Still clears the (taller, safe-area) nav + center button. Dead `itemBg` field removed from the action model.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.38.0 (versionCode 12). No domain/logic changes; no new deps.

### Gate 1 — post-animation regressions (0.37.0)
Source: user report after 0.36.0 motion — (N1) floating detail sheets opening off-viewport at the page bottom; (N2) page transitions only animating from the 2nd visit; (N3) swipe working one way only and without animation, on Expenses + Trip. Plan/council: `post-animation-fixes-and-wise-import-plan-2026-06-15.md`.
- [x] **N1 — sheets back at the viewport bottom (DEC-195)**: root cause = `.route-view` page animation kept a `transform` at rest (`translate3d(0,0,0)` via `fill-mode: both`), and a non-`none` transform makes the element the containing block for its `position: fixed` descendants → every in-page `BottomSheet` anchored to the tall page bottom instead of the viewport. Fix: (a) page keyframes now end at `transform: none`; (b) `BottomSheet` is `createPortal`-ed to a new `#app-overlay-root` mounted **inside `#root`** (keeps the `cap-native` zoom) but **outside** the routed page (defense in depth). `main.tsx` adds the host.
- [x] **N2 — first-entry transition (DEC-196)**: root cause = `.route-view` wrapper lived in `AppShell`, so on the first visit it mounted empty during the lazy-chunk `Suspense` gap and the enter animation finished before the content arrived (only the cached 2nd visit looked animated). Fix: moved the wrapper into a new `RouteView` **inside** `LazyRoute`'s `Suspense` boundary — a suspending child doesn't commit its parent until resolved, so the wrapper always mounts with content. Removed the duplicate `route-view` from `AppShell` + QuickAdd/Simulator roots.
- [x] **N3 — bidirectional swipe + slide (DEC-197)**: `useHorizontalSwipe` already detected both directions; the gap was zero visual feedback (instant swap) and one-sided guards. Added `.pane-next`/`.pane-prev` keyframes (slide from the side matching travel) and a `paneDir` ref + ordered tab list driving both swipe and tap. `ExpenseListPage` (Expenses ↔ Outings) and `TripHubPage` (phase paging) now wrap their swappable content in a keyed pane that animates on every change, both ways.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.37.0 (versionCode 11). No domain/logic changes; no new deps.

### Motion Gate M1 — app-wide animation system (0.36.0)
Source: user request — "quero que o app tenha transições/animações, que eu me sinta abrindo uma página, componentes animados, fluido e profissional, sem exagero" + bug: FAB "+" shortcuts overlapping the bottom bar. Council (inline) + research → spec `brain/documents/animation-system-spec-2026-06-15.md` (DEC-194). CSS-first (View Transitions API rejected for global/hardware-back fragility; Framer Motion rejected for ~50KB + main-thread cost on mid-tier Android). Every animation is transform/opacity only.
- [x] **Motion tokens** (`styles/tokens.css`): `--motion-fast/base/slow` (120/220/320ms) + M3 curves `--ease-standard`, `--ease-accelerate` (exits) alongside the existing `--ease-out`/`--ease-spring`. `.btn-press` retuned to the token (scale 0.96).
- [x] **Foundation** (`styles/globals.css`): page keyframes (`page-in-fwd`/`page-in-back`), `.stagger` (nth-child cascade), FAB/sheet/toast keyframes, `.nav-ind` active-tab indicator, `.money-pulse`, and a **global `prefers-reduced-motion` reset** (animate skill / WCAG baseline).
- [x] **Page transition (the "open a page" feel)**: `RootLayout` `useNavDirection()` sets `<html data-nav=forward|back>` from `history.state.idx` (covers hardware/gesture back without touching navigate() call sites). `AppShell` wraps the Outlet in `<div key={pathname} class="route-view">` so only the routed content remounts+animates while the chrome stays put. Standalone task pages (QuickAdd, Simulator) get `route-view` on their root (mount-fresh). Outing skipped on purpose (multiple return branches + fullscreen Bar Mode).
- [x] **FAB fix + animation** (`components/FAB.tsx`): bug fixed — actions now clear the taller safe-area nav (`paddingBottom: calc(112px+var(--safe-bottom))`) AND the protruding center button, and the list scrolls internally (`max-h:100dvh`, `overflow-y-auto`) so the lowest item never lands on the bar. Enter = scrim fade + `.stagger`; exit = scrim-out + `.fab-panel-out`, kept mounted via new `useAnimatedPresence` hook.
- [x] **Sheet / toast / nav / money**: `BottomSheet` now animates **closed** too (presence hook, `sheet-up`/`sheet-down`); `Toast` reuses the shared `toast-in`; `BottomNav` active-tab indicator (`.nav-ind`) + `+`/`close` glyph spin; `AnimatedMoney` gains `pulseOnChange` (fires only on a real in-place change) — enabled on the piggy bank + wallet balances (the "money reacts" moment).
- [x] **Reusable hook**: `hooks/useAnimatedPresence.ts` keeps an overlay mounted through its exit (`{mounted, state}`); used by FAB + BottomSheet.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.36.0. No domain/logic changes; no new deps.

### Hotfix Gate H1 — device feedback (0.35.0)
Source: user diagnostics on SM-S918B / Android 15 (0.29.0 build) — `"LocalNotifications.then()" is not implemented on android` crash loop + UI feedback.
- [x] **Notification crash (root cause)**: `utils/native/notifications.ts` `loadPlugin()` returned the
      Capacitor `registerPlugin` proxy **from an async function**. The proxy traps every property get, so
      it looks thenable (`plugin.then` → a function); the Promise machinery then calls `.then()` on it and
      Capacitor throws `"LocalNotifications.then()" is not implemented`. Fired on every permission probe /
      visibility sync → the ~0.5s crash loop that left notifications permanently broken. Fix: `loadPlugin`
      now resolves a **plain holder** `{ plugin }` (non-thenable); all 5 callers updated. Permission
      request + ongoing outing notification now actually run.
- [x] **N1 redo — edge-to-edge safe areas (ALL screens)**: Android 15 forces a transparent overlaid status
      bar that `StatusBar.setOverlaysWebView({overlay:false})` can't fully cancel, so content bled behind it
      and standalone-screen back buttons (expense entry, outing) slid under it. Fix is CSS-driven:
      `--safe-bottom` token added; `.app-status-band` (fixed, `height:var(--safe-top)`, `var(--surface)`,
      z-45, pointer-events:none) paints the inset opaque so nothing shows through; `.app-safe-top` pads
      content. Both live in **RootLayout** so EVERY route (in and out of the shell) is covered. AppShell
      drops its own `pt` (now from RootLayout) and uses `min-h-[calc(100dvh-var(--safe-top))]` to avoid a
      phantom scroll. Toasts offset to `calc(var(--safe-top)+1rem)`.
- [x] **Bottom nav spacing**: `BottomNav` gets `paddingBottom: max(var(--safe-bottom),10px)` (lifts the 4
      buttons above the gesture bar / off the bottom edge); AppShell bottom padding bumped to
      `calc(100px+var(--safe-bottom))` so content still clears the taller bar.
- [x] **Haptics softer (N8 tuning)**: `utils/haptics.ts` impact tiers softened one step (medium→Light,
      heavy→Medium; Light stays Light) and web-vibrate durations reduced — a discrete tick, not a buzz.

## Post-APK Improvements — Phase 1 (Native Shell Hardening)
Master plan: `brain/documents/post-apk-improvements-plan-2026-06-15.md`
Phase 1 package: `brain/documents/phase1-native-execution-package-2026-06-15.md`
Live Update spec: `brain/documents/live-update-nowbar-technical-spec-2026-06-15.md`

### Gate 4 — Android 16 Live Update + Now Bar ✅ (0.34.0) — [device]-pending: promotion/visual on real A16
Master plan Track B / Phase 4 (B1, B2). Spec: `live-update-nowbar-technical-spec-2026-06-15.md`.
- [x] **B1/B2 — Live Update for the active outing**: new custom Capacitor plugin
      `android/.../LiveOutingPlugin.java` (`isSupported`/`update`/`end`, registered in
      `MainActivity`). Posts a **promoted ongoing** notification via `NotificationManagerCompat`
      with `NotificationCompat.ProgressStyle` (a single app-colored segment, spend→target),
      `setRequestPromotedOngoing(true)`, `setShortCriticalText` (status-bar chip), `setColor`
      (app accent), ongoing, dedicated `outing_live` channel (IMPORTANCE_DEFAULT so it can be
      promoted), and an "open" content intent. On One UI 8 this surfaces in the **Now Bar**
      for free (consumes Android 16 Live Updates — no Samsung SDK needed, per spec §3).
- [x] **Adapter + integration (domain stays pure)**: `utils/native/live-outing.ts` wraps the
      plugin (cached `isSupported`, reads `--primary` for the accent, no-op on Web). The
      existing active-outing **notification bridge** (`utils/outing-notification.ts`) now routes
      to the Live Update when supported, else the proven LocalNotifications path.
- [x] **Gating = zero regression**: `isSupported()` returns true only on **API ≥ 36**. On the
      user's current (pre-16) device the LocalNotifications path is untouched; the Live Update
      lights up only where Android 16 exists. Manifest: `POST_PROMOTED_NOTIFICATIONS`. Pinned
      `androidx.core:core:1.17.0` for the Live Update NotificationCompat APIs.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      **assembleDebug BUILD SUCCESSFUL** (native compiles against core 1.17.0), APK 0.34.0.
- **Self-check / regression**: domain untouched; only the infra notification boundary changed,
      behind `isNativeApp()` + `isSupported()`. Web/PWA + tests never load native code.
- **[device]-pending (next)**: real Android 16 validation of promotion (chip), live updates,
      color, Now Bar on Samsung One UI 8; optional B1.1+ (foreground service to survive process
      death, broadcast actions "+ rodada"/"encerrar", richer segments/points per the spec).

### Gate 3 — Gesture navigation + day fast-scroller ✅ (0.33.0) — [device]-pending: G1, G3 feel
Master plan §Phase 3 (G1, G3). Pure web/PWA UI (no native-only code).
- [x] **G1 — Swipe between tabs/phases**: new reusable `hooks/useHorizontalSwipe.ts`
      (decision on touch-end, no preventDefault, requires horizontal dominance 1.5× +
      60px threshold so vertical scroll is never hijacked). Wired into ExpenseListPage
      (swipe ↔ Gastos/Saídas) and TripHubPage (swipe through `['all', ...phases]`,
      clamped at the ends — cross-section bottom-nav swipe stays deferred per the plan).
      The horizontally-scrollable chip rows stop-propagate touch so they keep their own
      scroll instead of paging.
- [x] **G3 — Day fast-scroller (Google-Photos style)**: new `features/expenses/FastScroller.tsx`.
      Window-scrolled feed → a fixed right-edge rail that only mounts when the feed is long
      (≥8 day groups AND >800px overflow). Only the thumb is interactive
      (`pointer-events-none` rail so row taps pass through); grabbing it scrubs the page via
      `window.scrollTo` and a floating bubble shows the day currently under the finger, read
      live from the list's `[data-expense-day]` anchors. ResizeObserver keeps it synced when
      filters/search change the content height.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      assembleDebug BUILD SUCCESSFUL, APK 0.33.0 → Downloads.
- **Self-check / regression**: no domain logic touched; expense list grouping/anchors are a
      pure DOM addition (`data-expense-*`); swipe + scrubber are additive. Filters/search/
      selection bar untouched. `[device]`-pending: gesture feel (thresholds) on real hardware.
- **Next (Gate 4)**: B1 Live Update (foreground service / ProgressStyle), B2 Now Bar.

### Gate 2B — Notifications reorg + day sheet + expense search ✅ (0.32.0)
Master plan §Phase 2 (U1, U4) + §Phase 3 (G2). Pure web/PWA UI (no native-only code).
- [x] **U1 — Notifications center reorg (DEC-090)**: the flat list is now grouped into
      labeled sections — `action` ("Precisa de você": pending_share, phase_over_budget),
      `today` ("Hoje": event_today, long_outing), `reminders` ("Lembretes": backup_due).
      Data-driven via `NOTIFICATION_GROUP`/`GROUP_ORDER`/`GROUP_LABEL_KEY`; empty groups are
      dropped, each header shows a count. Cards keep icon/tone/destination behavior.
- [x] **U4 — Month-map day sheet (DEC-131 moved to Copiloto)**: tapping a day on the
      Copiloto month map opens a `BottomSheet` listing that day's expenses (reuses the model's
      `heatmapDayTxs`, now fed by `heatmapDayIso` state) with per-item navigation + a day total,
      instead of jumping straight to the expense list. Empty day → `copilot.map_day_empty`.
- [x] **G2 — Expense search**: a search input atop the expenses tab filters the feed by
      description / place / translated category (case-insensitive substring). Clear button +
      a dedicated `search_off` empty state (`search_empty_title/body` with the query).
- [x] **i18n**: added `notifications.group_action/today/reminders`, `copilot.map_day_empty`,
      `expenses.search_placeholder/clear/search_empty_title/search_empty_body` (pt/en/es).
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      assembleDebug BUILD SUCCESSFUL, APK 0.32.0 → Downloads.
- **Self-check / regression**: no domain logic changed (UI-only); `heatmapDayTxs` was already
      in the shared model (was `[]` on Home, now actively used by the Copiloto sheet); expense
      filters compose with the existing category/profile/wallet/place chips.
- **Next (Gate 3)**: G1 swipe between tabs/phases, G3 fast-scroll/scrubber.

### Gate 2A — Home/Copiloto reorg + counters ✅ (0.31.0)
Master plan §Phase 2 (U2, U3, U5, U6). Web/PWA + APK (no native-only code in this gate).
- [x] **U5 — Daily analytics → Copiloto (DEC-180 G4)**: removed the `trip_analytics`
      collapsible drawer (yesterday recap + phase burn-down + month heatmap) from the
      Home. Copiloto already rendered the burn-down + month map; added the `RecapCard`
      (yesterday) there too, so ALL intelligence lives in the Copiloto. Removed the Home
      heatmap month/day state, the day-drill `BottomSheet` (DashboardSheets), and the
      `onToggleCollapse`/heatmap props through DashboardPage→DashboardCards. The collapse
      machinery (`isDashboardCardCollapsed`/`toggleDashboardCardCollapsed`/`collapsible`/
      `DEFAULT_COLLAPSED_CARDS=[]`) stays as dormant generic infra (still exported + tested;
      `collapsedDashboardCards` settings field kept → no migration).
- [x] **U6 — Unified occasion counters (DEC-180)**: new pure domain
      `domain/dashboard/occasion-counters.ts` → `buildOccasionCounters` returns ONE
      ordered list: planned metas first (forecasts with `totalPlanned>0` → remaining/done,
      occasion-counted per DEC-115), then per-category ITEM counts for every other category
      with expenses (phase-scoped), each with the unit label "gastos". A category covered by
      a meta is excluded from the activity counts (no double-count). Replaces the old
      forecast-only carousel + the hardcoded 3-cell bar/market/restaurant fallback. Model
      drops `barCount/marketCount/restaurantCount/hasOccasionData`, adds `occasionCounters`.
      5 unit tests (ordering, exclusion, unplanned-as-activity, expense-only, empty).
- [x] **U2 — Trip structure grid**: `TripHubPage` "Estrutura" is now a 3-col grid of icon
      tiles (6 destinations) instead of a vertical list.
- [x] **U3 — Copiloto tools grid**: the bottom "Ferramentas" list is now a 2-col grid of
      cards (icon + label + description).
- [x] **i18n**: added `dashboard.occasion_items` (pt/en/es); removed the now-unused
      `occasion_bar/market/restaurant`. `card_trip_analytics` left dormant (no catalog ref).
- [x] **Verify**: 944 tests pass (108 files), type-check (tsc -b) clean, web build + cap
      sync OK, `assembleDebug` BUILD SUCCESSFUL, APK 0.31.0 → Downloads.
- **Self-check / regression**: dashboard card sequence/hide/move tests updated (catalog no
      longer has `trip_analytics`); occasion card visibility now keys on
      `occasionCounters.length`; the model still computes recap/burndown/heatmap (Copiloto
      consumes them) — only the Home rendering moved. `heatmapDayTxs` left in the model
      (always `[]` now; harmless) to avoid reshaping the shared model.
- **Next (Gate 2B)**: U1 notifications center reorg (cards/groups), U4 month-map day sheet
      in the Copiloto, G2 expense search.

### Gate 1C — DPI calibration + haptics ✅ (0.30.0) — Phase 1 COMPLETE — [device]-pending: N7, N8
- [x] **M1C.1 — Haptics boundary (N8)**: new `utils/haptics.ts` — native uses
      `@capacitor/haptics` (lazy import: `impact` light/medium, `notification`
      success/warning/error); Web/PWA falls back to `navigator.vibrate`. Honors the
      "Vibration" setting via `setHapticsEnabled`, synced live in RootLayout
      (`useHapticsPreference`). Curated triggers: long-press select (`useLongPress`),
      FAB open + tab switch (`BottomNav`), action pick (`FAB`), and every
      success/warning/danger toast (`Toast.showToast` — the single source, info stays
      silent). Migrated the 4 old `navigator.vibrate` sites (didn't fire in the WebView)
      to the boundary and removed the now-redundant `triggerSaveHaptic` + `ALERT_VIBRATION`
      (toast carries those). Fixes "no vibration in the app".
- [x] **M1C.2 — UI scale calibration (N7)** [device]: the WebView rendered ~smaller
      than the installed PWA (Chrome applies the user's page-zoom/font prefs, a fresh
      WebView doesn't). `initNativeShell` tags `<html class="cap-native">`; CSS applies a
      single tunable `zoom: var(--native-zoom)` (default 1.06) on `#root` — scales px+rem
      uniformly (root font-size can't, the design mixes both). No-op on web (class never
      added). Knob lives in `globals.css` for a fast second pass after device check.
- [x] **Verify**: 941 tests pass, type-check (tsc -b) clean, web build OK, `cap sync`
      reports 5 plugins (app, geolocation, haptics, local-notifications, status-bar),
      `assembleDebug` BUILD SUCCESSFUL, APK copied to Downloads.
- **Self-check / regression**: haptics gated by `enabled` flag (off → fully silent) and
      `isNativeApp()` for the plugin branch; web bundle keeps the plugin out via lazy
      `import()`. Toast haptic only on success/warning/danger (no buzz on info). N7 zoom
      scoped to `.cap-native #root` → zero web impact. Changes confined to `utils/haptics.ts`,
      `useLongPress`, `BottomNav`, `FAB`, `Toast`, `RootLayout`, `utils/native/index.ts`,
      `globals.css`, and the 4 migrated feature files (QuickAdd, ExpenseDetail, Outing,
      DashboardCards), plus version files.
- **[device] pending**: N8 real haptic patterns + toggle on a real phone; N7 final zoom
      value (1.06 is a measured-guess — confirm/tune on device).
- **Next (Gate 2A)**: U5 daily analytics → Copiloto, U6 occasion counters model, U2
      structure grid, U3 tools grid.

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
