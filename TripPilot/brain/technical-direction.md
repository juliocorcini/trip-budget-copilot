# TripPilot — Technical Direction

> Last updated: 2026-06-08

## Stack (LOCKED — DEC-003)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI Framework | React 19 | Julio's JS expertise, large ecosystem |
| Language | TypeScript (strict) | End-to-end type safety |
| Build Tool | Vite | Fast dev server, optimized builds |
| Styling | Tailwind CSS | Utility-first, mobile-friendly |
| Local DB | IndexedDB via Dexie | Structured storage, reactive queries |
| State | Zustand | Lightweight, no boilerplate |
| Forms | React Hook Form + Zod | Validation + type inference |
| Dates | date-fns | Tree-shakeable, no moment.js weight |
| Unit Tests | Vitest | Vite-native, fast |
| Component Tests | React Testing Library | User-centric testing |
| E2E Tests | Playwright | Cross-browser PWA testing |
| PWA | vite-plugin-pwa (Workbox) | Service worker, manifest, offline cache |
| Hosting | Cloudflare Pages | Free tier, auto-deploy, Functions support |
| IDs | UUID v4 | Globally unique, merge-safe |
| Router | React Router v7 (Data Mode) | createBrowserRouter, sufficient for MVP |
| i18n | react-i18next | pt-BR initial, en/es structure prepared |
| Linting | ESLint + Prettier | Code consistency |

## Architecture Principles

1. **Local-first, offline-capable** — All data in IndexedDB, works without internet
2. **Domain logic is pure TypeScript** — No financial calculations in React components
3. **Orchestrator pattern** — Engines coordinate smaller functions
4. **Data model prepared for sync** — SyncMetadata (revision, deletedAt, sourceDeviceId) on all entities
5. **Cents-based money** — All amounts stored as integers (€12.34 = 1234)
6. **Explicit timestamps** — ISO 8601, local timezone considered
7. **Schema versioned** — Dexie migrations for IndexedDB schema changes

## Project Structure

```
src/
  app/                    # Routes, providers, layouts
  domain/                 # Pure business logic (NO React)
    budget/               # budget-engine, forecast-engine, simulation-engine
    learning/             # profile-learning-engine, statistics
    splitting/            # split-engine, settlement-engine
    wallets/              # wallet-engine
    sessions/             # session-engine, alert-engine
    scenarios/            # scenario-planner, tradeoff-engine
  data/                   # Persistence layer
    db/                   # Dexie database, schema, migrations
    repositories/         # Data access
    backup/               # Export/import JSON, CSV
  features/               # Feature modules (UI + hooks)
    onboarding/
    dashboard/
    trips/
    phases/
    expenses/
    simulator/
    sessions/
    participants/
    settlements/
    wallets/
    planning/
    reports/
    settings/
    backup/
  components/             # Shared UI components
  hooks/                  # Shared hooks
  utils/                  # Utilities (money formatting, etc.)
  styles/                 # Global styles
  pwa/                    # PWA config
```

## Database (IndexedDB via Dexie)

### Core Entities
Trip, Phase, BudgetPool, BudgetPoolPhaseLink, Envelope, Participant, Wallet, Transaction, ParticipantShare, Session, ActivityProfile, PlannedOccurrence, Settlement, ForecastSnapshot, AlertRule, AppSettings, ScenarioPlan, FuturePhaseReservePolicy, Device, Actor

### Future Entities (types defined, not persisted yet)
UserAccount, Group, GroupMembership, SharedExpenseConfirmation

### Key Design Rules
- All entities have SyncMetadata (id, createdAt, updatedAt, deletedAt, revision, sourceDeviceId)
- Soft delete (deletedAt) for merge-safe operations
- JSON backup includes schema version for migration compatibility

## Deployment

```
React + Vite → Build → Cloudflare Pages (static)
                         ↓
                    PWA installed on phone
                         ↓
                    IndexedDB local storage
```

No server, no monthly cost, no remote database.

## Future Expansion Path

1. **Capacitor** → Same React codebase → APK with local notifications (DEC-017)
2. **Cloudflare Functions** → API endpoints when backend is needed
3. **Supabase/D1** → Remote DB for multi-user sync
4. **Multi-currency** → Data model already supports it (DEC-021)

## Testing Strategy (from Delivery 1)

- **Vitest**: Domain logic — budget calculations, splits, withdrawals, settlements, multi-phase pools, reserves, backup/import
- **React Testing Library**: Critical UI components
- **Playwright**: Main user flows (create trip, register expense, backup/restore)
- Priority: domain correctness first, then UI, then E2E

## i18n Strategy

- react-i18next from Delivery 1
- pt-BR as initial language, en/es structures prepared (empty)
- No hardcoded user-facing strings in components
- Code (variables, comments, functions) always in English

## Deployment Notes

- Cloudflare Pages handles SPA routing by default
- No _redirects needed initially; add only if refresh fails on sub-routes after testing
- Test direct refresh on: /quick_add, /outings/new, /outings/active, /simulator

## Development Methodology

- Tier 3 velocity standard (brain + phases + AI = ~3.3× compression)
- Phase-delivery packages with gate checkpoints
- Director-style delegation (Carol plans → specialists implement)
- Jessica reviews all schema decisions
- Domain logic tested before UI implementation

---

*Stack decisions are LOCKED. Changes require new DEC entry with council review.*
