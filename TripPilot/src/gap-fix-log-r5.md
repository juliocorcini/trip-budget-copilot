# Gap Fix Log — R5 (Data Reliability + Field Fixes)

## Current State
- Active gate: DONE (GATE 4 complete)
- Requirements done: 9/9
- Tests: 317 unit + 29 e2e green
- Build/typecheck: clean
- Version: 0.5.1

## GATE 0 — Baseline
- [x] DEC-109..113 registered as APPROVED in decision-log.md
- [x] State file created
- [x] Baseline confirmed (R4 close: 299 unit, 29 e2e, clean build)

## GATE 1 — Data reliability (CRITICAL)
- [x] R5-01 useAppData error state + 10s watchdog + DataErrorScreen + welcome guard (Dashboard/QuickAdd) + visibilitychange auto-retry
- [x] R5-02 iOS-safe export (Web Share → deferred-revoke anchor) + try/catch + busy state on all backup handlers
- [x] R5-03 requestPersistentStorage at boot + dashboard banner when not persisted + repairDemoTripIfNeeded date-rewrite gated to isDemo

## GATE 2 — Onboarding
- [x] R5-04 viewport interactive-widget=resizes-content + useKeyboardInset hook + 100dvh layout + scrollIntoView on focus
- [x] R5-05 dedicated phase step: dates (validated in trip range), rhythm preset chips, peak days; createOnboardingEntities extended

## GATE 3 — Planner + nav + gauge
- [x] R5-06 listSessionAdditions/formatAdditionsList (domain) + planner.added_breakdown itemized headline; added_count key removed
- [x] R5-07 deficit = max(0, -liveMargin) (DEC-112); recommendation card renders for any deficit, survives re-entry
- [x] R5-08 back-button headers on SharedExpensesPage, BackupPage, SettingsPage
- [x] R5-09 calculateGaugePosition piecewise (domain) + marker redesign (clamped value pill + ringed dot)

## GATE 4 — Brain + deploy
- [x] 317 unit + 29 e2e green; typecheck/build clean
- [x] decision-log DEC-109..113, project-status updated
- [x] v0.5.1 deployed to Cloudflare Pages

## New tests (R5)
- session-additions.test.ts (6) — field scenario 2+16+5
- gauge-position.test.ts (7) — field scenario 35/45/55 @ 40 + degenerates
- demo-repair.test.ts (3) — real trip dates untouched
- use-app-data-error.test.tsx (2) — error flag + retry recovery

## Extras found (not fixed in R5)
- index chunk > 500 kB (code-splitting opportunity; pre-existing)
