# TripPilot — Implementation Phases

> Last updated: 2026-06-08

## Phase Strategy

Six deliveries, ordered by user value. Each builds on the previous. The first delivery should be usable immediately.

**Velocity**: Tier 3 (brain + phases + AI = ~3.3× compression)

---

## Delivery 1 — Usable Foundation

**Goal**: Register expenses, see budget status, backup data

**Scope**:
- Project setup: React + TypeScript + Vite + Tailwind + React Router v7 + react-i18next + Zustand
- IndexedDB with Dexie (full schema, migrations, sync metadata)
- Core entities: Trip, Phase, BudgetPool (with scope field), BudgetPoolPhaseLink, Envelope (protected_reserve + allocation)
- Participants (name + nickname), Wallets (optional selection, "Carteira não informada" tracking)
- Expense registration: quick-add with optional wallet, categories, fund selection
- Dashboard: "Livre para usar" hero, fund balance breakdown, protected reserve, future floor, personal shopping card, recent expenses, FAB menu (6 actions). Cards for occasions/savings/amigo sincero/outing HIDDEN until engines exist (DEC-055)
- "Planejar" tab: basic editor for phases, funds, reserves, future floor, personal shopping, initial profiles (DEC-055)
- JSON backup export/import (merge + replace + conflict resolution)
- CSV export (17 basic fields + 6 advanced optional)
- Welcome screen: create trip (minimal onboarding) / import backup / load demo data
- Demo data: complete fictional trip per DEC-038
- Mobile-first responsive layout with design system tokens
- i18n: pt-BR strings via react-i18next (en/es empty structures)
- Tests: Vitest (domain), RTL (critical components), Playwright (main flows)
- Settings: alert tone, default wallet, vibration toggle, backup reminder, theme, language, device name
- "Mais" tab: sectioned list (Viagem, Dados, Aplicativo)

**Acceptance Criteria**:
- User can create a trip with phases and budget via minimal onboarding
- User can register expenses (with/without wallet) and see "Livre para usar" decrease
- Personal shopping fund works independently from phase budget
- Protected reserve is stored as Envelope, displayed correctly on dashboard
- Phase can access multiple BudgetPools
- User can export and import JSON backup with merge/conflict resolution
- CSV export produces correct 17-field output
- Demo data loads and is clearly marked
- App works on phone browser with design system applied
- All domain calculations have unit tests
- i18n strings externalized (no hardcoded Portuguese in components)

**Estimated Hours**: ~40h (Tier 3: ~13h)

---

## Delivery 2 — Real-World Splitting

**Goal**: Handle shared expenses correctly (replace Tricount for trips)

**Scope**:
- Shared expense registration (who paid, who participated)
- ParticipantShare with equal/custom split
- Debt tracking (who owes whom, how much)
- Debt settlement (without creating new expense)
- Simplified settlement suggestions
- Cash withdrawal (wallet transfer, not expense)
- Cash spending tracking
- Merge-safe JSON import with conflict resolution

**Acceptance Criteria**:
- Shared market of €60 among 3 people → personal cost = €20
- Cash withdrawal doesn't change budget
- Debt settlement doesn't create new expense
- Import from another device merges without data loss

**Estimated Hours**: ~25h (Tier 3: ~8h)

---

## Delivery 3 — Intelligent Forecasting

**Goal**: Occasion-based predictions, scenario planning

**Scope**:
- ActivityProfiles with learning engine
- Weighted average with initial estimates
- Safe estimate calculation (P75 when enough data)
- Confidence levels (low/medium/high)
- Market frequency prediction
- Future phase reserve with 3 levels (essential/recommended/comfortable)
- Manual floor for future phase
- Scenario Planner with [-]/[+] controls
- Lock/unlock items
- Trade-off suggestions with explanations
- Simulator "Can I Spend?" with risk levels
- Dashboard update: occasions remaining, contextual recommendations

**Acceptance Criteria**:
- Dashboard shows "4 bar nights left, 5 markets covered"
- Simulator correctly calculates impact and shows risk level
- Scenario planner recalculates instantly on changes
- Future phase reserve protects money for later stays

**Estimated Hours**: ~35h (Tier 3: ~12h)

---

## Delivery 4 — Outing Mode

**Goal**: Real-time spending control during nights out

**Scope**:
- Start outing session (type, targets, drink price, alert tone)
- Quick-add buttons (+€3, +€5, +€7, +€10, +€15, custom)
- Cumulative total tracking with replacement option
- Progressive alerts (50%, 75%, 90%, 100%, >100%)
- "Next drink impact" calculation
- "Amigo sincero" tone messages
- End session: confirm, mark typical/special, update profiles
- Session history and learning

**Acceptance Criteria**:
- User can track a bar night with quick taps
- Alert at 90%: "One more €7 drink and you'll hit the safe ceiling"
- At >100%: "Julio, time to stop. Water now."
- Special session doesn't distort typical bar average

**Estimated Hours**: ~20h (Tier 3: ~7h)

---

## Delivery 5 — Production PWA

**Goal**: Installable, offline, deployed

**Scope**:
- PWA manifest with icons
- Service worker with offline cache (Workbox)
- Safe update mechanism (don't force during expense entry)
- Persistent storage request (navigator.storage.persist())
- PWA shortcuts (/quick_add, /outings/new, /outings/active)
- Deploy to Cloudflare Pages
- Android installation testing
- Small screen verification
- Backup age warning
- Theme: light + dark mode
- Accessibility basics (contrast, tap targets)

**Acceptance Criteria**:
- PWA installs on Android and works offline
- Cloudflare Pages deployment succeeds
- Data persists across browser restarts
- Backup reminder after 7 days without export

**Estimated Hours**: ~15h (Tier 3: ~5h)

---

## Delivery 6 — Native Layer (Post-MVP)

**Goal**: Android APK with reliable local notifications

**Scope**:
- Add Capacitor to existing project
- Generate APK
- Local notification scheduling during outings
- Cancel notifications when session ends
- Possible Android widget (future)

**Acceptance Criteria**:
- APK installs on Android
- Outing reminders fire reliably with app in background
- Existing PWA features continue working

**Estimated Hours**: ~15h (Tier 3: ~5h)

---

## Total Estimates

| Delivery | Raw Hours | Tier 3 | Status |
|----------|:---------:|:------:|--------|
| 1 — Foundation | 40h | ~13h | NOT STARTED |
| 2 — Splitting | 25h | ~8h | NOT STARTED |
| 3 — Forecasting | 35h | ~12h | NOT STARTED |
| 4 — Outing Mode | 20h | ~7h | NOT STARTED |
| 5 — Production PWA | 15h | ~5h | NOT STARTED |
| 6 — Native Layer | 15h | ~5h | NOT STARTED |
| **Total** | **150h** | **~50h** | — |

## V2 Roadmap (Post-MVP)

- Login + user accounts
- Remote sync (Supabase or Cloudflare D1)
- Multi-user groups with shared expenses
- Multi-currency with live rates
- Wise CSV/PDF import
- Receipt scanning
- Android widget
- Remote push notifications
- Spending insights with patterns
- Trip templates/presets

---

*Phases will be executed via `/deliver` with self-contained START-HERE.md packages.*
