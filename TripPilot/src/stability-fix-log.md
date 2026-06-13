# Stability Fix Log

## Current State
- Gate: 6 done | Bug: — | Fixed: 20/20 | Tests: 504 (+44) | Build: ✅ index 156 KB (was 729) · no >500 KB chunk warning | Brain ✅ | v0.8.2 deployed

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

## Gate 4 — iOS persistence + data integrity ✅
- [x] BUG-002 requestPersistentStorage checks persisted() + logs estimate when denied (iOS diagnostics). emergency-snapshot.ts: full JSON backup in localStorage every 5 expenses (QuickAddPage) + on outing end (OutingPage). BootGate: empty DB + snapshot → EmergencyRestoreScreen (one-tap restore via importBackup 'replace'); "start fresh" clears snapshot. Dashboard banner reinforced: data present + non-iOS → "backup now" CTA straight to /settings/backup.
  - Note: persistence outcome is NOT stored in synced AppSettings (it is device-local and the banner already uses a live persisted() check). Deviated from "flag nos settings" to avoid sync/backup contamination + redundant boot writes; DONE criteria (clear alert + emergency auto-backup) fully met.
- [x] BUG-013 createTripFromOnboarding orchestrator wraps all 8 inserts in one db.transaction (atomic); OnboardingPage flips activeTrip only after it commits; failure → toast + stay on screen to retry. Extracted DB logic out of the component (cleaner + testable).
- [x] BUG-015 demo-repair profile recreation now gated by settings.isDemo — real trips never get profiles resurrected.
- New: emergency-snapshot.ts, EmergencyRestoreScreen.tsx, onboarding-orchestrators.ts. i18n: recovery.snapshot_* + restore_error, dashboard.storage_backup_now, onboarding.create_error ×3.
- New tests: onboarding-orchestrator (3), emergency-snapshot (4), demo-repair +2 (now 5; kept DEC-111 date tests, replaced old buggy "recreate for ANY trip" with BUG-015 scope) = +9 → 501.

## Gate 5 — Performance ✅
- [x] BUG-007 AppDataProvider (React context) runs the loader ONCE in RootLayout; useAppData() is now a context consumer (throws without a Provider). The Dashboard route no longer loads twice (page + useNotifications). useAppDataState exported for tests.
- [x] BUG-008 DashboardPage 1607 → 267 lines. Heavy budget/insight/heatmap math + async reads moved to useDashboardModel (one big useMemo over the real data inputs, so opening a sheet/swiping a carousel no longer recomputes). Cards → DashboardCards, sheets → DashboardSheets, pure helpers → dashboard-format.ts, InsightDetail.tsx, cards/OccasionCounter.tsx.
- [x] BUG-012 vite manualChunks: named eager vendors (vendor-react/dexie/i18n) + i18n-locales; everything else keeps Rollup's lazy-aware chunking so QR libs stay in the lazy SyncTransferFlow chunk. index 729 → 156 KB; no >500 KB warning. SW already precaches /assets/* on install.
  - Note: stale compiled `vite.config.js` + `vite.config.d.ts` were shadowing `vite.config.ts` (Vite resolves .js first), so the manualChunks edit had no effect until they were deleted. They are orphan artifacts (not regenerated by `tsc -b && vite build`).
- [x] BUG-019 auto-retry cooldown (30s) + max 3 attempts; foreground retry uses a plain reload (no db.close storm). Manual DataErrorScreen retry still does the aggressive close+reopen and resets the budget.
- [x] BUG-020 useBackButtonGuard seeds a history buffer and re-seeds it only on home routes (/, /dashboard) so back there stays in the PWA; sub-page back is untouched. Capacitor (DEC-017) will own App.backButton later.
- New: AppDataProvider.tsx, useDashboardModel.ts, DashboardCards.tsx, DashboardSheets.tsx, dashboard-format.ts, InsightDetail.tsx, cards/OccasionCounter.tsx.
- New tests: app-data-provider (2: single shared load + throws w/o provider), use-app-data-error +1 (BUG-019 cooldown) = +3 → 504.

## Gate 6 — Final ✅
- [x] Tests green: 504/504 (64 files); +44 over the 460 baseline
- [x] tsc -b + vite build clean; index 156 KB, largest chunk vendor-react 287 KB → no >500 KB warning
- [x] Smoke greps: localStorage.(get|set|remove)Item outside safe-storage.ts → 0; navigate() in render body of corrected screens → 0 (all inside handlers; redirects use <Navigate>)
- [x] Verified the deleted vite.config.js/.d.ts do NOT regenerate on build (tsc -b emits nothing for them) — the code-split fix is durable
- [x] Brain updated: DEC-137 (decision-log), Stability Fix Session + status rows (project-status), §27 Stability & Data Safety (product-spec)
- [x] Version bump: package.json + app-version.ts 0.8.1 → 0.8.2
- [x] Deploy: npx wrangler pages deploy dist --project-name=trippilot --branch=main
