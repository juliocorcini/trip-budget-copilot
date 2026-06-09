# TripPilot — Product Specification

> Last updated: 2026-06-08

## What is TripPilot?

A travel budget copilot that helps users make spending decisions in real-time during trips. Not just an expense tracker — it answers: **"Can I spend this right now without hurting the rest of my trip?"**

## Core Problem

Existing financial apps look backward ("you spent €42 yesterday"). TripPilot looks forward: "You already spent €28 tonight. One more €7 drink still fits the safe ceiling. After that, stop."

## Target Users

- Travelers staying with family/friends (mixed zero-spend and outing days)
- Budget-conscious travelers managing multi-phase trips
- Groups sharing expenses (Tricount replacement with budget intelligence)
- Anyone who needs to know "how many bar nights can I still afford?"

## V1 Features — In Scope

### 1. Trip & Phase Management
- Create trip with name, dates, base currency
- Create phases (chronological periods within a trip)
- Phases can share a BudgetPool (e.g., two Burgos stays share one €760 fund)

### 2. BudgetPool System
- A fund can serve one or multiple non-consecutive phases
- Protected reserve (visible but not treated as free money)
- Automatic reserve calculation for future linked phases
- Manual floor option with detailed recommendation breakdown
- Global funds (personal shopping, emergencies) separate from phase budgets

### 3. Envelope Budgeting
- Envelopes belong to BudgetPools, not directly to phases
- Types: operational, protected_reserve, personal_shopping, informational
- Personal shopping fund with configurable limit

### 4. Occasion-Based Forecasting (Core Differentiator)
- ActivityProfiles: home day, market, bar, restaurant, outing, transport, festival, special
- Learning engine: weighted average with initial estimates + real data
- Safe estimate calculation (P75 percentile after enough data)
- Confidence levels: low/medium/high
- Contextual dashboard: "4 bar nights left, 5 markets covered, 1 outing available"
- Savings equivalence messaging: "You saved €24 = 73% of a bar night"
- Special occasion marking (doesn't affect learning averages)

### 5. Expense Registration
- Quick-add with minimal fields (value, category, envelope)
- Shared expense support (who paid, who participated, equal or custom split)
- Separate financial flow vs. personal cost tracking
- Cash withdrawal ≠ expense (wallet transfer)
- Debt settlement ≠ new expense

### 6. Simulator ("Can I Spend?")
- Input amount → see impact on everything before committing
- Three risk levels: comfortable / attention / avoid
- Shows: affected profiles, remaining occurrences, margin changes
- Explains in natural language why it recommends or warns

### 7. Outing Mode (Main Differentiator)
- Start outing session with type, ideal target, safe ceiling, max limit, avg drink price
- Quick-add buttons: +€3, +€5, +€7, +€10, +€15, custom (user-editable)
- Cumulative total mode ("€28 so far" — asks: replaces total or adds?)
- Progressive alerts at 50%, 75%, 90%, 100%, >100% with escalating tone
- "Next drink impact" calculation: always visible, shows remaining drinks estimate
- "Amigo sincero" tone: direct and natural, not comic or condescending
- End session: confirm expenses, cash check, shared items check, mark typical/special, update learning

### 8. Scenario Planner
- Interactive [-] N [+] controls for each profile
- Real-time recalculation on every change
- Trade-off suggestions when budget doesn't fit (deterministic scoring, not AI)
- Lock/unlock items (essentials locked by default)
- Never change preferences silently — show alternatives, let user choose
- Two modes: Manual (default — user chooses) + Assisted (app recommends best trade-off)
- Priority presets: Econômico, Equilibrado, Mais Social, Personalizado

### 9. Shared Expenses & Debts
- Participants (local, linkable to accounts later)
- Split engine with equal/custom division
- Debt tracking with simplified settlement suggestions
- Future: shared expenses from other users affect budget provisionally (visible)

### 10. Wallets & Cash
- Multiple wallets (Wise, cash, cards)
- Cash withdrawal tracking (transfer, not expense)
- End-of-day cash reconciliation

### 11. Backup & Export
- JSON backup/import (manual device transfer)
- Two import modes: Merge (default) or Replace all local data
- Conflict resolution: same ID, different versions → user chooses (keep local / use imported / compare)
- CSV export for spreadsheets (17 fields per expense)
- Pre-import summary: version, date, device origin, new/updated/conflicting records
- Backup age warning with periodic reminder

### 12. PWA Features
- Installable on home screen
- Offline-first (all data in IndexedDB)
- Request persistent storage
- Safe update notifications
- Shortcuts: /quick_add, /outings/new, /outings/active

## V1 — Explicitly NOT in Scope

- Login / user accounts / authentication
- Remote database or backend
- Automatic sync between devices
- Bank integration (Wise API, etc.)
- PDF/receipt import
- AI/LLM features inside the app
- Play Store / App Store publication
- Native iOS app
- Android widget
- Remote push notifications
- Social features / gamification
- Map visualization
- Subscription/monetization system
- Kotlin native implementation

## Core Rules

1. **Simple daily average is a secondary indicator only** — occasion-based forecasting drives the product
2. **Financial flow ≠ personal cost** — always track both separately
3. **Cash withdrawal ≠ expense** — it's a wallet transfer
4. **Debt settlement ≠ new expense** — it closes an existing obligation
5. **Protected reserve ≠ free money** — visible but never suggested for casual spending
6. **Personal shopping never silently reduces daily budget** — separate global BudgetPool (DEC-041)
7. **No silent preference changes** — always show impact, offer alternatives, let user decide
8. **Every number must be explainable** — user can tap any value and see the calculation
9. **The app should also encourage spending** — "You saved enough for an extra bar night!" is as important as warnings
10. **No personal data in public build** — app starts empty, user imports private backup
11. **All code in English** — variable names, comments, function names
12. **Mobile-first design** — large buttons, minimal forms, readable on small screens
13. **Never block registration** — budget at zero, outing over max, phase boundary crossed → warn, don't block (DEC-053)
14. **Never delete history silently** — "Registrar total atual" creates reconciliation adjustment, not replacement (DEC-046)
15. **The app is generic** — no hardcoded references to Julio, Burgos, or any specific trip. All personal data via private import
16. **Wallet selection is optional** — missing wallet marked as "Carteira não informada" for later review (DEC-051)
17. **Protected reserve single source** — stored as Envelope (kind: protected_reserve), never duplicated as BudgetPool field (DEC-042)

## Onboarding

Minimal required: trip name, phase name, start/end dates, currency, amount, optional protected reserve → dashboard.
Profiles, participants, wallets, extra phases configured later. Presets available: Hospedado com família, Viagem urbana, Festival, Personalizado.
See DEC-036, DEC-037.

## Data Model Key Rules

- Phase can exist without BudgetPool (DEC-039)
- Phase can access multiple BudgetPools; each expense → exactly one pool (DEC-040)
- BudgetPool has scope: "global" (e.g., personal shopping) or "linked_phases" (DEC-041)
- ScenarioAllocationItem = aggregate planned quantity; PlannedOccurrence = specific event with optional date (DEC-043)
- ActivityProfile stores: typical value, safe value, confidence, optional frequency. Three-limit (meta/teto/máx) only in Outing Mode sessions (DEC-044)

## MVP Screens

### Core Flow (mobile-first)
1. **Welcome** — First launch: create trip / import backup / load demo
2. **Onboarding Wizard** — Trip setup → phases → budget → profiles → preferences (multi-step)
3. **Phase Dashboard** — THE main screen: today's status, occasions remaining, quick actions, pending alerts
4. **Trip Overview** — All phases, total budget, spending timeline
5. **Add Expense** — Bottom sheet: quick form with optional sharing
6. **Expense Detail** — View/edit single expense, see impact
7. **Outing Mode** — Start → active session (quick buttons + alerts) → end/confirm
8. **Simulator ("Can I Spend?")** — Amount input → full impact preview
9. **Scenario Planner** — Interactive trade-offs with [-] N [+] controls

### Supporting Screens
10. **Expense List** — Filterable by phase, category, date range, shared
11. **Shared Expenses & Debts** — Who owes whom, pending confirmations, settlements
12. **Wallets** — Manage wallets, cash reconciliation
13. **Reports** — Spending by category, timeline, profiles, savings equivalence
14. **Settings** — Alert tone, currency, preferences, about
15. **Backup & Data** — Export/import JSON, export CSV, backup status
16. **Trip/Phase Editor** — Edit existing trips, phases, budget pools

---

*See [decision-log.md](decision-log.md) for all approved decisions. See [technical-direction.md](technical-direction.md) for stack details. See [implementation-phases.md](implementation-phases.md) for delivery order.*
