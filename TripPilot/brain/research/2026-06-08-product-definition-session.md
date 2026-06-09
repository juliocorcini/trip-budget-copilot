# TripPilot — Product Definition Session

> Date: 2026-06-08
> Methodology: Product discovery conversation based on real travel expense analysis
> Scope: Full product definition from concept to MVP specification
> Source: `base.txt` (raw conversation with 4 addenda)

## Context

Julio analyzed his 2024 European trip expenses (Burgos, Eurotrip, Tomorrowland) using Wise statements and Tricount data. Total tracked: ~€3,682.50 via Wise. The analysis revealed that existing apps (Tricount, Splitwise) only answer "who paid what?" but not "can I afford this right now?"

## Key Findings

### 2024 Spending Patterns (Burgos, 37 days)
- Daily average: €12–€15/day (including zero-spend days)
- ~19 days with spending, ~18 days with zero direct spending
- Typical spending day: ~€22
- Market (group total): €247.55 | Restaurants/snacks: €120.06 | Bars: €19.80
- Personal shopping (Zara, Lefties): €175 — distorted daily averages when mixed

### Competitor Analysis
- **TravelSpend**: Closest competitor. Has daily budget recalculation, surplus/deficit, exclude-from-average. Missing: outing mode, progressive alerts, "can I spend?" simulator, occasion-based forecasting
- **Daily Budget Original**: Similar rolling average concept but focused on recurring personal budget, not travel
- **Tricount/Splitwise**: Good at splitting, no budget intelligence

### Core Insight
No existing app answers in real-time: "Can I order another €7 drink without hurting the rest of my trip?" — this is TripPilot's unique value.

## Product Decisions Made

| # | Decision | Status |
|---|----------|--------|
| 1 | PWA first (React + TS + Vite), no Kotlin initially | APPROVED |
| 2 | Local-first with IndexedDB/Dexie, no backend | APPROVED |
| 3 | Hosting: Cloudflare Pages (free tier) | APPROVED |
| 4 | Occasion-based forecasting, NOT simple daily average | APPROVED |
| 5 | BudgetPool can span multiple non-consecutive phases | APPROVED |
| 6 | Trip → Phase → BudgetPool → Envelope hierarchy | APPROVED |
| 7 | Outing Mode as core differentiator | APPROVED |
| 8 | Scenario Planner with trade-off suggestions | APPROVED |
| 9 | Three-limit system: ideal / safe ceiling / max | APPROVED |
| 10 | Personal shopping in separate fund, doesn't affect daily budget | APPROVED |
| 11 | "Amigo sincero" alert tone (natural, direct, not comic) | APPROVED |
| 12 | JSON backup/import between devices (no sync yet) | APPROVED |
| 13 | CSV export for spreadsheets | APPROVED |
| 14 | No personal data in public bundle | APPROVED |
| 15 | Demo seed with fictional data only | APPROVED |
| 16 | Capacitor for Android APK later | APPROVED |
| 17 | Future multi-user: each person has own account | APPROVED |
| 18 | Shared expenses affect budget provisionally (visible) | APPROVED |

## Data Model Summary (Final)

Core entities: Trip, Phase, BudgetPool, BudgetPoolPhaseLink, Envelope, Participant, Wallet, Transaction, ParticipantShare, Session, ActivityProfile, PlannedOccurrence, Settlement, ForecastSnapshot, AlertRule, AppSettings, ScenarioPlan, FuturePhaseReservePolicy, Device, Actor

Key interfaces defined: SimulateExpenseInput/Result, ScenarioAllocationItem, TradeoffSuggestion, FuturePhaseReserveSuggestion, MoneyValue, SyncMetadata

## Stack Locked

React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), Zustand, React Hook Form, Zod, date-fns, Vitest, React Testing Library, Playwright, vite-plugin-pwa, Cloudflare Pages

## Implementation Order (6 Deliveries)

1. Base: Trip/Phase/BudgetPool/Envelope, expense tracking, dashboard, JSON backup
2. Shared expenses, splits, debts, settlements, cash wallet
3. Activity profiles, learning engine, scenario planner, simulator
4. Outing mode with quick buttons and progressive alerts
5. PWA offline, persistent storage, deployment
6. (Later) Capacitor, APK, local notifications, widget

## Seed Data for First User (Private, NOT in public build)

- Trip: Europa 2026
- BudgetPool: Burgos 2026 (€760 total, €100 protected reserve)
- Phases: Burgos pre-eurotrip (07/06–15/07), Burgos post-eurotrip (05/08–15/08)
- Personal shopping fund: €100
- August floor: €170 manual minimum
- Participants: Julio, Bruno, Debora
- Alert tone: "amigo sincero"

## Impact on Brain Files

- `product-spec.md` → Complete rewrite with full MVP spec
- `decision-log.md` → 18+ new decisions added
- `technical-direction.md` → Stack fully locked
- `competitive-landscape.md` → TravelSpend analysis added
- `implementation-phases.md` → 6 deliveries defined
- `project-status.md` → Updated to reflect planning complete
