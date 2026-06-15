# Dev Log — TripPilot Implementation

## Current State
- **Active Delivery**: Redesign 2026-06-15 — Navigation & Copiloto (G1–G7)
- **Active Milestone**: G3 DONE → G4 next
- **Last Green Test Run**: G3 (0.22.0)
- **Total Tests**: 913 pass / 0 fail
- **Build Status**: clean
- **Confidence**: 95%

## Redesign 2026-06-15 — Navigation & Copiloto (G1–G7)
Plan: `brain/documents/navigation-redesign-plan-2026-06-15.md`
Copiloto intelligence: `brain/documents/copilot-intelligence-2026-06-15.md`

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
