# TripPilot — Delivery 1: Detailed Milestone Plan

> Version: 1.0 | Date: 2026-06-08
> Author: Carol (System Planner)
> Status: READY FOR START-HERE.md GENERATION
> Source: master-spec-d1.md, database-schema.md, decision-log.md (60 decisions)

---

## 1. Delivery 1 Overview

**Goal**: Register expenses, see budget status, backup data — fully styled and tested.

**Estimated effort**: 40h raw / ~13h Tier 3 (3.3× compression)

**Gate structure**: 2 gates × 6 milestones = 12 milestones total

**Success criteria**: All items from Appendix C of master-spec-d1.md pass.

---

## NON-NEGOTIABLES

- All money values stored as integer cents (DEC-020)
- Protected reserve is Envelope with `kind: "protected_reserve"` — NEVER a BudgetPool field (DEC-042)
- Personal shopping = separate global BudgetPool, not an envelope (DEC-041)
- Dashboard shows only implemented features — no fake/placeholder data (DEC-055)
- Wallet selection optional — "Carteira não informada" when skipped (DEC-051)
- Never block registration — warn + confirm at zero budget (DEC-053)
- All user-facing text via `t()` function — no hardcoded Portuguese in components (DEC-054)
- Domain logic is pure TypeScript — no financial calculations in React components
- Soft delete with `deletedAt` on all entities (DEC-004)
- Code always in English; UI always in Portuguese via i18n

---

## 2. Gate 1 — Foundation (Milestones 1–6)

> Focus: Project structure, domain types, data layer, business logic engines, backup system, onboarding.
> All domain logic tested before any UI work begins.

---

### M1: Project Scaffold + Design Tokens

**What**: Initialize the project with all dependencies, configuration, routing shell, i18n skeleton, Dexie database, and the complete design system as CSS variables.

**Files created**:
- `package.json` — all dependencies with locked versions
- `vite.config.ts` — Vite configuration with path aliases
- `tsconfig.json` — strict mode TypeScript config
- `tailwind.config.ts` — Tailwind with design system token integration
- `postcss.config.js` — PostCSS for Tailwind
- `index.html` — SPA entry point with Manrope + JetBrains Mono fonts
- `src/main.tsx` — React root with providers
- `src/app/router.tsx` — React Router v7 Data Mode with all D1 routes as stubs
- `src/app/providers.tsx` — App providers wrapper
- `src/styles/tokens.css` — All CSS variables from design system (colors, typography, spacing, radii, shadows)
- `src/styles/globals.css` — Tailwind directives + base styles
- `src/data/db/database.ts` — Dexie class with full schema v1 (21 tables)
- `src/data/db/schema.ts` — SCHEMA_V1 constant with all indexes
- `src/i18n/index.ts` — react-i18next configuration
- `src/i18n/locales/pt-BR.json` — Portuguese translation keys (navigation, common labels)
- `src/i18n/locales/en.json` — English structure (empty values)
- `src/i18n/locales/es.json` — Spanish structure (empty values)
- `.eslintrc.cjs` + `.prettierrc` — Linting configuration

**Acceptance criteria**:
- [ ] `npm run dev` starts without errors
- [ ] Router renders placeholder page at `/dashboard`, `/expenses`, `/more`, `/settings`
- [ ] Dexie opens IndexedDB `TripPilotDB` without errors, `appSettings` seeded
- [ ] `t('nav.dashboard')` renders "Início" (Portuguese)
- [ ] CSS variables `--surface`, `--primary`, `--on-surface` are accessible in components
- [ ] Manrope and JetBrains Mono fonts load correctly
- [ ] TypeScript strict mode passes with zero errors
- [ ] `npm run build` produces a valid production bundle

**Tests**: None (scaffold only — verified by build success).

**Dependencies**: None (first milestone).

---

### M2: Domain Types + Core Utilities

**What**: All TypeScript interfaces from database-schema.md, Zod validation schemas, money utilities (cents conversion, formatting, splitting), and date utilities.

**Files created**:
- `src/domain/types/common.ts` — SyncMetadata, all literal union types (TripStatus, BudgetPoolScope, EnvelopeKind, ConfidenceLevel, WalletType, TransactionType, ShareType, SessionStatus, AlertTone, ThemePreference, AlertType, TransactionCategory, etc.)
- `src/domain/types/trip.ts` — Trip interface
- `src/domain/types/phase.ts` — Phase interface
- `src/domain/types/budget-pool.ts` — BudgetPool interface
- `src/domain/types/budget-pool-phase-link.ts` — BudgetPoolPhaseLink interface
- `src/domain/types/envelope.ts` — Envelope interface
- `src/domain/types/participant.ts` — Participant interface
- `src/domain/types/wallet.ts` — Wallet interface
- `src/domain/types/transaction.ts` — Transaction interface
- `src/domain/types/activity-profile.ts` — ActivityProfile interface
- `src/domain/types/session.ts` — Session, SessionItem interfaces
- `src/domain/types/scenario.ts` — ScenarioPlan, ScenarioAllocationItem interfaces
- `src/domain/types/planned-occurrence.ts` — PlannedOccurrence interface
- `src/domain/types/participant-share.ts` — ParticipantShare interface
- `src/domain/types/settlement.ts` — Settlement interface
- `src/domain/types/forecast.ts` — ForecastSnapshot, FuturePhaseReservePolicy interfaces
- `src/domain/types/alert-rule.ts` — AlertRule interface
- `src/domain/types/app-settings.ts` — AppSettings interface
- `src/domain/types/device.ts` — Device interface
- `src/domain/types/backup.ts` — TripPilotBackup, ImportSummary interfaces
- `src/domain/types/index.ts` — Barrel export
- `src/domain/validation/trip.schema.ts` — Zod schemas for Trip, Phase
- `src/domain/validation/budget.schema.ts` — Zod schemas for BudgetPool, Envelope, BudgetPoolPhaseLink
- `src/domain/validation/transaction.schema.ts` — Zod schema for Transaction
- `src/domain/validation/participant.schema.ts` — Zod schemas for Participant, Wallet
- `src/domain/validation/settings.schema.ts` — Zod schema for AppSettings
- `src/domain/validation/index.ts` — Barrel export
- `src/domain/money/cents.ts` — `toCents(euros)`, `fromCents(cents)`, `addCents(...values)`, `subtractCents(a, b)`
- `src/domain/money/format.ts` — `formatCents(cents, locale?, currency?)` → "€12,34"
- `src/domain/money/split.ts` — `splitEqual(totalCents, participants)` → cents[] (handles remainder)
- `src/domain/dates/phase-status.ts` — `getPhaseStatus(phase, now)` → 'future' | 'active' | 'past'
- `src/domain/dates/format.ts` — date formatting utilities with date-fns
- `src/domain/dates/range.ts` — `isDateInRange(date, start, end)`, `getDaysRemaining(endDate)`
- `src/domain/sync/metadata.ts` — `createSyncMetadata(deviceId)`, `updateSyncMetadata(existing, deviceId)`
- `src/domain/ids/uuid.ts` — `generateId()` wrapping crypto.randomUUID()

**Acceptance criteria**:
- [ ] All 21 entity interfaces compile with strict TypeScript
- [ ] Zod schemas validate sample Trip, Phase, BudgetPool, Transaction data
- [ ] `toCents(12.34)` → 1234; `fromCents(1234)` → 12.34
- [ ] `formatCents(1234)` → "€12,34" (pt-BR locale)
- [ ] `splitEqual(1000, 3)` → [334, 333, 333] (remainder distributed)
- [ ] `getPhaseStatus(phase, now)` returns correct status based on dates
- [ ] `createSyncMetadata(deviceId)` produces valid metadata with revision 1
- [ ] No `any` types — all fully typed

**Tests** (Vitest):
- `money/cents.test.ts` — conversion edge cases, overflow, zero, negative
- `money/format.test.ts` — formatting for different locales, large values
- `money/split.test.ts` — equal split, remainder distribution, single participant, zero amount
- `dates/phase-status.test.ts` — past/active/future phases, edge cases at boundaries
- `dates/range.test.ts` — date range checks
- `validation/*.test.ts` — valid/invalid data scenarios for each Zod schema

**Dependencies**: M1 (project scaffold).

---

### M3: Repositories + Data Layer

**What**: Dexie repositories for all D1-active entities with CRUD operations, soft delete support, sync metadata population, and reactive query hooks.

**Files created**:
- `src/data/repositories/base.repository.ts` — Generic base with create, update, softDelete, getById, getAll (filters deletedAt)
- `src/data/repositories/trip.repository.ts` — Trip CRUD
- `src/data/repositories/phase.repository.ts` — Phase CRUD + getByTripId (ordered)
- `src/data/repositories/budget-pool.repository.ts` — BudgetPool CRUD + getByTripId, getGlobalPools, getLinkedPools
- `src/data/repositories/budget-pool-phase-link.repository.ts` — Link CRUD + getPoolsForPhase, getPhasesForPool
- `src/data/repositories/envelope.repository.ts` — Envelope CRUD + getByPoolId, getProtectedReserve(poolId)
- `src/data/repositories/participant.repository.ts` — Participant CRUD + getByTripId
- `src/data/repositories/wallet.repository.ts` — Wallet CRUD + getByTripId, getDefault, setDefault
- `src/data/repositories/transaction.repository.ts` — Transaction CRUD + getByPhaseId, getByPoolId, getByWalletId, getUnassignedWallet(tripId)
- `src/data/repositories/activity-profile.repository.ts` — Profile CRUD + getByTripId
- `src/data/repositories/app-settings.repository.ts` — get(), update() (singleton)
- `src/data/repositories/device.repository.ts` — Device CRUD + getCurrentDevice
- `src/data/repositories/index.ts` — Barrel export
- `src/data/db/migrations.ts` — Migration structure (v1 only for now)
- `src/hooks/use-live-query.ts` — Wrapper around Dexie's useLiveQuery for reactive data

**Acceptance criteria**:
- [ ] `tripRepository.create(data)` → inserts record with generated UUID, sync metadata, revision=1
- [ ] `tripRepository.update(id, changes)` → increments revision, updates `updatedAt`
- [ ] `tripRepository.softDelete(id)` → sets `deletedAt`, increments revision
- [ ] `tripRepository.getAll()` → returns only records where `deletedAt === null`
- [ ] `budgetPoolPhaseLinkRepository.getPoolsForPhase(phaseId)` → returns linked + global pools
- [ ] `envelopeRepository.getProtectedReserve(poolId)` → returns envelope with kind="protected_reserve" or null
- [ ] `walletRepository.setDefault(walletId)` → clears previous default, sets new one (exactly one default)
- [ ] `transactionRepository.getUnassignedWallet(tripId)` → returns transactions with walletId=null
- [ ] All operations respect soft-delete filter

**Tests** (Vitest with fake-indexeddb):
- `repositories/trip.repository.test.ts` — CRUD lifecycle, soft delete, get active trips
- `repositories/budget-pool.repository.test.ts` — scoped queries, link resolution
- `repositories/envelope.repository.test.ts` — protected reserve single-source enforcement
- `repositories/transaction.repository.test.ts` — filter by phase/pool/wallet, unassigned wallet query
- `repositories/wallet.repository.test.ts` — default wallet toggle logic

**Dependencies**: M1 (database), M2 (types).

---

### M4: Budget Engine + Transaction Engine

**What**: Pure domain functions for all D1 budget calculations and transaction creation logic. This is the most critical milestone — financial correctness must be proven with extensive tests.

**Files created**:
- `src/domain/budget/calculate-free-to-spend.ts` — Core hero number: poolTotal − totalSpent − protectedReserve − futureFloor
- `src/domain/budget/calculate-pool-spent.ts` — Sum of expenses + adjustments for a pool (respects deletedAt)
- `src/domain/budget/calculate-pool-available.ts` — poolTotal − poolSpent
- `src/domain/budget/calculate-wallet-balance.ts` — initialBalance − expenses − outTransfers + inTransfers
- `src/domain/budget/calculate-phase-status.ts` — Total budget, spent, remaining for a phase (across multiple pools)
- `src/domain/budget/calculate-personal-shopping-remaining.ts` — Global pool remaining for personal shopping
- `src/domain/budget/index.ts` — Barrel export
- `src/domain/transactions/create-expense.ts` — Validates and builds expense Transaction entity
- `src/domain/transactions/create-adjustment.ts` — Builds adjustment Transaction (positive or negative)
- `src/domain/transactions/validate-expense.ts` — Business rule validation (amount > 0, pool required, etc.)
- `src/domain/transactions/index.ts` — Barrel export
- `src/domain/orchestrators/dashboard.ts` — Orchestrates all data needed for dashboard display (free-to-spend, personal shopping, recent expenses, wallet alerts)
- `src/domain/orchestrators/expense.ts` — Orchestrates expense creation (validate → create → persist)
- `src/domain/orchestrators/phase-budget.ts` — Orchestrates phase budget summary (multiple pools, reserves)

**Acceptance criteria**:
- [ ] `calculateFreeToSpend`: pool €760, spent €200, reserve €100, floor €170 → €290
- [ ] `calculateFreeToSpend`: single pool, no reserve, no floor → poolTotal − spent
- [ ] `calculateFreeToSpend`: multi-pool phase → sums across all linked pools
- [ ] `calculateFreeToSpend`: global pool (personal shopping) → totalAmount − spent on global pool
- [ ] `calculatePoolSpent`: correctly sums expenses + adjustments, ignores transfers/settlements
- [ ] `calculateWalletBalance`: accounts for expenses, outgoing transfers, incoming transfers
- [ ] `createExpense`: produces valid Transaction with type="expense", amountCents > 0, personalCostCents set
- [ ] `createExpense`: wallet=null → walletId=null (DEC-051)
- [ ] `createExpense`: budget at zero → does NOT throw (DEC-053), returns transaction
- [ ] `validateExpense`: amount=0 → validation error
- [ ] `validateExpense`: no budgetPoolId when required → validation error
- [ ] Phase budget status: correctly aggregates multiple pools linked to same phase (DEC-040)
- [ ] Personal shopping card: shows remaining from global pool only (DEC-041)

**Tests** (Vitest — EXTENSIVE):
- `budget/calculate-free-to-spend.test.ts` — 15+ scenarios: zero spend, full spend, multi-pool, with/without reserve, with/without floor, negative free-to-spend (over budget)
- `budget/calculate-pool-spent.test.ts` — expenses only, adjustments only, mixed, with soft-deleted excluded
- `budget/calculate-wallet-balance.test.ts` — all combinations of expenses/transfers
- `budget/calculate-personal-shopping-remaining.test.ts` — global pool scenarios
- `transactions/create-expense.test.ts` — valid/invalid inputs, optional wallet, shared flag
- `transactions/validate-expense.test.ts` — all validation rules
- `orchestrators/dashboard.test.ts` — integration of multiple calculations
- `orchestrators/phase-budget.test.ts` — multi-pool phase aggregation

**Dependencies**: M2 (types, money utilities), M3 (repositories for orchestrator tests).

---

### M5: Backup Engine

**What**: JSON export/import with merge/replace/conflict resolution, CSV export with 17+6 fields, pre-import analysis summary.

**Files created**:
- `src/domain/backup/create-backup.ts` — Reads all tables, builds TripPilotBackup JSON (includes soft-deleted records)
- `src/domain/backup/parse-backup.ts` — Validates JSON structure, checks schema version, returns parsed backup or errors
- `src/domain/backup/analyze-import.ts` — Compares backup vs local → produces ImportSummary (new, updated, conflicting, skipped counts)
- `src/domain/backup/merge-import.ts` — Executes merge mode: insert new, update by revision, flag conflicts
- `src/domain/backup/replace-import.ts` — Executes replace mode: clear all local data, insert all imported
- `src/domain/backup/resolve-conflict.ts` — Applies user decisions for individual conflicts (keep local / use imported)
- `src/domain/backup/export-csv.ts` — Generates CSV string with 17 or 23 fields, joins related entity names
- `src/domain/backup/types.ts` — ConflictRecord, ImportDecision, CsvExportOptions types
- `src/domain/backup/index.ts` — Barrel export

**Acceptance criteria**:
- [ ] Full round-trip: create backup → clear DB → import with replace → all data restored identically
- [ ] Merge mode: new records inserted, higher-revision records update local, lower-revision skipped
- [ ] Conflict detection: same ID, same revision, different `updatedAt` → flagged as conflict
- [ ] Pre-import summary correctly counts: new, updated, conflicting, skipped, deleted
- [ ] Soft-deleted records included in backup export (required for merge)
- [ ] Schema version mismatch: returns clear error with version info
- [ ] Corrupt/empty JSON: returns validation error, does not crash
- [ ] CSV basic (17 fields): correct headers in Portuguese, joined entity names, amounts formatted from cents
- [ ] CSV advanced (23 fields): includes ID, type, status, timestamps, device name
- [ ] CSV respects filter by phase and date range when provided
- [ ] `sourceDeviceId` and device name correctly propagated in backup metadata

**Tests** (Vitest):
- `backup/create-backup.test.ts` — includes all tables, soft-deleted records, metadata
- `backup/parse-backup.test.ts` — valid, corrupt, empty, wrong version
- `backup/analyze-import.test.ts` — new/update/conflict/skip scenarios
- `backup/merge-import.test.ts` — full merge lifecycle with mixed records
- `backup/replace-import.test.ts` — clean replacement
- `backup/resolve-conflict.test.ts` — per-record resolution
- `backup/export-csv.test.ts` — field count, header names, joined values, cents formatting, filters

**Dependencies**: M2 (types, backup interfaces), M3 (repositories for read/write).

---

### M6: Welcome + Onboarding + Demo Data

**What**: Welcome screen (3 options), minimal onboarding wizard (DEC-036), and complete fictional demo data seed (DEC-038).

**Files created**:
- `src/features/onboarding/Welcome.tsx` — Three options: criar viagem, importar backup, carregar demonstração
- `src/features/onboarding/OnboardingWizard.tsx` — Multi-step: trip name → phase name/dates → currency → amount → optional reserve → creates entities → navigates to dashboard
- `src/features/onboarding/steps/TripNameStep.tsx` — Trip name input
- `src/features/onboarding/steps/PhaseStep.tsx` — Phase name + date range pickers
- `src/features/onboarding/steps/BudgetStep.tsx` — Amount + optional protected reserve
- `src/features/onboarding/hooks/use-onboarding.ts` — Orchestrates wizard state and entity creation
- `src/data/demo/seed.ts` — Creates complete fictional demo trip per DEC-038
- `src/data/demo/demo-data.ts` — Static demo data constants (fictional names, amounts, dates)
- `src/i18n/locales/pt-BR.json` — Updated with onboarding strings

**Demo data seed creates** (per DEC-038):
- 1 fictional trip ("Viagem para Mediterrâneo")
- 2 phases (non-consecutive, linked to same pool)
- 2 BudgetPools: 1 operational (linked_phases, €760) + 1 personal shopping (global, €100)
- 1 Envelope (protected_reserve, €100 inside operational pool)
- 3 fictional participants (owner + 2 others)
- 2 wallets (Wise digital + Cash EUR)
- 10 varied expenses (market, bar, restaurant, transport, clothing)
- 1 adjustment transaction
- "Dados de demonstração" banner flag via AppSettings or Trip metadata

**Acceptance criteria**:
- [ ] Welcome screen renders 3 options, navigates correctly
- [ ] "Criar viagem" → wizard flows through all steps → creates Trip + Phase + BudgetPool + optional Envelope → lands on `/dashboard`
- [ ] "Importar backup" → opens file picker (delegates to backup engine from M5)
- [ ] "Carregar demonstração" → loads full demo → lands on `/dashboard` with demo banner
- [ ] Demo data shows "Dados de demonstração" banner visible at top
- [ ] Demo data includes "Apagar demonstração" action button
- [ ] "Apagar demonstração" removes all demo data and returns to Welcome
- [ ] Minimal onboarding requires only: trip name, phase name, start date, end date, currency (EUR fixed), amount, optional reserve
- [ ] All wizard text uses i18n `t()` — no hardcoded strings

**Tests**:
- Component tests (RTL): Welcome renders 3 options, OnboardingWizard step navigation
- Unit test: demo seed function creates expected entity counts
- Unit test: onboarding orchestration creates correct entities with sync metadata

**Dependencies**: M3 (repositories), M4 (budget engine for validation), M5 (backup import for Welcome option).

---

### Gate 1 Checkpoint

Before proceeding to Gate 2:
- [ ] Full test suite passes: `npm run test` — 0 failures
- [ ] `npm run build` succeeds without errors
- [ ] All domain calculations verified (M4 is >90% coverage)
- [ ] Dexie database opens, seeds AppSettings, handles all CRUD
- [ ] Backup round-trip proven (export → import → verify)
- [ ] Demo data seed verified with correct entity counts
- [ ] Core flow: create trip → register expense → verify budget updates
- [ ] Context Refresh executed (re-read rules, state update)

---

## 3. Gate 2 — UI + Polish (Milestones 7–12)

> Focus: Full UI implementation with design system, all screens functional, E2E tests passing.
> NON-NEGOTIABLES repeated: no hardcoded strings, cents-based money, wallet optional, never block registration, design tokens applied.

---

### M7: Dashboard Screen + App Shell

**What**: Full dashboard with design system applied. App Shell with bottom navigation, FAB button, and layout structure used by all screens.

**Files created**:
- `src/app/layouts/AppShell.tsx` — Layout wrapper with bottom nav + FAB + content area
- `src/components/BottomNav.tsx` — 5-item nav (Início, Gastos, FAB, Planejar, Mais) with glass effect
- `src/components/FabButton.tsx` — Central elevated button, toggles + / ×
- `src/components/FabMenu.tsx` — Full-screen overlay at 94% opacity, bottom-aligned actions (only "Registrar gasto" and "Registrar mercado" active in D1)
- `src/features/dashboard/Dashboard.tsx` — Main dashboard page container
- `src/features/dashboard/PhaseHeader.tsx` — Phase name, date range, navigation logic (DEC-060)
- `src/features/dashboard/HeroCard.tsx` — "Livre para usar até [date]" hero number + breakdown
- `src/features/dashboard/PersonalShoppingCard.tsx` — Global pool remaining
- `src/features/dashboard/RecentExpenses.tsx` — Last 5 expenses with category, amount, time
- `src/features/dashboard/UnassignedWalletBanner.tsx` — "N gastos sem carteira" alert (DEC-051)
- `src/features/dashboard/DemoBanner.tsx` — Conditional demo data banner
- `src/features/dashboard/EmptyDashboard.tsx` — Empty state with CTA
- `src/features/dashboard/hooks/use-dashboard-data.ts` — Orchestrates all dashboard queries
- `src/components/EmptyState.tsx` — Reusable empty state component
- `src/components/StatusBadge.tsx` — Budget health badge (comfortable/attention/critical)

**Acceptance criteria**:
- [ ] Dashboard shows correct "Livre para usar" hero number (from M4 engine)
- [ ] Hero label includes phase end date: "Livre para usar até 15/07"
- [ ] Fund breakdown visible below hero: saldo, reservado futuro, reserva protegida, = livre
- [ ] Personal shopping card shows remaining from global pool
- [ ] Recent expenses list shows last 5 with correct formatting (cents → €X,XX)
- [ ] Unassigned wallet banner appears when count > 0 (DEC-051)
- [ ] FAB menu opens with overlay, shows only "Registrar gasto" + "Registrar mercado"
- [ ] FAB icon animates from + to × when open
- [ ] Bottom nav highlights active route with `--primary` color
- [ ] Bottom nav glass effect: `--surface` at 90% + backdrop-blur
- [ ] All text uses i18n `t()` function
- [ ] Design tokens applied: `--surface-container` for cards, `--on-surface` for text, no shadows on cards
- [ ] Empty state shown when no trip exists (redirects to Welcome)
- [ ] Phase header navigation logic per DEC-060

**Tests**:
- Component tests (RTL): Dashboard renders hero, cards show correct values with mock data
- Component tests: BottomNav highlights correct route
- Component tests: FabMenu shows/hides, only D1 actions visible

**Dependencies**: M4 (budget calculations), M6 (demo data for populated state).

---

### M8: Expense Registration

**What**: Add expense form via bottom sheet, with category picker, optional wallet selection, pool selection, and immediate budget update.

**Files created**:
- `src/features/expenses/AddExpense.tsx` — Bottom sheet form container
- `src/features/expenses/ExpenseForm.tsx` — Form with React Hook Form + Zod validation
- `src/features/expenses/CategoryPicker.tsx` — Category grid/list selector (predefined categories)
- `src/features/expenses/WalletSelector.tsx` — Optional wallet selection with "Nenhuma" option + default pre-select
- `src/features/expenses/PoolSelector.tsx` — Fund selection (auto-select if single pool, require selection if multiple)
- `src/features/expenses/hooks/use-add-expense.ts` — Orchestrates validation → creation → persistence → navigation
- `src/components/BottomSheet.tsx` — Reusable bottom sheet with drag handle, backdrop blur, rounded-t-2xl
- `src/components/NumericInput.tsx` — Amount input formatted as currency
- `src/components/DateTimePicker.tsx` — Date/time override picker

**Acceptance criteria**:
- [ ] FAB → "Registrar gasto" opens bottom sheet with expense form
- [ ] FAB → "Registrar mercado" opens same form with market category pre-selected
- [ ] Required field: amount (numeric > 0)
- [ ] Auto-selects pool when only one operational pool exists for current phase (DEC-040)
- [ ] Shows pool selector when multiple pools accessible (DEC-040)
- [ ] Shows "create pool" option when phase has no pool (DEC-039)
- [ ] Wallet selector: default wallet pre-selected, clearable. Skipping = "Carteira não informada" (DEC-051)
- [ ] "Registrar" saves expense → dashboard hero updates immediately
- [ ] Budget at zero: shows warning (red state) but allows registration with confirmation (DEC-053)
- [ ] Amount stored as integer cents (DEC-020)
- [ ] Amount = 0 rejected with validation error
- [ ] All labels via i18n

**Tests**:
- Component tests (RTL): form validation, required field errors, wallet pre-selection
- Component tests: pool auto-selection logic
- Integration test: create expense → verify dashboard data updates

**Dependencies**: M4 (transaction engine), M7 (bottom sheet, app shell).

---

### M9: Expense List + Detail

**What**: Filterable expense list, individual expense detail view with edit capability.

**Files created**:
- `src/features/expenses/ExpenseList.tsx` — Scrollable list grouped by date
- `src/features/expenses/ExpenseListItem.tsx` — Single expense row: category icon, description, amount, wallet indicator
- `src/features/expenses/ExpenseFilters.tsx` — Filter bar: by phase, category, date range, wallet, "sem carteira" toggle
- `src/features/expenses/ExpenseDetail.tsx` — Full detail view with edit mode
- `src/features/expenses/hooks/use-expense-list.ts` — Reactive query with filter state
- `src/features/expenses/hooks/use-expense-detail.ts` — Single expense load + edit orchestration

**Acceptance criteria**:
- [ ] Expense list shows all non-deleted expenses for the trip, newest first
- [ ] Filter by phase works (shows only expenses from selected phase)
- [ ] Filter by category works (shows only matching category)
- [ ] Filter by date range works
- [ ] Filter by wallet works
- [ ] "Somente sem carteira" filter shows only walletId=null expenses (DEC-051)
- [ ] Tapping expense opens detail view with all fields
- [ ] Detail view allows editing: amount, category, description, wallet, pool
- [ ] Edit saves → list updates reactively
- [ ] Empty state: "Nenhum gasto registrado" with CTA to register
- [ ] Amounts formatted from cents with JetBrains Mono (tabular-nums)
- [ ] "Carteira não informada" indicator shown on expenses without wallet

**Tests**:
- Component tests (RTL): filter application, list rendering with mock data
- Component tests: expense detail edit flow

**Dependencies**: M7 (app shell), M8 (expense creation for populated data).

---

### M10: Planner Basic + Wallet + Participant Management

**What**: "Planejar" tab basic editor (DEC-055), wallet CRUD with default management, participant CRUD.

**Files created**:
- `src/features/planning/PlannerBasic.tsx` — Tab container with sections
- `src/features/planning/PhaseEditor.tsx` — View/create/edit/delete phases
- `src/features/planning/PoolEditor.tsx` — View/create/edit pools, set scope, link to phases
- `src/features/planning/EnvelopeEditor.tsx` — Protected reserve + allocation management per pool
- `src/features/planning/FutureFloorEditor.tsx` — Manual floor setting per pool-phase link
- `src/features/planning/PersonalShoppingEditor.tsx` — Configure global shopping pool amount
- `src/features/planning/ProfileSetup.tsx` — Create/edit activity profiles (name, category, typical/safe values)
- `src/features/wallets/WalletList.tsx` — List with balances (derived from transactions)
- `src/features/wallets/WalletForm.tsx` — Create/edit wallet: name, type, currency, initial balance
- `src/features/wallets/WalletDetail.tsx` — Single wallet view with transaction history
- `src/features/participants/ParticipantList.tsx` — Participant list with CRUD
- `src/features/participants/ParticipantForm.tsx` — Name (required) + nickname (optional) form
- `src/features/planning/hooks/use-planner-data.ts` — Orchestrates planner queries

**Acceptance criteria**:
- [ ] "Planejar" tab shows sections: Phases, Funds, Profiles
- [ ] User can create/edit/delete phases (with date pickers)
- [ ] User can create/edit pools: name, amount, scope (global/linked_phases), link to phases
- [ ] User can set protected reserve per pool (creates/updates Envelope kind=protected_reserve)
- [ ] User can set future floor per pool-phase link
- [ ] User can configure personal shopping amount (global pool)
- [ ] User can create/edit activity profiles with typical + safe values
- [ ] Wallet list shows calculated balance per wallet (DEC-052 cash reconciliation deferred to D2)
- [ ] User can create wallet: name, type, currency, initial balance
- [ ] User can set one wallet as default (exactly one, toggleable)
- [ ] User can add participants: name required, nickname optional (DEC-056)
- [ ] All editors use i18n strings
- [ ] Envelope enforcement: at most one protected_reserve per pool
- [ ] Default wallet enforcement: at most one per trip

**Tests**:
- Component tests (RTL): phase CRUD form, pool editor with scope selection
- Component tests: wallet default toggle logic
- Component tests: participant form validation (name required)

**Dependencies**: M3 (repositories), M7 (app shell), M4 (budget engine for wallet balance).

---

### M11: Settings + "Mais" Tab + Backup UI

**What**: Settings screen with all DEC-057 items, "Mais" tab sections per DEC-059, and Backup & Data screen with full import/export UI.

**Files created**:
- `src/features/settings/Settings.tsx` — Settings page with all configurable items
- `src/features/settings/AlertToneSelector.tsx` — Radio: amigo_sincero / calmo / direto
- `src/features/settings/QuickAddConfig.tsx` — Editable quick-add default values
- `src/features/settings/WalletDefaultSelector.tsx` — Wallet picker for default
- `src/features/settings/BackupReminderConfig.tsx` — On/off + days interval
- `src/features/settings/ThemeSelector.tsx` — Dark / Light / System (light mode not functional until D5)
- `src/features/settings/DeviceNameInput.tsx` — Optional text input
- `src/features/settings/PersistentStorageStatus.tsx` — Read-only indicator
- `src/features/more/MoreTab.tsx` — Sectioned list per DEC-059
- `src/features/more/MoreSection.tsx` — Section header + items component
- `src/features/more/MoreItem.tsx` — Single item with icon + label + chevron
- `src/features/backup/BackupScreen.tsx` — Export/import JSON + CSV export options
- `src/features/backup/ExportButton.tsx` — Triggers JSON backup download
- `src/features/backup/ImportFlow.tsx` — File picker → parse → show summary → choose mode
- `src/features/backup/ImportPreview.tsx` — Pre-import summary display (counts, source device, date)
- `src/features/backup/ConflictResolution.tsx` — Per-record conflict UI (keep local / use imported / compare)
- `src/features/backup/CsvExportOptions.tsx` — Choose basic (17) or advanced (23), optional phase/date filter
- `src/features/about/About.tsx` — App version, credits

**Acceptance criteria**:
- [ ] Settings persists all changes to AppSettings entity
- [ ] Alert tone selection works and persists
- [ ] Quick-add default values are editable (array of cents values)
- [ ] Default wallet selector shows trip wallets
- [ ] Vibration toggle persists
- [ ] Backup reminder: on/off + interval in days
- [ ] Theme selector: dark works, light/system show as options (light not styled until D5)
- [ ] Language shows pt-BR (read-only in D1)
- [ ] Device name editable, included in backup metadata
- [ ] Persistent storage status reads from `navigator.storage.persisted()`
- [ ] "Mais" tab shows 3 sections with correct items (DEC-059)
- [ ] Items linking to unimplemented screens show empty states or are hidden
- [ ] JSON export downloads `.json` file with all data + metadata
- [ ] JSON import: file picker → parse → preview summary → merge/replace mode selection
- [ ] Merge conflicts: per-record resolution UI (keep local / use imported)
- [ ] Replace mode: warning confirmation → clears all → imports
- [ ] CSV export: basic (17 fields) or advanced (23 fields) download
- [ ] CSV export: optional phase filter and date range filter

**Tests**:
- Component tests (RTL): Settings renders all items, persists changes
- Component tests: MoreTab sections render correct items
- E2E (Playwright): full backup/restore flow — create trip → export → clear → import → verify data

**Dependencies**: M5 (backup engine), M7 (app shell), M10 (settings integration with wallets).

---

### M12: Polish + Final Testing + Integration Verification

**What**: Design system consistency verification, responsive testing, i18n completeness audit, accessibility basics, all E2E flows passing, and final integration check.

**Files updated**: All existing files refined (no new major files).

**Tasks**:
- Design token audit: verify all components use CSS variables, no hardcoded colors
- Typography audit: Manrope for text, JetBrains Mono for money, tabular-nums applied
- Responsive check: all screens work on 375px–428px viewport width
- Touch targets: all interactive elements ≥ 44px
- i18n completeness: verify no hardcoded Portuguese in any component (search for string literals)
- Empty states: verify all screens handle empty data gracefully
- Loading states: skeleton shimmer for async data
- Error states: clear messages with recovery actions
- Bottom padding: verify content not hidden behind bottom nav
- Accessibility: color contrast ratios meet WCAG AA for text on dark backgrounds
- Complete E2E test suite

**E2E Flows** (Playwright):
1. **Onboarding → Dashboard**: Welcome → create trip wizard → verify dashboard shows correct values
2. **Expense registration**: FAB → add expense → verify "Livre para usar" decreases
3. **Wallet management**: Create wallet → set as default → verify pre-selection in expense form
4. **Backup round-trip**: Create trip + expenses → export JSON → clear app → import → verify all data
5. **Demo data flow**: Load demo → verify banner → verify data → delete demo → verify empty state
6. **CSV export**: Create expenses → export CSV → verify file downloads with correct field count

**Acceptance criteria**:
- [ ] All Appendix C items from master-spec-d1.md verified ✓
- [ ] Unit tests: >90% coverage on `src/domain/` (budget, money, backup)
- [ ] Component tests: >70% coverage on critical components (dashboard, expense form, backup)
- [ ] 6 E2E flows pass green
- [ ] `npm run build` produces <500KB initial JS bundle (before code splitting)
- [ ] No TypeScript errors (strict mode)
- [ ] No ESLint errors
- [ ] No hardcoded Portuguese strings found in `.tsx` files (only in i18n JSON)
- [ ] All monetary values use JetBrains Mono with tabular-nums
- [ ] Design tokens consistent across all screens
- [ ] Bottom nav visible and functional on all app shell screens
- [ ] FAB menu accessible from any dashboard/list screen
- [ ] Backup reminder logic works (triggers after N days without export)

**Dependencies**: M7–M11 (all UI milestones complete).

---

### Gate 2 Checkpoint

Before declaring D1 complete:
- [ ] Full test suite green: unit + component + E2E
- [ ] `npm run build` succeeds
- [ ] All D1 acceptance criteria from master-spec-d1.md Appendix C pass
- [ ] Manual smoke test on mobile viewport (Chrome DevTools 375px)
- [ ] Backup round-trip verified (export → fresh import → data integrity)
- [ ] Demo data loads and works end-to-end
- [ ] Design system tokens used consistently (no inline colors)
- [ ] i18n audit: zero hardcoded strings in components
- [ ] Context Refresh executed (final state documented in dev-log.md)

---

## 4. Milestone Dependency Graph

```
M1 (Scaffold)
 ├── M2 (Types + Utilities)
 │    ├── M3 (Repositories)
 │    │    ├── M4 (Budget Engine) ← CRITICAL PATH
 │    │    │    ├── M5 (Backup Engine)
 │    │    │    │    └── M6 (Onboarding + Demo)
 │    │    │    │         └── [Gate 1 Checkpoint]
 │    │    │    │              ├── M7 (Dashboard + Shell)
 │    │    │    │              │    ├── M8 (Expense Registration)
 │    │    │    │              │    │    └── M9 (Expense List + Detail)
 │    │    │    │              │    └── M10 (Planner + Wallets + Participants)
 │    │    │    │              │         └── M11 (Settings + Mais + Backup UI)
 │    │    │    │              │              └── M12 (Polish + E2E)
 │    │    │    │              │                   └── [Gate 2 Checkpoint]
```

**Critical path**: M1 → M2 → M3 → M4 → M5 → M6 → Gate 1 → M7 → M8 → M11 → M12

**Parallel opportunities within Gate 2**:
- M8 (Expense Registration) and M10 (Planner + Wallets) can be worked in parallel after M7
- M9 (Expense List) can start once M8 is complete
- M11 (Settings + Backup UI) can start once M7 is complete (only needs M5 engine + M7 shell)

---

## 5. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| 1 | Dexie reactive queries performance with multiple simultaneous live queries | Medium | Low | Test with 500+ transactions early (M4 tests). Use `useLiveQuery` selectively, not on every component |
| 2 | react-i18next bundle size impacting initial load | Low | Low | Use dynamic imports for locale files. Only pt-BR loaded initially |
| 3 | Tailwind + CSS custom properties interaction | Low | Medium | Define tokens as CSS variables in `tokens.css`, reference in `tailwind.config.ts` via `var()` |
| 4 | Backup merge conflict resolution UX complexity | Medium | Medium | Start with simple side-by-side comparison. Keep conflict count visible. Allow "use imported for all" bulk action |
| 5 | Demo data maintenance across schema changes | Low | Low | Keep seed as a function building entities programmatically, not static JSON. Use same creation utilities as onboarding |
| 6 | IndexedDB storage limits on mobile browsers | Low | Low | ~120–1050 records per trip is well within limits. Monitor with `navigator.storage.estimate()` |
| 7 | Cents arithmetic overflow for large trip budgets | Low | Very Low | Max realistic value ~€100,000 = 10,000,000 cents — safe within JS integer range |
| 8 | Bottom sheet / overlay z-index conflicts with FAB | Medium | Medium | Establish z-index scale in tokens.css: nav=100, fab=200, overlay=300, sheet=400, toast=500 |
| 9 | Scope creep from "hidden but designed" features bleeding into D1 | High | Medium | Strict checklist: if feature requires engine from D3/D4, it does NOT exist in D1. No stubs, no placeholders |
| 10 | fake-indexeddb compatibility with Dexie's latest API for tests | Medium | Low | Pin Dexie version, verify test setup in M3 early |

---

## 6. Updated Delivery Summary Table

| Delivery | Raw Hours | Tier 3 | Status | Milestones | Gates |
|----------|:---------:|:------:|--------|:----------:|:-----:|
| **1 — Usable Foundation** | 40h | ~13h | **PLANNED** | 12 | 2 |
| 2 — Real-World Splitting | 25h | ~8h | NOT STARTED | TBD | TBD |
| 3 — Intelligent Forecasting | 35h | ~12h | NOT STARTED | TBD | TBD |
| 4 — Outing Mode | 20h | ~7h | NOT STARTED | TBD | TBD |
| 5 — Production PWA | 15h | ~5h | NOT STARTED | TBD | TBD |
| 6 — Native Layer | 15h | ~5h | NOT STARTED | TBD | TBD |
| **Total** | **150h** | **~50h** | — | — | — |

---

## 7. Handoff Notes

**For START-HERE.md generation** (via `/deliver`):
- This document contains all information needed to generate the complete phase delivery package
- Gate 1 is the backend/domain gate — no UI, heavy testing
- Gate 2 is the frontend/polish gate — design system intensive
- The budget engine (M4) is the highest-risk, highest-value milestone — allocate extra test time
- Parallel work is possible in Gate 2 (M8 || M10, M9 || M11) to reduce elapsed time

**Specialist assignment recommendations**:
- **Marcelo** (frontend): M7, M8, M9, M10, M11, M12
- **Carla** (backend): M1, M2, M3, M4, M5, M6
- **Jessica** (database): Review M2 types, M3 repositories, M5 backup schema
- **Daniel** (architecture): Review orchestrator patterns in M4
- **Lucas** (tests): Create test suites for M2, M4, M5
- **Bruno** (test execution): Run test suites at gate checkpoints

---

*This plan is detailed enough for direct START-HERE.md generation. All acceptance criteria are verifiable. All dependencies are mapped. All decisions are referenced.*
