# Stability Fix Log

## Current State
- Gate: 1 done | Bug: — | Fixed: 5/20 | Tests: 473 (+13) | Build: ✅ (index 635 KB warning)

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

## Gate 2 — Safety net
- [ ] BUG-005 safeLocalStorage helper + getDeviceId
- [ ] BUG-018 outing-notification + QrScanner via safeLocalStorage
- [ ] BUG-010 formatMoney never throws
- [ ] BUG-016 QuickAdd customDate validation
- [ ] BUG-017 ErrorBoundary telemetry + anti-loop

## Gate 3 — Service Worker hardening
- [ ] BUG-006 SW openDb versioned + onblocked + store guards
- [ ] BUG-011 deferred reload during active outing

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
