# Stability Fix Log

## Current State
- Gate: 0 | Bug: — | Fixed: 0/20 | Tests: 460 | Build: ✅ (index 635 KB warning)

## Gate 0 — Baseline
- [x] Node 22.22.3
- [x] npx tsc --noEmit → 0 errors
- [x] npm run test → 460/460
- [x] npm run build → ok (index 635 KB chunk warning noted)
- [x] State file created

## Gate 1 — Boot/Onboarding (P0)
- [ ] BUG-001 start_url + WelcomePage redirect/boot guard + recovery screen
- [ ] BUG-003 appSettings.get() non-destructive + update() guard
- [ ] BUG-004 TripOverview/TripEdit/Wallets check error → DataErrorScreen
- [ ] BUG-009 no navigate() in render body (declarative <Navigate>)
- [ ] BUG-014 Rescue/Simulator/SharedExpenses/Outing error+loading guards

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
