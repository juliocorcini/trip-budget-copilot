# Stability Fix Log

## Current State
- Gate: 3 done | Bug: — | Fixed: 12/20 | Tests: 492 (+32) | Build: ✅ (index 705 KB warning — BUG-012/Gate 5)

## Gate 0 — Baseline
- [x] Node 22.22.3
- [x] npx tsc --noEmit → 0 errors
- [x] npm run test → 460/460
- [x] npm run build → ok (index 635 KB chunk warning noted)
- [x] State file created

## Gate 1 — Boot/Onboarding (P0) ✅
- [x] BUG-001 BootGate guard on `/` + WelcomePage redirect + TripRecoveryScreen
- [x] BUG-003 appSettings.get() non-destructive + update() self-heals null
- [x] BUG-004 TripOverview/TripEdit/Wallets: error → DataErrorScreen, declarative Navigate
- [x] BUG-009 declarative <Navigate> in Dashboard + 3 pages (no navigate() in render)
- [x] BUG-014 Rescue/Simulator/SharedExpenses/Outing error+loading+Navigate guards
- New components: BootGate, TripRecoveryScreen, LoadingScreen. i18n: recovery.* ×3.
- New tests: app-settings-repository.test.ts (5), boot-recovery.test.tsx (8) = +13 → 473.

## Gate 2 — Safety net ✅
- [x] BUG-005 safeLocalStorage helper + getDeviceId (memory fallback)
- [x] BUG-018 outing-notification + QrScanner via safeLocalStorage (grep=0 outside helper)
- [x] BUG-010 formatMoney never throws (regex guard + try/catch + plain fallback)
- [x] BUG-016 toSafeIsoDate in dates domain + QuickAdd uses it
- [x] BUG-017 ErrorBoundary telemetry (crash-log buffer) + loop detection + clear-cache/export; window error+rejection handlers in main.tsx
- New: safe-storage.ts, crash-log.ts, emergency-backup.ts, toSafeIsoDate. i18n: errors.boundary_persistent_* ×3.
- New tests: safe-storage (3), crash-log (5), money +4, dates +2 = +14 → 487.

## Gate 3 — Service Worker hardening ✅
- [x] BUG-006 SW openDb opens version-less (attaches to Dexie's schema), aborts empty-DB creation (oldVersion===0), onblocked rejects, onversionchange closes; hasStores() guard before every tx; whole notificationclick wrapped in try/catch. CACHE_NAME v7→v8.
  - Note: chose version-less open over a hardcoded SW version — a stale SW constant would throw VersionError or trigger a bad upgrade. Version-less + abort-on-create + onversionchange meets both DONE criteria (never empty DB, never blocks upgrade) safely.
  - SW is vanilla JS (no .ts), not importable in vitest/jsdom → covered by code review + Gate 6 smoke test rather than a unit test.
- [x] BUG-011 sw-reload.ts guard: controllerchange defers reload while an outing is active (toast pwa.update_deferred_outing), OutingPage flips the flag and applies the pending reload when the session ends.
- New: sw-reload.ts. i18n: pwa.update_deferred_outing ×3.
- New tests: sw-reload (5) = +5 → 492.

## Gate 4 — iOS persistence + data integrity
- [ ] BUG-002 iOS persistence warning + emergency auto-backup
- [ ] BUG-013 atomic onboarding transaction
- [ ] BUG-015 demo repair scoped to demo trips

## Gate 5 — Performance
- [ ] BUG-007 AppDataProvider shared context
- [ ] BUG-008 DashboardPage decomposition + memoization
- [ ] BUG-012 manualChunks + lazy routes < 300 KB main
- [ ] BUG-019 visibilitychange retry debounce/cooldown
- [ ] BUG-020 Android back button on root

## Gate 6 — Final
- [ ] Tests green (460 + new)
- [ ] tsc + build clean (no >500 KB chunk)
- [ ] Brain updated
- [ ] Version bump + deploy
