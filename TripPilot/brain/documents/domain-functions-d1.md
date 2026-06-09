# TripPilot — Domain Functions Reference: Delivery 1

> Version: 1.0 | Date: 2026-06-08
> Purpose: Exhaustive reference of every pure TypeScript function the domain layer needs for D1.
> Audience: Implementation agents (Carla, Marcelo) and the tech lead.
> Status: Planning document — no production code.

---

## 1. Architecture Overview

### Layer Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (React components, hooks, stores)             │
│  — Displays data, captures user input                   │
├─────────────────────────────────────────────────────────┤
│  Orchestrators (src/domain/orchestrators/)              │
│  — Coordinate domain functions + repositories           │
│  — May call sub-orchestrators                           │
│  — The ONLY layer that touches both domain and data     │
├─────────────────────────────────────────────────────────┤
│  Domain Layer (src/domain/**)                           │
│  — Pure TypeScript, NO React, NO Dexie imports          │
│  — Functions take data as input, return computed results │
│  — Zero side effects, fully testable in isolation       │
├─────────────────────────────────────────────────────────┤
│  Data Layer (src/data/**)                               │
│  — Repositories handle Dexie/IndexedDB persistence      │
│  — Backup/import file I/O                               │
└─────────────────────────────────────────────────────────┘
```

### Directory Map (D1 scope)

```
src/domain/
├── budget/               # Budget calculations, free-to-spend, pool spending
├── transactions/         # Transaction creation and categorization
├── money/                # Cents conversion, formatting, splitting
├── validation/           # Zod schemas for all entities
├── backup/               # Backup creation, parsing, import analysis, merge, CSV
├── dates/                # Phase date logic, active phase, day numbering
├── wallets/              # Wallet balance, cash reconciliation
├── demo/                 # Demo data generation
├── onboarding/           # Onboarding entity creation helpers
├── orchestrators/        # Coordinate domain + repositories
└── types/                # Shared return types, DTOs
```

### Key Conventions

- **All money values are integer cents** (DEC-020). No floating-point anywhere.
- **Every entity has SyncMetadata** (`id`, `createdAt`, `updatedAt`, `deletedAt`, `revision`, `sourceDeviceId`).
- **Soft delete**: domain functions filter `deletedAt === null` unless stated otherwise.
- **Pure inputs**: domain functions receive already-fetched data — they never query Dexie directly.
- **Orchestrators are the exception**: they call repositories, then pass data to domain functions.

---

## 2. Budget Engine (`src/domain/budget/`)

### 2.1 `calculateFreeToSpend`

The hero number on the dashboard: "Livre para usar até [data]" (DEC-023).

```typescript
/**
 * Calculate the free-to-spend amount for a budget pool in the context
 * of a specific active phase.
 *
 * Formula: freeToSpend = totalBudget − totalSpent − protectedReserve − futureFloor
 *
 * @see DEC-023, DEC-042, DEC-016
 */
function calculateFreeToSpend(
  pool: BudgetPool,
  envelopes: Envelope[],
  transactions: Transaction[],
  phaseLinks: BudgetPoolPhaseLink[],
  currentPhaseId: string,
): FreeToSpendResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `pool` | The BudgetPool being evaluated |
| `envelopes` | All envelopes for this pool where `deletedAt === null` |
| `transactions` | All transactions for this pool where `deletedAt === null` |
| `phaseLinks` | All BudgetPoolPhaseLinks for this pool where `deletedAt === null` |
| `currentPhaseId` | The phase the user is currently viewing |

**Output**:

```typescript
interface FreeToSpendResult {
  /** The hero number: what the user can actually spend */
  freeToSpendCents: number;
  /** Pool's total allocation (pool.totalAmountCents) */
  totalBudgetCents: number;
  /** Sum of expense + adjustment transactions */
  totalSpentCents: number;
  /** Sum of envelopes where kind === 'protected_reserve' */
  protectedReserveCents: number;
  /** Sum of futureFloorCents from phase links for non-current phases */
  futureFloorCents: number;
}
```

**Logic**:

1. `totalBudgetCents` = `pool.totalAmountCents`
2. `totalSpentCents` = sum of `amountCents` from transactions where `type === 'expense' || type === 'adjustment'`
3. `protectedReserveCents` = sum of `amountCents` from envelopes where `kind === 'protected_reserve'`
4. `futureFloorCents` = sum of `futureFloorCents` from phaseLinks where `phaseId !== currentPhaseId` and `futureFloorCents !== null`
   - In D3+, this becomes `max(calculatedRecommendedCents, manualFloorCents)` per phase via `FuturePhaseReservePolicy`
5. `freeToSpendCents` = `totalBudgetCents - totalSpentCents - protectedReserveCents - futureFloorCents`

**Edge cases**:
- Result can be **negative** (user overspent). Never clamp to zero — display the real number.
- Pool with no envelopes: `protectedReserveCents = 0`.
- Pool with no phase links (scope = "global"): `futureFloorCents = 0`.
- Pool with all phases being current: `futureFloorCents = 0`.

---

### 2.2 `calculatePoolSpent`

Spending breakdown for a single pool.

```typescript
/**
 * Calculate total and categorized spending for a budget pool.
 * Only counts expense and adjustment transaction types.
 */
function calculatePoolSpent(
  transactions: Transaction[],
): PoolSpentResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `transactions` | Transactions for this pool where `deletedAt === null` and `type` is `'expense'` or `'adjustment'` |

**Output**:

```typescript
interface PoolSpentResult {
  /** Sum of all amountCents (expense + adjustment) */
  totalSpentCents: number;
  /** Sum of personalCostCents for expense transactions (null personalCostCents treated as amountCents) */
  personalSpentCents: number;
  /** amountCents grouped by category. Key = category string, value = cents */
  byCategory: Record<string, number>;
}
```

**Logic**:

1. `totalSpentCents` = sum of `amountCents` for all transactions
2. `personalSpentCents` = sum of `personalCostCents ?? amountCents` for expense transactions only
3. `byCategory` = group expense transactions by `category`, sum `amountCents` per group. Adjustments excluded from category breakdown (they have category `'reconciliation'` or `'cash_adjustment'`)

---

### 2.3 `calculateWalletBalance`

Derived balance for any wallet (DEC-051).

```typescript
/**
 * Calculate the current balance of a wallet based on its initial balance
 * and all associated transactions.
 *
 * Balance = initial + incoming transfers − outgoing transfers − expenses paid from this wallet
 *
 * @see DEC-051 (wallet optional), DEC-052 (cash reconciliation)
 */
function calculateWalletBalance(
  wallet: Wallet,
  transactions: Transaction[],
): WalletBalanceResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `wallet` | The wallet entity |
| `transactions` | ALL non-deleted transactions that reference this wallet via `walletId`, `sourceWalletId`, or `targetWalletId` |

**Output**:

```typescript
interface WalletBalanceResult {
  /** Current derived balance in cents */
  currentBalanceCents: number;
  /** Total money that came into this wallet (initial + incoming transfers) */
  totalInCents: number;
  /** Total money that left this wallet (expenses + outgoing transfers) */
  totalOutCents: number;
}
```

**Logic**:

1. `expensesCents` = sum of `amountCents` where `walletId === wallet.id` and `type === 'expense'`
2. `adjustmentsCents` = sum of `amountCents` where `walletId === wallet.id` and `type === 'adjustment'`
3. `outTransfersCents` = sum of `amountCents` where `sourceWalletId === wallet.id` and `type === 'transfer'`
4. `inTransfersCents` = sum of `amountCents` where `targetWalletId === wallet.id` and `type === 'transfer'`
5. `totalInCents` = `wallet.initialBalanceCents + inTransfersCents`
6. `totalOutCents` = `expensesCents + adjustmentsCents + outTransfersCents`
7. `currentBalanceCents` = `totalInCents - totalOutCents`

**Note**: Transfer transactions are **D2** but the wallet balance function must account for them from D1 since the schema supports them. In D1 there will be no transfer transactions, so the transfer sums will be zero.

---

### 2.4 `calculatePhaseStatus`

Aggregated financial status for a phase across all its accessible pools.

```typescript
/**
 * Aggregate budget status for a phase, combining data from all pools
 * accessible to this phase (linked + global).
 *
 * Used by the dashboard to show the overall phase health.
 */
function calculatePhaseStatus(
  phase: Phase,
  pools: BudgetPool[],
  phaseLinks: BudgetPoolPhaseLink[],
  envelopes: Envelope[],
  transactions: Transaction[],
): PhaseStatusResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `phase` | The phase being evaluated |
| `pools` | All accessible pools (linked via BudgetPoolPhaseLink + global scope), `deletedAt === null` |
| `phaseLinks` | All BudgetPoolPhaseLinks for accessible pools, `deletedAt === null` |
| `envelopes` | All envelopes for accessible pools, `deletedAt === null` |
| `transactions` | All transactions for accessible pools, `deletedAt === null` |

**Output**:

```typescript
interface PhaseStatusResult {
  /** Combined free-to-spend across all linked (non-global) pools */
  freeToSpendCents: number;
  /** Days remaining until phase end (0 if past) */
  daysRemaining: number;
  /** freeToSpendCents / daysRemaining (secondary indicator only — DEC-006) */
  dailyBudgetCents: number;
  /** Per-pool breakdown */
  pools: PoolSummary[];
}

interface PoolSummary {
  poolId: string;
  poolName: string;
  scope: BudgetPoolScope;
  totalBudgetCents: number;
  totalSpentCents: number;
  freeToSpendCents: number;
  protectedReserveCents: number;
  futureFloorCents: number;
}
```

**Logic**:

1. For each pool, call `calculateFreeToSpend(pool, envelopes, transactions, phaseLinks, phase.id)` to produce a `PoolSummary`.
2. `freeToSpendCents` = sum of `freeToSpendCents` from pools where `scope === 'linked_phases'` only. Global pools (personal shopping) are shown separately.
3. `daysRemaining` = call `daysRemaining(phase)`.
4. `dailyBudgetCents` = `daysRemaining > 0 ? Math.floor(freeToSpendCents / daysRemaining) : 0`. This is a **secondary indicator** (DEC-006) — never the hero number.

---

### 2.5 `calculatePersonalShoppingStatus`

Status of the global personal shopping pool (DEC-041).

```typescript
/**
 * Calculate remaining budget in the personal shopping global pool.
 * Personal shopping is a separate BudgetPool with scope "global".
 *
 * @see DEC-041, DEC-011
 */
function calculatePersonalShoppingStatus(
  pool: BudgetPool,
  transactions: Transaction[],
): PersonalShoppingResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `pool` | The global pool designated for personal shopping (`scope === 'global'`) |
| `transactions` | Transactions for this pool where `deletedAt === null` |

**Output**:

```typescript
interface PersonalShoppingResult {
  /** Total allocated to personal shopping */
  totalBudgetCents: number;
  /** Total spent on personal shopping */
  totalSpentCents: number;
  /** Remaining personal shopping budget */
  remainingCents: number;
}
```

**Logic**:

1. `totalBudgetCents` = `pool.totalAmountCents`
2. `totalSpentCents` = sum of `amountCents` from transactions where `type === 'expense' || type === 'adjustment'`
3. `remainingCents` = `totalBudgetCents - totalSpentCents`

---

## 3. Transaction Engine (`src/domain/transactions/`)

All functions in this module **create** transaction objects ready for persistence. They do NOT persist — that's the orchestrator's job.

### 3.1 `buildExpenseTransaction`

Creates a Transaction object of type `'expense'`.

```typescript
/**
 * Build a complete expense Transaction entity from user input.
 * Does NOT persist — returns the object for the orchestrator to save.
 *
 * @see DEC-020 (cents), DEC-051 (optional wallet), DEC-053 (never block)
 */
function buildExpenseTransaction(
  input: BuildExpenseInput,
  deviceId: string,
): Transaction;
```

**Input**:

```typescript
interface BuildExpenseInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Amount in cents. Must be > 0 */
  amountCents: number;
  currency: string;
  category: string;
  description: string;
  /** ISO 8601 datetime. Defaults to now if omitted */
  date?: string;
  /** Null if user skipped wallet selection (DEC-051) */
  walletId: string | null;
  /** Null in D1. Session linking in D4 */
  sessionId?: string | null;
  /** False in D1. Shared expense splitting in D2 */
  isShared?: boolean;
  /** Null in D1. Payer tracking in D2 */
  paidByParticipantId?: string | null;
  /** Optional link to activity profile for learning */
  activityProfileId?: string | null;
  notes?: string | null;
}
```

**Output**: A complete `Transaction` entity with all fields populated:

| Field | Value |
|-------|-------|
| `id` | New UUID v4 |
| `type` | `'expense'` |
| `amountCents` | From input |
| `personalCostCents` | `= amountCents` when `isShared === false`. When shared (D2+), calculated from participant shares |
| `baseCurrencyAmountCents` | `= amountCents` in V1 (EUR only) |
| `exchangeRate` | `null` in V1 |
| `isShared` | `false` unless specified |
| `isSpecialOccasion` | `false` |
| `excludeFromLearning` | `false` |
| `sourceWalletId` | `null` |
| `targetWalletId` | `null` |
| `settlementId` | `null` |
| `adjustmentReason` | `null` |
| `createdAt` / `updatedAt` | Current ISO 8601 timestamp |
| `deletedAt` | `null` |
| `revision` | `1` |
| `sourceDeviceId` | From `deviceId` parameter |

**Rules**:
- `amountCents` must be `> 0`. Validation rejects zero or negative.
- `walletId` can be `null` — saved as "Carteira não informada" (DEC-051).
- `budgetPoolId` is **required** for expenses. If the phase has no pool, the orchestrator must prompt the user first (DEC-039).
- Never block creation even at zero budget (DEC-053). Blocking is the UI's responsibility (confirmation dialog), not the domain's.

---

### 3.2 `buildTransferTransaction` — **DEFERRED (D2)**

Creates a wallet-to-wallet transfer. Included here for reference because the schema supports it.

```typescript
/**
 * DEFERRED — D2. Cash withdrawal and wallet transfers.
 *
 * Build a transfer Transaction (no budget impact).
 * Cash withdrawal = transfer from bank wallet to cash wallet (DEC-052).
 *
 * @see Core Rule 3 (Cash withdrawal ≠ expense)
 */
function buildTransferTransaction(
  input: BuildTransferInput,
  deviceId: string,
): Transaction;
```

```typescript
interface BuildTransferInput {
  tripId: string;
  phaseId: string;
  sourceWalletId: string;
  targetWalletId: string;
  amountCents: number;
  currency: string;
  description: string;
  date?: string;
  notes?: string | null;
}
```

**Rules**:
- `budgetPoolId` = `null` (transfers have no budget impact).
- `type` = `'transfer'`.
- Both wallets must exist and not be soft-deleted.
- `sourceWalletId !== targetWalletId`.

---

### 3.3 `buildAdjustmentTransaction`

Creates a reconciliation adjustment (DEC-046).

```typescript
/**
 * Build an adjustment Transaction for "Registrar total atual" reconciliation.
 *
 * When the user reports a session/cash total that differs from tracked items,
 * this creates a correction entry. Never deletes existing transactions.
 *
 * @see DEC-046, Core Rule 14
 */
function buildAdjustmentTransaction(
  input: BuildAdjustmentInput,
  deviceId: string,
): AdjustmentResult;
```

**Input**:

```typescript
interface BuildAdjustmentInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Sum of existing tracked items for this context, in cents */
  currentTotalCents: number;
  /** User-reported actual total, in cents */
  reportedTotalCents: number;
  /** Optional session being reconciled */
  sessionId?: string | null;
  /** Wallet used, if known */
  walletId?: string | null;
  currency: string;
}
```

**Output**:

```typescript
interface AdjustmentResult {
  /** The adjustment transaction to persist (null if no difference) */
  transaction: Transaction | null;
  /** Positive = user spent more than tracked. Negative = user spent less */
  differenceCents: number;
  /** True when reportedTotal < currentTotal (requires user confirmation) */
  requiresConfirmation: boolean;
}
```

**Logic**:

1. `differenceCents` = `reportedTotalCents - currentTotalCents`
2. If `differenceCents === 0` → return `{ transaction: null, differenceCents: 0, requiresConfirmation: false }`
3. If `differenceCents > 0` → create positive adjustment (user spent more than tracked). `adjustmentReason = 'session_total_reconciliation'`.
4. If `differenceCents < 0` → set `requiresConfirmation = true`. The UI must warn the user and get explicit confirmation before the orchestrator persists. `adjustmentReason = 'session_total_reconciliation_negative'`.
5. Transaction fields:
   - `type` = `'adjustment'`
   - `amountCents` = `differenceCents` (can be negative)
   - `category` = `'reconciliation'`
   - `description` = `'Ajuste para total informado'` (via i18n key)
   - `personalCostCents` = `null` (adjustments don't track personal cost)

---

### 3.4 `categorizeUnassignedWallet`

Identify expenses without wallet assignment (DEC-051).

```typescript
/**
 * Filter transactions that have no wallet assigned.
 * These appear as "Carteira não informada" in the UI.
 *
 * @see DEC-051
 */
function categorizeUnassignedWallet(
  transactions: Transaction[],
): UnassignedWalletResult;
```

**Input**:

| Parameter | Filter criteria |
|-----------|----------------|
| `transactions` | All trip transactions where `deletedAt === null` |

**Output**:

```typescript
interface UnassignedWalletResult {
  /** Number of expenses without wallet */
  count: number;
  /** The unassigned transactions, sorted by date descending */
  transactions: Transaction[];
}
```

**Logic**:

1. Filter where `walletId === null` and `type === 'expense'`
2. Sort by `date` descending (most recent first)
3. Return count and filtered array

---

## 4. Money Utilities (`src/domain/money/`)

Pure math functions. No side effects. Heavily unit-tested.

### 4.1 `toCents`

```typescript
/**
 * Convert a decimal amount (e.g., 12.34) to integer cents (1234).
 * Rounds to nearest cent to handle floating-point imprecision.
 *
 * @see DEC-020
 */
function toCents(amount: number): number;
```

**Logic**: `Math.round(amount * 100)`

**Edge cases**:
- `toCents(0.1 + 0.2)` → `30` (not 30.000000000000004)
- `toCents(0)` → `0`
- `toCents(-12.34)` → `-1234`

---

### 4.2 `fromCents`

```typescript
/**
 * Convert integer cents (1234) to a decimal number (12.34).
 * Used only for display formatting — never for intermediate calculations.
 *
 * @see DEC-020
 */
function fromCents(cents: number): number;
```

**Logic**: `cents / 100`

---

### 4.3 `formatMoney`

```typescript
/**
 * Format cents into a locale-aware currency string.
 * Uses Intl.NumberFormat internally. All monetary displays in the UI
 * must use this function (or its React wrapper) for consistency.
 *
 * @example formatMoney(21720, 'EUR', 'pt-BR') → "€217,20"
 * @example formatMoney(-500, 'EUR', 'pt-BR') → "-€5,00"
 */
function formatMoney(
  amountCents: number,
  currency: string,
  locale: string,
): string;
```

**Rules**:
- V1 only uses `currency = 'EUR'` and `locale = 'pt-BR'` but the function must accept any valid values.
- Negative values display with a minus sign prefix.
- The UI must apply `font-variant-numeric: tabular-nums` on all outputs of this function.

---

### 4.4 `formatMoneyCompact`

```typescript
/**
 * Compact currency formatting without the currency symbol.
 * Useful for inline displays where the symbol is shown separately.
 *
 * @example formatMoneyCompact(21720, 'pt-BR') → "217,20"
 */
function formatMoneyCompact(
  amountCents: number,
  locale: string,
): string;
```

---

### 4.5 `splitEqually`

```typescript
/**
 * Split a total amount equally among N participants.
 * Handles remainder by distributing extra cents to first participants.
 *
 * @example splitEqually(1000, 3) → [334, 333, 333]
 * @example splitEqually(100, 4)  → [25, 25, 25, 25]
 *
 * Invariant: sum of returned array === totalCents (always)
 */
function splitEqually(
  totalCents: number,
  participantCount: number,
): number[];
```

**Logic**:

1. `baseCents` = `Math.floor(totalCents / participantCount)`
2. `remainder` = `totalCents % participantCount`
3. First `remainder` participants get `baseCents + 1`; rest get `baseCents`

**Note**: This is a pure math function used in D1 even though the full split engine is D2. The money utilities module provides the building blocks.

---

### 4.6 `splitCustom`

```typescript
/**
 * Validate a custom split where each participant has a manually assigned share.
 * Returns validated shares or an error if the sum doesn't match the total.
 *
 * @see D2 — full split engine. Included here because the math is domain-level.
 */
function splitCustom(
  totalCents: number,
  shares: ParticipantShareInput[],
): SplitCustomResult;
```

```typescript
interface ParticipantShareInput {
  participantId: string;
  shareCents: number;
}

type SplitCustomResult =
  | { ok: true; shares: ParticipantShareInput[] }
  | { ok: false; error: 'sum_mismatch'; expectedCents: number; actualCents: number }
  | { ok: false; error: 'negative_share'; participantId: string }
  | { ok: false; error: 'empty_shares' };
```

**Logic**:

1. If `shares` is empty → return `{ ok: false, error: 'empty_shares' }`
2. If any `shareCents < 0` → return error with the offending `participantId`
3. `actualTotal` = sum of all `shareCents`
4. If `actualTotal !== totalCents` → return `{ ok: false, error: 'sum_mismatch', expectedCents: totalCents, actualCents: actualTotal }`
5. Otherwise → return `{ ok: true, shares }`

---

### 4.7 `sumCents`

```typescript
/**
 * Type-safe summation of cents values from an array of objects.
 * Avoids repeated reduce boilerplate throughout the domain.
 */
function sumCents<T>(items: T[], selector: (item: T) => number): number;
```

**Logic**: `items.reduce((sum, item) => sum + selector(item), 0)`

---

## 5. Validation (`src/domain/validation/`)

Zod schemas for all D1 entities. Each schema validates input before entity creation or update.

### 5.1 Schema Overview

```typescript
import { z } from 'zod';

/** Reusable validators */
const centsSchema = z.number().int();
const positiveCentsSchema = z.number().int().min(1);
const nonNegativeCentsSchema = z.number().int().min(0);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDatetimeSchema = z.string().datetime();
const uuidSchema = z.string().uuid();
```

### 5.2 Entity Schemas

Each entity has a `create` schema (for new records) and an `update` schema (partial, for modifications).

```typescript
/** @returns Validated Trip input or ZodError */
const tripCreateSchema: z.ZodSchema<TripCreateInput>;

/** @returns Validated Phase input or ZodError */
const phaseCreateSchema: z.ZodSchema<PhaseCreateInput>;

/** @returns Validated BudgetPool input or ZodError */
const budgetPoolCreateSchema: z.ZodSchema<BudgetPoolCreateInput>;

/** @returns Validated Envelope input or ZodError */
const envelopeCreateSchema: z.ZodSchema<EnvelopeCreateInput>;

/** @returns Validated Transaction input or ZodError */
const transactionCreateSchema: z.ZodSchema<TransactionCreateInput>;

/** @returns Validated Wallet input or ZodError */
const walletCreateSchema: z.ZodSchema<WalletCreateInput>;

/** @returns Validated Participant input or ZodError */
const participantCreateSchema: z.ZodSchema<ParticipantCreateInput>;

/** @returns Validated BudgetPoolPhaseLink input or ZodError */
const budgetPoolPhaseLinkCreateSchema: z.ZodSchema<BudgetPoolPhaseLinkCreateInput>;

/** @returns Validated ActivityProfile input or ZodError */
const activityProfileCreateSchema: z.ZodSchema<ActivityProfileCreateInput>;

/** @returns Validated AppSettings update or ZodError */
const appSettingsUpdateSchema: z.ZodSchema<AppSettingsUpdateInput>;
```

### 5.3 Validation Functions

```typescript
/**
 * Validate entity input and return a typed result.
 * Wraps Zod's safeParse with a domain-friendly return type.
 */
function validateEntity<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): ValidationResult<T>;
```

```typescript
type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ValidationError[] };

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### 5.4 Key Validation Rules per Entity

| Entity | Critical Rules |
|--------|---------------|
| **Trip** | `name` non-empty, `startDate <= endDate`, `baseCurrency` = valid ISO 4217 |
| **Phase** | `name` non-empty, `startDate <= endDate`, `startDate >= trip.startDate`, `endDate <= trip.endDate`, `order >= 0` |
| **BudgetPool** | `name` non-empty, `totalAmountCents >= 0`, `scope` ∈ `['global', 'linked_phases']` |
| **Envelope** | `kind` ∈ `['protected_reserve', 'allocation']`, `amountCents >= 0`. At most one `protected_reserve` per pool (business rule, not schema) |
| **Transaction** | `amountCents > 0` for expense/transfer/settlement. Can be negative for adjustment. `budgetPoolId` required for expense/adjustment, null for transfer/settlement |
| **Wallet** | `name` non-empty, `walletType` valid, `initialBalanceCents >= 0` |
| **Participant** | `name` non-empty. `isOwner`: exactly one per trip (enforced by orchestrator) |

### 5.5 Cross-Entity Validation

```typescript
/**
 * Validate that a phase's date range falls within its trip's date range.
 */
function validatePhaseWithinTrip(phase: PhaseCreateInput, trip: Trip): ValidationResult<PhaseCreateInput>;

/**
 * Validate that phases within a trip don't overlap in dates.
 */
function validatePhasesNonOverlapping(phases: Phase[]): ValidationResult<Phase[]>;

/**
 * Validate that an expense's budgetPoolId is accessible from its phaseId.
 * A pool is accessible if:
 * - pool.scope === 'global', OR
 * - there exists a BudgetPoolPhaseLink connecting pool to phase
 */
function validateExpensePoolAccess(
  expense: { budgetPoolId: string; phaseId: string },
  pool: BudgetPool,
  phaseLinks: BudgetPoolPhaseLink[],
): ValidationResult<void>;

/**
 * Validate that at most one Envelope with kind 'protected_reserve'
 * exists per BudgetPool (DEC-042).
 */
function validateSingleProtectedReserve(
  poolId: string,
  existingEnvelopes: Envelope[],
  newKind: EnvelopeKind,
): ValidationResult<void>;

/**
 * Validate that at most one Wallet has isDefault = true per trip.
 */
function validateSingleDefaultWallet(
  tripId: string,
  existingWallets: Wallet[],
  newIsDefault: boolean,
): ValidationResult<void>;
```

---

## 6. Backup Engine (`src/domain/backup/`)

### 6.1 `createBackupPayload`

```typescript
/**
 * Assemble all entities into a backup payload with metadata.
 * Includes soft-deleted records (needed for merge).
 *
 * @see DEC-013, Section 7 of database-schema.md
 */
function createBackupPayload(
  entities: AllEntities,
  device: Device,
  appVersion: string,
): TripPilotBackup;
```

**Input**:

```typescript
interface AllEntities {
  trips: Trip[];
  phases: Phase[];
  budgetPools: BudgetPool[];
  budgetPoolPhaseLinks: BudgetPoolPhaseLink[];
  envelopes: Envelope[];
  activityProfiles: ActivityProfile[];
  scenarioPlans: ScenarioPlan[];
  scenarioAllocationItems: ScenarioAllocationItem[];
  plannedOccurrences: PlannedOccurrence[];
  participants: Participant[];
  wallets: Wallet[];
  transactions: Transaction[];
  participantShares: ParticipantShare[];
  sessions: Session[];
  sessionItems: SessionItem[];
  settlements: Settlement[];
  forecastSnapshots: ForecastSnapshot[];
  futurePhaseReservePolicies: FuturePhaseReservePolicy[];
  alertRules: AlertRule[];
  appSettings: AppSettings[];
  devices: Device[];
}
```

**Output**: `TripPilotBackup` (as defined in database-schema.md Section 7.1)

**Logic**:

1. Set `version` = current schema version (1 for D1)
2. Set `exportedAt` = current ISO 8601 datetime
3. Set `sourceDeviceId` = `device.id`
4. Set `sourceDeviceName` = `device.deviceName`
5. Set `appVersion` = from parameter
6. Set `data` = all entity arrays (including soft-deleted records)

---

### 6.2 `parseBackup`

```typescript
/**
 * Parse and validate a JSON backup string.
 * Returns the parsed payload or a descriptive error.
 */
function parseBackup(
  jsonString: string,
): ParseBackupResult;
```

```typescript
type ParseBackupResult =
  | { ok: true; backup: TripPilotBackup }
  | { ok: false; error: 'invalid_json'; message: string }
  | { ok: false; error: 'invalid_schema'; message: string; details: ValidationError[] }
  | { ok: false; error: 'unsupported_version'; version: number; maxSupported: number }
  | { ok: false; error: 'empty_file' };
```

**Logic**:

1. Try `JSON.parse(jsonString)`. If fails → `invalid_json`.
2. Validate against `TripPilotBackup` Zod schema. If fails → `invalid_schema`.
3. Check `version <= CURRENT_SCHEMA_VERSION`. If too high → `unsupported_version`.
4. If version < current → apply migrations (future concern).
5. Return parsed backup.

---

### 6.3 `analyzeImport`

```typescript
/**
 * Compare imported backup against local data to produce
 * a pre-import summary. Does NOT modify any data.
 *
 * @see Section 7.3–7.4 of database-schema.md
 */
function analyzeImport(
  local: AllEntities,
  imported: TripPilotBackup,
): ImportAnalysis;
```

**Output**:

```typescript
interface ImportAnalysis {
  backupVersion: number;
  exportedAt: string;
  sourceDeviceName: string | null;
  counts: {
    newRecords: number;
    updatedRecords: number;
    conflictingRecords: number;
    skippedRecords: number;
    deletedRecords: number;
  };
  conflicts: ImportConflict[];
  /** Per-table breakdown for the pre-import summary UI */
  perTable: ImportTableSummary[];
}

interface ImportConflict {
  table: string;
  id: string;
  localRevision: number;
  importRevision: number;
  localUpdatedAt: string;
  importUpdatedAt: string;
}

interface ImportTableSummary {
  table: string;
  newCount: number;
  updatedCount: number;
  conflictCount: number;
  skippedCount: number;
  deletedCount: number;
}
```

**Logic** (per entity, per table):

For each record in the imported data:
1. Look up by `id` in local data for the same table.
2. **New**: ID not found locally → count as `new`.
3. **Updated**: Found locally, import `revision` > local `revision` → count as `updated`.
4. **Conflict**: Found locally, same `revision` but different `updatedAt` → count as `conflict`, add to `conflicts` array.
5. **Skipped**: Found locally, import `revision` < local `revision` → count as `skipped`.
6. **Deleted**: Import record has `deletedAt` set but local record does not → count as `deleted`.

---

### 6.4 `mergeImport`

```typescript
/**
 * Apply merge logic to produce the final set of entities after import.
 * Requires conflict resolutions for any conflicting records.
 *
 * Returns merged entity arrays ready to persist.
 * Does NOT persist — the orchestrator handles the Dexie transaction.
 */
function mergeImport(
  local: AllEntities,
  imported: AllEntities,
  conflictResolutions: ConflictResolution[],
): MergeResult;
```

```typescript
interface ConflictResolution {
  table: string;
  id: string;
  /** 'keep_local' | 'use_imported' */
  resolution: 'keep_local' | 'use_imported';
}

interface MergeResult {
  /** Records to insert (new) */
  toInsert: AllEntities;
  /** Records to update (newer revision or resolved conflict) */
  toUpdate: AllEntities;
  /** Record IDs to soft-delete locally */
  toSoftDelete: Array<{ table: string; id: string }>;
}
```

**Logic**:

1. For each table and each imported record:
   - **New** (no local match) → add to `toInsert`
   - **Updated** (import revision > local) → add to `toUpdate`
   - **Conflict** → look up resolution. `'use_imported'` → add to `toUpdate`. `'keep_local'` → skip.
   - **Skipped** → ignore
   - **Deleted** (import has `deletedAt`, local doesn't) → add to `toSoftDelete`
2. Return the three categorized sets.

---

### 6.5 `buildCsvContent`

```typescript
/**
 * Generate CSV content from transactions with joined entity names.
 * Supports basic (17 fields) and advanced (23 fields) modes.
 *
 * @see DEC-058
 */
function buildCsvContent(
  transactions: Transaction[],
  context: CsvExportContext,
  mode: 'basic' | 'advanced',
): string;
```

```typescript
interface CsvExportContext {
  trips: Map<string, Trip>;
  phases: Map<string, Phase>;
  budgetPools: Map<string, BudgetPool>;
  envelopes: Map<string, Envelope>;
  sessions: Map<string, Session>;
  wallets: Map<string, Wallet>;
  participants: Map<string, Participant>;
  devices: Map<string, Device>;
  locale: string;
}
```

**Output**: A UTF-8 CSV string with BOM for Excel compatibility.

**Logic**:

1. Write header row (Portuguese headers per DEC-058):
   - Basic: `Data,Hora,Viagem,Fase,Fundo,Caixa,Categoria,Sessão,Descrição,Valor original,Moeda,Valor em moeda base,Carteira,Quem pagou,Custo pessoal,Valor compartilhado,Observações`
   - Advanced: basic + `,ID,Tipo da movimentação,Status,Criado em,Atualizado em,Dispositivo de origem`
2. For each transaction, resolve joined names from the context maps:
   - `Carteira` = wallet name or `"Não informada"` if `walletId === null`
   - `Quem pagou` = participant name or `"Eu"` if `paidByParticipantId === null`
   - `Status` = `deletedAt ? "Excluída" : "Ativa"`
3. Format money values using `fromCents` with locale-aware decimal separator.
4. Escape fields containing commas, quotes, or newlines per RFC 4180.

---

## 7. Date Utilities (`src/domain/dates/`)

### 7.1 `isPhaseActive`

```typescript
/**
 * Check if a phase's date range includes today.
 * Uses date-only comparison (YYYY-MM-DD), ignoring time.
 */
function isPhaseActive(phase: Phase, today?: string): boolean;
```

**Logic**: `phase.startDate <= today && today <= phase.endDate`

Default `today` = current date in `YYYY-MM-DD` format.

---

### 7.2 `getActivePhase`

```typescript
/**
 * Find the currently active phase for a trip.
 * Returns undefined if no phase covers today.
 * If multiple phases cover today, returns the one with lowest order.
 */
function getActivePhase(
  phases: Phase[],
  today?: string,
): Phase | undefined;
```

**Logic**:

1. Filter phases where `isPhaseActive(phase, today) && deletedAt === null`
2. Sort by `order` ascending
3. Return first, or `undefined`

---

### 7.3 `daysRemaining`

```typescript
/**
 * Calculate days remaining until a phase ends.
 * Returns 0 if the phase has already ended.
 */
function daysRemaining(phase: Phase, today?: string): number;
```

**Logic**:

1. Parse `phase.endDate` and `today` as dates
2. `diff` = date difference in days (using `date-fns/differenceInDays`)
3. Return `Math.max(0, diff + 1)` (inclusive of today)

---

### 7.4 `dayNumber`

```typescript
/**
 * Calculate the current day number within a phase.
 * Day 1 = phase start date. Returns 0 if before phase start.
 *
 * @example Phase starts 2026-07-01, today is 2026-07-14 → 14
 */
function dayNumber(phase: Phase, today?: string): number;
```

**Logic**:

1. Parse `phase.startDate` and `today`
2. `diff` = date difference in days
3. Return `Math.max(0, diff + 1)`

---

### 7.5 `formatPhaseRange`

```typescript
/**
 * Format a phase's date range for display.
 *
 * @example "01 jul – 21 jul" (same year, same month omitted on end)
 * @example "28 jun – 15 jul" (different months)
 */
function formatPhaseRange(
  phase: Phase,
  locale: string,
): string;
```

---

## 8. Cash Reconciliation (`src/domain/wallets/`) — **D2 Implementation, D1 Schema**

The cash reconciliation flow is implemented in **D2** (DEC-052) but the domain function signature is defined here because the schema and types are ready.

### 8.1 `reconcileCash`

```typescript
/**
 * DEFERRED — D2. Cash reconciliation flow.
 *
 * Compare physical cash count against expected wallet balance.
 * Suggest an adjustment transaction if there's a difference.
 *
 * @see DEC-052
 */
function reconcileCash(
  wallet: Wallet,
  countedAmountCents: number,
  transactions: Transaction[],
): CashReconciliationResult;
```

**Output**:

```typescript
interface CashReconciliationResult {
  /** What the app thinks the wallet should have */
  expectedBalanceCents: number;
  /** What the user physically counted */
  countedAmountCents: number;
  /** Positive = more cash than expected, negative = less */
  differenceCents: number;
  /** Suggested adjustment transaction (null if no difference) */
  suggestedAdjustment: Transaction | null;
}
```

**Logic**:

1. `expectedBalanceCents` = `calculateWalletBalance(wallet, transactions).currentBalanceCents`
2. `differenceCents` = `countedAmountCents - expectedBalanceCents`
3. If `differenceCents !== 0`:
   - Build adjustment transaction with `adjustmentReason = 'cash_reconciliation'`
   - `amountCents` = `Math.abs(differenceCents)`
   - If negative difference: `category = 'cash_adjustment'` (untracked spending)
   - If positive difference: `category = 'cash_adjustment'` with positive adjustment

---

## 9. Demo Data (`src/domain/demo/`)

### 9.1 `generateDemoData`

```typescript
/**
 * Generate a complete fictional trip demonstrating all D1 features.
 * Uses deterministic UUIDs for reproducible results.
 *
 * @see DEC-038
 */
function generateDemoData(deviceId: string): AllEntities;
```

**Output**: A complete `AllEntities` object containing:

| Entity | Count | Details |
|--------|-------|---------|
| Trip | 1 | Fictional trip with clear "demo" marker |
| Phases | 2 | Non-consecutive, linked to same pool |
| BudgetPools | 2 | 1 operational (linked_phases) + 1 personal shopping (global) |
| Participants | 3 | Fictional names |
| Wallets | 2 | One digital, one cash |
| Envelopes | 2 | 1 protected_reserve + 1 allocation |
| Transactions | 8–12 | Varied: expense, market, different categories |
| ActivityProfiles | 5 | Bar, Market, Restaurant, Outing, Home day |
| AppSettings | 1 | Default settings |

**Rules**:
- All names and places are fictional (DEC-014, Core Rule 15).
- Currency is EUR.
- Dates are relative to the current date (demo always feels "current").
- The trip has a visible "Dados de demonstração" marker in the `notes` field.

---

## 10. Onboarding Helpers (`src/domain/onboarding/`)

### 10.1 `buildInitialEntities`

```typescript
/**
 * Build the minimum set of entities from the onboarding wizard input.
 * Creates: Trip, Phase, BudgetPool, BudgetPoolPhaseLink,
 * Envelope (if protected reserve provided), owner Participant.
 *
 * @see DEC-036 (minimal onboarding)
 */
function buildInitialEntities(
  input: OnboardingInput,
  deviceId: string,
): OnboardingEntities;
```

```typescript
interface OnboardingInput {
  tripName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  currency: string;
  /** Total budget for the first pool, in cents */
  budgetAmountCents: number;
  /** Optional protected reserve, in cents (DEC-042) */
  protectedReserveCents?: number;
  /** Owner participant name */
  ownerName: string;
}

interface OnboardingEntities {
  trip: Trip;
  phase: Phase;
  budgetPool: BudgetPool;
  phaseLink: BudgetPoolPhaseLink;
  protectedReserveEnvelope: Envelope | null;
  ownerParticipant: Participant;
}
```

**Logic**:

1. Create Trip with status `'active'`
2. Create Phase with `order = 0`
3. Create BudgetPool with `scope = 'linked_phases'` and `totalAmountCents` from input
4. Create BudgetPoolPhaseLink connecting pool ↔ phase
5. If `protectedReserveCents > 0`: create Envelope with `kind = 'protected_reserve'`
6. Create Participant with `isOwner = true`
7. All entities share the same `createdAt`, `sourceDeviceId = deviceId`, `revision = 1`

---

### 10.2 `buildActivityProfileFromPreset`

```typescript
/**
 * Create ActivityProfile entities from a preset selection.
 * All profiles start with low confidence and estimated values.
 *
 * @see DEC-037 (editable presets)
 */
function buildActivityProfileFromPreset(
  tripId: string,
  preset: 'hospedado_familia' | 'viagem_urbana' | 'festival' | 'personalizado',
  deviceId: string,
): ActivityProfile[];
```

**Preset contents**:

| Preset | Profiles Generated |
|--------|--------------------|
| `hospedado_familia` | Home day, Market, Bar, Restaurant, Outing |
| `viagem_urbana` | Restaurant, Bar, Transport, Outing, Market |
| `festival` | Festival, Bar, Restaurant, Transport |
| `personalizado` | Empty array (user builds from scratch) |

All generated profiles have `confidence = 'low'`, `dataPointCount = 0`, `isCustom = false`.

---

## 11. Settings Helpers (`src/domain/settings/`)

### 11.1 `shouldShowBackupReminder`

```typescript
/**
 * Check if the backup reminder should be displayed.
 *
 * @see DEC-057 (backup reminder setting)
 */
function shouldShowBackupReminder(
  settings: AppSettings,
  now?: string,
): boolean;
```

**Logic**:

1. If `!settings.backupReminderEnabled` → `false`
2. If `settings.lastBackupAt === null` → `true` (never backed up)
3. `daysSinceLastBackup` = days between `settings.lastBackupAt` and `now`
4. Return `daysSinceLastBackup >= settings.backupReminderDays`

---

### 11.2 `getEffectiveQuickAddValues`

```typescript
/**
 * Resolve the effective quick-add button values using the 4-level override chain.
 * Level 1: Global defaults → Level 2: Profile → Level 3: Session start → Level 4: Live.
 *
 * @see DEC-045
 */
function getEffectiveQuickAddValues(
  globalDefaults: number[],
  profileValues: number[] | null,
  sessionValues?: number[] | null,
): number[];
```

**Logic**: Return the most specific non-null array. `sessionValues ?? profileValues ?? globalDefaults`.

---

## 12. Orchestrators (`src/domain/orchestrators/`)

Orchestrators are the **bridge** between the pure domain and the data layer. They call repositories to fetch data, then pass it to domain functions, then persist results. They are the only domain-adjacent code that can have side effects.

### 12.1 `getDashboardData`

```typescript
/**
 * Aggregate all data the dashboard needs in a single call.
 * Fetches from repositories, computes via domain functions, returns a DTO.
 *
 * @see DEC-055 (D1 dashboard: real data only)
 */
async function getDashboardData(
  tripId: string,
): Promise<DashboardData>;
```

```typescript
interface DashboardData {
  /** Current trip */
  trip: Trip;
  /** Active phase (or null if none) */
  activePhase: Phase | null;
  /** All trip phases for header navigation */
  phases: Phase[];
  /** Free-to-spend for the active phase's primary linked pool */
  freeToSpend: FreeToSpendResult | null;
  /** Phase-level aggregated status */
  phaseStatus: PhaseStatusResult | null;
  /** Personal shopping status (if global shopping pool exists) */
  personalShopping: PersonalShoppingResult | null;
  /** Recent transactions (last 5, sorted by date desc) */
  recentTransactions: Transaction[];
  /** Count of expenses without wallet assignment */
  unassignedWalletCount: number;
  /** Whether to show backup reminder */
  showBackupReminder: boolean;
}
```

**Calls** (parallelized where independent):

1. Fetch trip, phases, pools, envelopes, transactions, wallets, settings (parallel DB calls)
2. `getActivePhase(phases)` → activePhase
3. If activePhase exists:
   - Get pools for phase (linked + global)
   - `calculateFreeToSpend(...)` for each pool
   - `calculatePhaseStatus(...)`
4. Find global personal shopping pool → `calculatePersonalShoppingStatus(...)`
5. Get last 5 transactions → recentTransactions
6. `categorizeUnassignedWallet(transactions)` → count
7. `shouldShowBackupReminder(settings)` → boolean
8. Assemble and return `DashboardData`

---

### 12.2 `registerExpense`

```typescript
/**
 * Full expense registration flow:
 * validate → build transaction → persist → update wallet (if applicable).
 *
 * @returns The persisted transaction or validation errors
 */
async function registerExpense(
  input: BuildExpenseInput,
): Promise<RegisterExpenseResult>;
```

```typescript
type RegisterExpenseResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; errors: ValidationError[] };
```

**Sequence**:

1. Validate input via `transactionCreateSchema`
2. Validate pool accessibility via `validateExpensePoolAccess`
3. `buildExpenseTransaction(input, deviceId)` → transaction object
4. Persist transaction via repository
5. Return result

---

### 12.3 `performBackup`

```typescript
/**
 * Export flow: fetch all data → build payload → serialize to JSON.
 * Updates AppSettings.lastBackupAt after successful export.
 */
async function performBackup(): Promise<{
  jsonString: string;
  backup: TripPilotBackup;
}>;
```

**Sequence**:

1. Fetch ALL entities from all tables (including soft-deleted)
2. Fetch current device info
3. `createBackupPayload(entities, device, appVersion)` → backup
4. `JSON.stringify(backup)` → jsonString
5. Update `appSettings.lastBackupAt` = now
6. Return both

---

### 12.4 `performImport`

```typescript
/**
 * Import flow: parse → analyze → show summary → wait for user choice →
 * execute merge or replace.
 *
 * Split into two phases:
 * Phase 1: analyzeImportFile — returns summary for user review
 * Phase 2: executeImport — applies the chosen strategy
 */
async function analyzeImportFile(
  jsonString: string,
): Promise<AnalyzeImportResult>;

async function executeImport(
  strategy: 'merge' | 'replace',
  backup: TripPilotBackup,
  conflictResolutions?: ConflictResolution[],
): Promise<ExecuteImportResult>;
```

```typescript
type AnalyzeImportResult =
  | { ok: true; backup: TripPilotBackup; analysis: ImportAnalysis }
  | { ok: false; error: ParseBackupResult & { ok: false } };

type ExecuteImportResult =
  | { ok: true; summary: { inserted: number; updated: number; deleted: number } }
  | { ok: false; error: string };
```

---

### 12.5 `exportCsv`

```typescript
/**
 * CSV export flow: fetch transactions + related entities → build CSV.
 */
async function exportCsv(
  options: CsvExportOptions,
): Promise<string>;
```

```typescript
interface CsvExportOptions {
  mode: 'basic' | 'advanced';
  /** Filter by phase IDs. Empty = all phases */
  phaseIds?: string[];
  /** Filter by date range (ISO 8601 dates) */
  startDate?: string;
  endDate?: string;
}
```

**Sequence**:

1. Fetch transactions (with filters applied)
2. Fetch related entities into lookup maps
3. `buildCsvContent(transactions, context, mode)` → CSV string
4. Return CSV string

---

## 13. Shared Return Types (`src/domain/types/`)

Consolidated index of all result interfaces used across the domain layer.

```typescript
// ── Budget Engine ──
export interface FreeToSpendResult { ... }       // §2.1
export interface PoolSpentResult { ... }          // §2.2
export interface WalletBalanceResult { ... }      // §2.3
export interface PhaseStatusResult { ... }        // §2.4
export interface PoolSummary { ... }              // §2.4
export interface PersonalShoppingResult { ... }   // §2.5

// ── Transaction Engine ──
export interface BuildExpenseInput { ... }        // §3.1
export interface BuildTransferInput { ... }       // §3.2 (D2)
export interface BuildAdjustmentInput { ... }     // §3.3
export interface AdjustmentResult { ... }         // §3.3
export interface UnassignedWalletResult { ... }   // §3.4

// ── Money Utilities ──
export interface ParticipantShareInput { ... }    // §4.6
export type SplitCustomResult = ...               // §4.6

// ── Validation ──
export type ValidationResult<T> = ...             // §5.3
export interface ValidationError { ... }          // §5.3

// ── Backup Engine ──
export interface AllEntities { ... }              // §6.1
export type ParseBackupResult = ...               // §6.2
export interface ImportAnalysis { ... }           // §6.3
export interface ImportConflict { ... }           // §6.3
export interface ImportTableSummary { ... }       // §6.3
export interface ConflictResolution { ... }       // §6.4
export interface MergeResult { ... }              // §6.4
export interface CsvExportContext { ... }         // §6.5

// ── Cash Reconciliation (D2) ──
export interface CashReconciliationResult { ... } // §8.1

// ── Onboarding ──
export interface OnboardingInput { ... }          // §10.1
export interface OnboardingEntities { ... }       // §10.1

// ── Orchestrators ──
export interface DashboardData { ... }            // §12.1
export type RegisterExpenseResult = ...           // §12.2
export type AnalyzeImportResult = ...             // §12.4
export type ExecuteImportResult = ...             // §12.4
export interface CsvExportOptions { ... }         // §12.5
```

---

## 14. Delivery Scope Matrix

| # | Function | Module | Delivery | Notes |
|---|----------|--------|----------|-------|
| 1 | `calculateFreeToSpend` | budget | **D1** | Hero number |
| 2 | `calculatePoolSpent` | budget | **D1** | Pool breakdown |
| 3 | `calculateWalletBalance` | budget | **D1** | Transfer terms = 0 until D2 |
| 4 | `calculatePhaseStatus` | budget | **D1** | Aggregated view |
| 5 | `calculatePersonalShoppingStatus` | budget | **D1** | Global pool card |
| 6 | `buildExpenseTransaction` | transactions | **D1** | Core registration |
| 7 | `buildTransferTransaction` | transactions | **D2** | Cash withdrawals |
| 8 | `buildAdjustmentTransaction` | transactions | **D1** | Reconciliation |
| 9 | `categorizeUnassignedWallet` | transactions | **D1** | Dashboard count |
| 10 | `toCents` | money | **D1** | Foundation |
| 11 | `fromCents` | money | **D1** | Foundation |
| 12 | `formatMoney` | money | **D1** | All displays |
| 13 | `formatMoneyCompact` | money | **D1** | Inline displays |
| 14 | `splitEqually` | money | **D1** | Math utility |
| 15 | `splitCustom` | money | **D1** | Math utility |
| 16 | `sumCents` | money | **D1** | Helper |
| 17 | Zod entity schemas | validation | **D1** | All CRUD |
| 18 | `validateEntity` | validation | **D1** | Generic wrapper |
| 19 | Cross-entity validators | validation | **D1** | Integrity rules |
| 20 | `createBackupPayload` | backup | **D1** | Export |
| 21 | `parseBackup` | backup | **D1** | Import |
| 22 | `analyzeImport` | backup | **D1** | Pre-import summary |
| 23 | `mergeImport` | backup | **D1** | Merge logic |
| 24 | `buildCsvContent` | backup | **D1** | CSV export |
| 25 | `isPhaseActive` | dates | **D1** | Dashboard routing |
| 26 | `getActivePhase` | dates | **D1** | Dashboard |
| 27 | `daysRemaining` | dates | **D1** | Phase status |
| 28 | `dayNumber` | dates | **D1** | Phase display |
| 29 | `formatPhaseRange` | dates | **D1** | Phase headers |
| 30 | `reconcileCash` | wallets | **D2** | Cash reconciliation |
| 31 | `generateDemoData` | demo | **D1** | Welcome screen |
| 32 | `buildInitialEntities` | onboarding | **D1** | Onboarding wizard |
| 33 | `buildActivityProfileFromPreset` | onboarding | **D1** | Profile presets |
| 34 | `shouldShowBackupReminder` | settings | **D1** | Dashboard reminder |
| 35 | `getEffectiveQuickAddValues` | settings | **D1** | Quick-add config |
| 36 | `getDashboardData` | orchestrators | **D1** | Main orchestrator |
| 37 | `registerExpense` | orchestrators | **D1** | Expense flow |
| 38 | `performBackup` | orchestrators | **D1** | Backup flow |
| 39 | `analyzeImportFile` | orchestrators | **D1** | Import phase 1 |
| 40 | `executeImport` | orchestrators | **D1** | Import phase 2 |
| 41 | `exportCsv` | orchestrators | **D1** | CSV flow |

### DEFERRED Functions (NOT in D1)

| Function | Module | Delivery | Depends On |
|----------|--------|----------|------------|
| `buildTransferTransaction` | transactions | D2 | Wallet transfer engine |
| `reconcileCash` | wallets | D2 | Cash flow tracking |
| `calculateDebtBalance` | splitting | D2 | Split engine |
| `buildSettlementTransaction` | transactions | D2 | Settlement engine |
| `computeForecast` | forecast | D3 | Forecast engine |
| `calculateReserveRecommendation` | budget | D3 | Forecast engine |
| `simulateExpenseImpact` | simulator | D3 | Simulation engine |
| `generateTradeOffSuggestions` | scenarios | D3 | Scenario engine |
| `startSession` / `endSession` | sessions | D4 | Session engine |
| `computeProgressiveAlerts` | alerts | D4 | Alert engine |
| `calculateNextDrinkImpact` | sessions | D4 | Session + forecast engines |
| `updateProfileLearning` | learning | D3 | Learning engine |

---

## 15. Testing Priority

Domain functions are the **highest priority** for unit testing (DEC-054). Every function in this document that is marked **D1** must have comprehensive test coverage.

### Critical Test Scenarios

| Function | Must-Test Scenarios |
|----------|---------------------|
| `calculateFreeToSpend` | Zero budget, negative result, no envelopes, no phase links, global pool, multiple future phases |
| `calculatePoolSpent` | Empty transactions, mix of expense + adjustment, negative adjustments |
| `calculateWalletBalance` | Initial only, with expenses, with transfers (D2 prep), zero balance |
| `splitEqually` | Even split, remainder distribution, single participant, large amounts |
| `splitCustom` | Valid split, sum mismatch, negative share, empty shares |
| `toCents` / `fromCents` | Floating-point edge cases (0.1+0.2), zero, negatives |
| `formatMoney` | EUR formatting, negative amounts, zero, large amounts |
| `buildExpenseTransaction` | Required fields, optional wallet, all SyncMetadata populated |
| `buildAdjustmentTransaction` | Positive diff, negative diff (requires confirmation), zero diff |
| `analyzeImport` | New records, updates, conflicts, skipped, deleted, empty backup |
| `mergeImport` | Each resolution path, mixed tables, soft-delete propagation |
| `parseBackup` | Valid JSON, invalid JSON, wrong schema, version mismatch, empty |
| `buildCsvContent` | Basic mode 17 fields, advanced mode 23 fields, special chars in description |
| `generateDemoData` | All entities present, valid references, dates relative to now |
| `buildInitialEntities` | With/without protected reserve, all fields populated |
| Entity schemas | Required fields, type coercion, boundary values, invalid inputs |

---

## 16. Decision Cross-Reference

| Decision | Affected Functions |
|----------|--------------------|
| DEC-006 | `calculatePhaseStatus` (dailyBudget is secondary only) |
| DEC-013 | `createBackupPayload`, `parseBackup`, `analyzeImport`, `mergeImport` |
| DEC-016 | `calculateFreeToSpend` (futureFloor calculation) |
| DEC-020 | ALL money functions (`toCents`, `fromCents`, `formatMoney`, all `*Cents` fields) |
| DEC-023 | `calculateFreeToSpend` (hero number formula) |
| DEC-036 | `buildInitialEntities` (minimal onboarding) |
| DEC-037 | `buildActivityProfileFromPreset` (editable presets) |
| DEC-038 | `generateDemoData` (fictional trip) |
| DEC-039 | `validateExpensePoolAccess` (phase without pool) |
| DEC-041 | `calculatePersonalShoppingStatus` (global pool) |
| DEC-042 | `calculateFreeToSpend` (protected reserve from Envelope), `validateSingleProtectedReserve` |
| DEC-045 | `getEffectiveQuickAddValues` (4-level override) |
| DEC-046 | `buildAdjustmentTransaction` (reconciliation, never delete history) |
| DEC-051 | `categorizeUnassignedWallet`, `buildExpenseTransaction` (optional wallet) |
| DEC-052 | `reconcileCash` (D2) |
| DEC-053 | `buildExpenseTransaction` (never block, domain doesn't enforce limits) |
| DEC-054 | All functions (tested from D1) |
| DEC-055 | `getDashboardData` (only real data, no placeholders) |
| DEC-057 | `shouldShowBackupReminder`, `getEffectiveQuickAddValues` |
| DEC-058 | `buildCsvContent` (17 basic + 6 advanced fields) |

---

*This document is a planning reference. It defines WHAT the domain layer computes, not HOW it's implemented. Implementation agents (Carla for logic, Marcelo for UI integration) should use this as their contract. All interfaces reference the canonical types in `TripPilot/brain/documents/database-schema.md`.*
