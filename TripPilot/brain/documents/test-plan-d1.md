# TripPilot — Test Plan: Delivery 1

> Version: 1.0 | Date: 2026-06-08
> Scope: D1 features only — deferred areas clearly marked
> Source: master-spec-d1.md, database-schema.md, decision-log.md (60 decisions)

---

## 1. Testing Strategy

### Test Pyramid

| Layer | Tool | Focus | Volume |
|-------|------|-------|--------|
| **Unit** | Vitest | Pure domain logic — budget math, money utilities, validation, backup/import logic | Many (~120+ cases) |
| **Component** | React Testing Library (RTL) | Critical UI components — forms, dashboard hero, selectors, navigation | Fewer (~40 cases) |
| **E2E** | Playwright | Full user flows — onboarding, expense registration, backup/restore, demo data | Few (6 flows) |

### Principles

1. **Domain logic is pure TypeScript** — lives in `src/domain/` and `src/utils/`, no React, no Dexie. Fastest to run, highest coverage target.
2. **Component tests render real components** — use `@testing-library/react` with user-event. Mock only Dexie/repository calls at the data boundary.
3. **E2E tests run against the built app** — Playwright in a mobile viewport (390×844), testing real IndexedDB.
4. **All test files live under `src/tests/`** following project structure conventions.
5. **All test code in English** — test names, variables, comments (DEC-025 / Rule 11).
6. **Cents-based inputs/outputs** — tests use integer cents (DEC-020). Display formatting tested separately.

### What D1 Tests Cover vs Defer

| Covered in D1 | Deferred |
|----------------|----------|
| Budget calculations (freeToSpend, pool spent) | Split engine equal/custom split (D2) |
| Money utilities (toCents, fromCents, formatMoney) | Debt tracking and settlement flows (D2) |
| Transaction creation (expense, adjustment) | Cash withdrawal as wallet transfer (D2) |
| Multi-phase pool with reserve and floor | Forecast engine calculations (D3) |
| Wallet balance derivation | Scenario planner with [-]/[+] controls (D3) |
| Backup create/parse/merge/replace | Simulator risk assessment (D3) |
| CSV export field ordering | Outing Mode session lifecycle (D4) |
| Date utilities (phase status) | Progressive alerts (D4) |
| Zod validation schemas | PWA service worker / offline cache (D5) |
| Dashboard rendering | Light mode theme (D5) |
| Expense form submission | Multi-currency conversion (future) |

---

## 2. Unit Tests — Domain Logic (Vitest)

### 2.1 Budget Calculations

#### 2.1.1 `calculateFreeToSpend`

The hero number. Formula: `poolTotal - totalSpent - protectedReserve - futureFloor` (DEC-023).

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns full pool amount when no expenses, no reserve, no floor | pool: 76000, spent: 0, reserve: 0, floor: 0 | 76000 | Baseline — no deductions |
| 2 | subtracts single expense from pool | pool: 76000, spent: 700, reserve: 0, floor: 0 | 75300 | Basic arithmetic |
| 3 | subtracts protected reserve from pool | pool: 76000, spent: 0, reserve: 10000, floor: 0 | 66000 | Reserve deduction (DEC-042) |
| 4 | subtracts future floor from pool | pool: 76000, spent: 0, reserve: 0, floor: 17000 | 59000 | Future floor deduction (DEC-016) |
| 5 | subtracts all three deductions | pool: 76000, spent: 2800, reserve: 10000, floor: 17000 | 46200 | Combined: 76000 - 2800 - 10000 - 17000 |
| 6 | returns zero when deductions exceed pool | pool: 76000, spent: 50000, reserve: 10000, floor: 17000 | -1000 | Over-budget — never blocked (DEC-053) |
| 7 | handles pool amount of zero | pool: 0, spent: 0, reserve: 0, floor: 0 | 0 | Zero budget allowed (DEC-053) |
| 8 | handles negative result from adjustments | pool: 76000, spent: 80000, reserve: 0, floor: 0 | -4000 | Negative freeToSpend permitted |
| 9 | multi-phase €760 pool scenario | pool: 76000, spent (all phases): 15000, reserve: 10000, floor: 17000 | 34000 | DEC-007: pool serves 2 phases |
| 10 | ignores soft-deleted transactions | pool: 76000, expenses: [700 active, 500 deleted], reserve: 0, floor: 0 | 75300 | Only active records count |
| 11 | includes adjustment transactions in spent | pool: 76000, expenses: [2100], adjustments: [1400], reserve: 0, floor: 0 | 72500 | DEC-046: reconciliation adjustments |
| 12 | includes negative adjustments | pool: 76000, expenses: [2100], adjustments: [-500], reserve: 0, floor: 0 | 74400 | Negative adjustment reduces spent |

#### 2.1.2 `calculatePoolSpent`

Total spent against a specific BudgetPool across all linked phases.

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns zero when no transactions | transactions: [] | 0 | Empty pool |
| 2 | sums expenses only | expenses: [700, 500, 1200] | 2400 | Basic sum |
| 3 | sums expenses and adjustments | expenses: [700], adjustments: [1400] | 2100 | DEC-046 |
| 4 | excludes transfer transactions | expenses: [700], transfers: [5000] | 700 | Transfers don't affect budget (Rule 3) |
| 5 | excludes settlement transactions | expenses: [700], settlements: [2000] | 700 | Settlements don't affect budget (Rule 4) |
| 6 | excludes soft-deleted transactions | expenses: [700 active, 500 deleted] | 700 | Soft delete filter |
| 7 | handles negative adjustments | expenses: [2100], adjustments: [-500] | 1600 | Net spent after negative adjustment |

#### 2.1.3 `calculateWalletBalance`

Derived: `initialBalance + transfersIn - transfersOut - expenses` (schema §5.6).

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns initial balance when no transactions | initial: 50000, txns: [] | 50000 | New wallet |
| 2 | subtracts expenses from balance | initial: 50000, expenses: [700, 500] | 48800 | Basic expense |
| 3 | adds incoming transfers | initial: 50000, transfersIn: [10000] | 60000 | Wallet receives transfer |
| 4 | subtracts outgoing transfers | initial: 50000, transfersOut: [5000] | 45000 | Wallet sends transfer |
| 5 | handles combined operations | initial: 50000, expenses: [1200], transfersIn: [10000], transfersOut: [5000] | 53800 | All operation types |
| 6 | returns zero for deleted wallet | wallet: { deletedAt: '2026-07-01' } | 0 | Soft-deleted wallet |
| 7 | excludes transactions from soft-deleted records | initial: 50000, expenses: [700 active, 500 deleted] | 49300 | Deleted txn filter |
| 8 | handles wallet with zero initial balance | initial: 0, transfersIn: [10000] | 10000 | Cash wallet starting empty |

### 2.2 Money Utilities

#### 2.2.1 `toCents` / `fromCents`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | toCents converts €12.34 | 12.34 | 1234 | Standard precision |
| 2 | toCents converts €0.01 | 0.01 | 1 | Minimum cent value |
| 3 | toCents converts €0.00 | 0.00 | 0 | Zero |
| 4 | toCents rounds €12.345 | 12.345 | 1235 | Floating-point rounding (banker's rounding) |
| 5 | toCents rounds €12.344 | 12.344 | 1234 | Round down |
| 6 | toCents handles €999.99 | 999.99 | 99999 | Large value |
| 7 | toCents handles negative value | -7.50 | -750 | Negative adjustment |
| 8 | fromCents converts 1234 | 1234 | 12.34 | Standard |
| 9 | fromCents converts 1 | 1 | 0.01 | Minimum |
| 10 | fromCents converts 0 | 0 | 0.00 | Zero |
| 11 | fromCents handles large value | 99999 | 999.99 | Large |
| 12 | fromCents handles negative | -750 | -7.50 | Negative |
| 13 | toCents(fromCents(x)) round-trip | 1234 | 1234 | Identity |
| 14 | toCents avoids floating-point error with 0.1 + 0.2 | 0.30 (from 0.1 + 0.2) | 30 | IEEE 754 trap |

#### 2.2.2 `formatMoney`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | formats positive EUR in pt-BR | 1234, 'EUR', 'pt-BR' | "€ 12,34" or "€12,34" | Locale formatting |
| 2 | formats zero | 0, 'EUR', 'pt-BR' | "€ 0,00" | Zero display |
| 3 | formats large amount | 99999, 'EUR', 'pt-BR' | "€ 999,99" | Large |
| 4 | formats negative amount | -750, 'EUR', 'pt-BR' | "-€ 7,50" | Negative adjustment |
| 5 | formats with en-US locale | 1234, 'EUR', 'en-US' | "€12.34" | Future i18n |

#### 2.2.3 `splitEqually`

DEFERRED (D2) — split engine. However, the pure math utility for remainder distribution is testable now.

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | splits evenly into 3 | amount: 6000, count: 3 | [2000, 2000, 2000] | Even division |
| 2 | distributes remainder across first N participants | amount: 1000, count: 3 | [334, 333, 333] | 1000 / 3 = 333.33, remainder = 1 |
| 3 | distributes 2-cent remainder | amount: 1001, count: 3 | [334, 334, 333] | Remainder = 2 |
| 4 | handles single person | amount: 1000, count: 1 | [1000] | No split needed |
| 5 | handles two people | amount: 1001, count: 2 | [501, 500] | Remainder = 1 |
| 6 | handles zero amount | amount: 0, count: 3 | [0, 0, 0] | Zero split |
| 7 | sum of shares equals original amount | amount: 10000, count: 7 | sum === 10000 | Invariant check |

### 2.3 Transaction Creation

#### 2.3.1 `createExpenseTransaction`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | creates expense with all required fields | amount: 700, poolId, phaseId, category: 'bar' | Transaction with type 'expense', amountCents: 700 | Standard expense |
| 2 | creates non-shared expense with personalCost = amount | amount: 700, isShared: false | personalCostCents: 700 | Non-shared (Rule 2) |
| 3 | creates expense without wallet | amount: 700, walletId: null | walletId: null | DEC-051 "Carteira não informada" |
| 4 | creates expense with wallet | amount: 700, walletId: 'w1' | walletId: 'w1' | With wallet |
| 5 | creates expense with default wallet pre-selected | defaultWalletId: 'w1' | walletId: 'w1' | DEC-051 default |
| 6 | generates UUID v4 for id | — | id matches UUID v4 pattern | DEC-003 |
| 7 | sets createdAt and updatedAt | — | Both set to ISO 8601 now | Sync metadata |
| 8 | sets revision to 1 | — | revision: 1 | Initial revision |
| 9 | sets deletedAt to null | — | deletedAt: null | Active record |
| 10 | rejects amount of zero | amount: 0 | throws validation error | Amount validation |
| 11 | rejects negative amount for expense | amount: -500 | throws validation error | Expenses must be positive |
| 12 | sets baseCurrencyAmountCents equal to amountCents for EUR | amount: 700, currency: 'EUR' | baseCurrencyAmountCents: 700 | DEC-021 EUR-only V1 |
| 13 | sets exchangeRate to null for EUR | currency: 'EUR' | exchangeRate: null | Same currency |

#### 2.3.2 `createAdjustmentTransaction`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | creates positive adjustment | amount: 1400, reason: 'Ajuste para total informado' | type: 'adjustment', amountCents: 1400 | DEC-046 |
| 2 | creates negative adjustment | amount: -500, reason: 'Ajuste para total informado' | type: 'adjustment', amountCents: -500 | DEC-046 conflict |
| 3 | requires adjustment reason | amount: 1400, reason: null | throws validation error | Reason is required |
| 4 | sets budgetPoolId | poolId: 'p1' | budgetPoolId: 'p1' | Adjustments affect budget |
| 5 | sets personalCostCents to null | — | personalCostCents: null | Adjustments have no personal cost |

#### 2.3.3 `createTransferTransaction` — DEFERRED (D2)

Schema exists. Full transfer flow tested in D2 when wallet-to-wallet movement is implemented.

#### 2.3.4 `createSettlementTransaction` — DEFERRED (D2)

Schema exists. Full settlement flow tested in D2 when debt tracking is implemented.

### 2.4 Multi-Phase Pool Logic

The €760 pool serving 2 non-consecutive phases (DEC-007).

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | pool links to two phases | pool: 76000, links: [phase1, phase3] | Both phases accessible | DEC-007 |
| 2 | expenses from both phases reduce same pool | pool: 76000, phase1 expenses: 5000, phase3 expenses: 3000 | totalSpent: 8000 | Cross-phase spending |
| 3 | freeToSpend accounts for all phases' spending | pool: 76000, spent (all): 15000, reserve: 10000, floor: 17000 | 34000 | Full scenario |
| 4 | future floor applies only to future phase link | pool: 76000, link1: floor 0, link2: floor 17000, current: phase1 | futureFloor: 17000 | DEC-016 |
| 5 | future floor is zero when current phase is the last one | pool: 76000, current: phase3 (last) | futureFloor: 0 | No future to protect |
| 6 | protected reserve is per-pool not per-phase | pool: 76000, reserve envelope: 10000 | reserve: 10000 regardless of active phase | DEC-042 single source |
| 7 | phase without pool returns empty pool list | phase: no links | getPoolsForPhase: [] (linked only) | DEC-039 |
| 8 | phase accesses both linked and global pools | phase with 1 linked pool + 1 global pool | getPoolsForPhase: 2 pools | DEC-040 |
| 9 | auto-selects pool when only one operational | phase with 1 linked pool, 0 global | selected pool = the linked one | DEC-040 auto-select |

### 2.5 Unassigned Wallet Filter

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns expenses with null walletId | 3 expenses: [walletId: 'w1', null, 'w2'] | [expense with null] | DEC-051 |
| 2 | returns empty when all have wallets | 3 expenses: all with walletId | [] | No unassigned |
| 3 | excludes soft-deleted null-wallet expenses | 2 null-wallet: [active, deleted] | [active only] | Soft delete filter |
| 4 | counts unassigned correctly | 5 expenses: 3 with null walletId | count: 3 | Dashboard counter |

### 2.6 Backup & Import

#### 2.6.1 `createBackup`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | includes all entity tables | full database | backup.data has 21 table keys | Complete backup |
| 2 | includes schema version | — | backup.version: 1 | Migration compatibility |
| 3 | includes export timestamp | — | backup.exportedAt: ISO 8601 | Timestamp |
| 4 | includes source device info | device: { id, name } | backup.sourceDeviceId, backup.sourceDeviceName | Device tracking |
| 5 | includes app version | — | backup.appVersion: string | Version tracking |
| 6 | includes soft-deleted records | 1 active + 1 deleted expense | both in backup.data.transactions | Merge requires deleted records |
| 7 | exports valid JSON | — | JSON.parse(JSON.stringify(backup)) succeeds | Serialization |

#### 2.6.2 `parseBackup`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | parses valid backup JSON | valid JSON string | TripPilotBackup object | Happy path |
| 2 | rejects invalid JSON | "not json {{{" | throws parse error | Corrupt file |
| 3 | rejects missing version field | JSON without version | throws validation error | Schema check |
| 4 | rejects missing data field | JSON without data | throws validation error | Structure check |
| 5 | rejects empty string | "" | throws parse error | Empty file |
| 6 | accepts backup with empty entity arrays | valid structure, all arrays empty | valid backup | Fresh export |
| 7 | rejects backup with wrong data types | version: "one" (string not number) | throws validation error | Type safety |

#### 2.6.3 `mergeImport`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | inserts new records (ID not in local) | import: trip 'A', local: empty | trip 'A' inserted | New record |
| 2 | updates record when import revision > local | import: trip rev 3, local: trip rev 2 | trip updated to rev 3 | Newer wins |
| 3 | skips record when import revision < local | import: trip rev 1, local: trip rev 2 | local unchanged | Local is newer |
| 4 | flags conflict when same revision but different updatedAt | import: rev 2 updatedAt T1, local: rev 2 updatedAt T2 | conflict record emitted | Requires user decision |
| 5 | soft-deletes locally when import has deletedAt | import: trip deletedAt set, local: active | local trip soft-deleted | Deletion propagation |
| 6 | generates correct import summary counts | mixed: 2 new, 1 updated, 1 skipped, 1 conflict | summary.counts matches | Pre-import summary |
| 7 | handles empty import (no records) | all entity arrays empty | no changes, summary all zeros | Empty backup import |
| 8 | merges across all entity tables | import with trips, phases, pools, transactions | all tables processed | Complete merge |

#### 2.6.4 `replaceImport`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | deletes all local data before inserting | local: 5 trips, import: 1 trip | only 1 trip exists | Clean replace |
| 2 | resets AppSettings from import | import has custom settings | settings match import | Settings replaced |

### 2.7 CSV Export

#### 2.7.1 `exportBasicCsv`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | produces 17 columns | 1 expense | CSV row with 17 fields | DEC-058 basic |
| 2 | headers match Portuguese field names | — | first row: "Data,Hora,Viagem,..." | i18n headers |
| 3 | formats date correctly | date: '2026-07-15T23:30:00.000Z' | "15/07/2026" or ISO date | Date column |
| 4 | formats time correctly | date: '2026-07-15T23:30:00.000Z' | "23:30" | Time column |
| 5 | joins trip name from Trip entity | tripId → trip.name | "Viagem Europa 2026" | Joined field |
| 6 | joins phase name from Phase entity | phaseId → phase.name | "Burgos antes" | Joined field |
| 7 | joins pool name from BudgetPool entity | budgetPoolId → pool.name | "Fundo Burgos" | Joined field |
| 8 | shows "Não informada" for null wallet | walletId: null | "Não informada" | DEC-051 |
| 9 | formats amount from cents | amountCents: 1234 | "12.34" or "12,34" | Cents display |
| 10 | escapes commas in description | description: "Cerveja, batata" | "\"Cerveja, batata\"" | CSV escaping |
| 11 | escapes quotes in description | description: 'Cerveja "artesanal"' | "\"Cerveja \"\"artesanal\"\"\"" | CSV escaping |
| 12 | handles empty notes | notes: null | empty field | Nullable |

#### 2.7.2 `exportAdvancedCsv`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | produces 23 columns | 1 expense | CSV row with 23 fields | DEC-058 advanced |
| 2 | includes transaction ID | — | field 18 = UUID | ID field |
| 3 | includes transaction type | type: 'expense' | field 19 = "expense" | Type field |
| 4 | shows "Ativa" for active records | deletedAt: null | field 20 = "Ativa" | Status |
| 5 | shows "Excluída" for deleted records | deletedAt: ISO string | field 20 = "Excluída" | Status |
| 6 | includes device name | sourceDeviceId → device.deviceName | field 23 = "Pixel 7" | Device join |

### 2.8 Date Utilities

#### 2.8.1 `isPhaseActive`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns true for today within range | start: yesterday, end: tomorrow | true | Active phase |
| 2 | returns true for start date = today | start: today, end: tomorrow | true | Boundary start |
| 3 | returns true for end date = today | start: yesterday, end: today | true | Boundary end |
| 4 | returns false for past phase | start: -10d, end: -5d | false | Past |
| 5 | returns false for future phase | start: +5d, end: +10d | false | Future |

#### 2.8.2 `daysRemaining`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns correct count for active phase | end: today + 5 | 5 | Normal |
| 2 | returns 0 for last day | end: today | 0 | Last day |
| 3 | returns negative for past phase | end: today - 3 | -3 | Past phase |

#### 2.8.3 `dayNumber`

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | returns 1 on first day | start: today, referenceDate: today | 1 | First day |
| 2 | returns correct day number mid-phase | start: today - 4, referenceDate: today | 5 | Mid-phase |

### 2.9 Cash Reconciliation Logic — DEFERRED (D2)

Per DEC-052, full cash reconciliation flow is D2. However, the adjustment creation logic tested in §2.3.2 covers the reconciliation math.

Specific D2 tests:
- `DEFERRED` expected vs counted difference (positive and negative)
- `DEFERRED` adjustment creation with category "cash_adjustment"
- `DEFERRED` wallet balance update after reconciliation

### 2.10 Validation Schemas (Zod)

#### 2.10.1 Trip Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid trip | { name: "Europa", baseCurrency: "EUR", startDate: "2026-07-01", endDate: "2026-08-15", status: "planning" } | passes | Valid |
| 2 | rejects missing name | { name: "" } | fails: name required | Empty name |
| 3 | rejects invalid date format | { startDate: "July 1" } | fails: invalid date | Date format |
| 4 | rejects endDate before startDate | { start: "2026-08-15", end: "2026-07-01" } | fails: endDate < startDate | Logical constraint |
| 5 | rejects invalid status | { status: "deleted" } | fails: invalid enum | Status enum |
| 6 | accepts null notes | { notes: null } | passes | Nullable field |

#### 2.10.2 Phase Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid phase | { tripId, name, startDate, endDate, order: 0 } | passes | Valid |
| 2 | rejects missing tripId | { tripId: undefined } | fails | Required FK |
| 3 | rejects negative order | { order: -1 } | fails | Order >= 0 |

#### 2.10.3 BudgetPool Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid linked_phases pool | { scope: "linked_phases", totalAmountCents: 76000 } | passes | Valid |
| 2 | accepts valid global pool | { scope: "global", totalAmountCents: 10000 } | passes | DEC-041 |
| 3 | rejects invalid scope | { scope: "local" } | fails | Scope enum |
| 4 | accepts zero amount | { totalAmountCents: 0 } | passes | Zero budget allowed |
| 5 | rejects negative amount | { totalAmountCents: -100 } | fails | Can't be negative |

#### 2.10.4 Transaction Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid expense | { type: "expense", amountCents: 700, budgetPoolId: "p1" } | passes | Standard |
| 2 | rejects expense with zero amount | { type: "expense", amountCents: 0 } | fails | Zero not allowed |
| 3 | rejects expense with negative amount | { type: "expense", amountCents: -100 } | fails | Expense must be positive |
| 4 | accepts adjustment with negative amount | { type: "adjustment", amountCents: -500 } | passes | DEC-046 |
| 5 | accepts null walletId | { walletId: null } | passes | DEC-051 |
| 6 | requires budgetPoolId for expense | { type: "expense", budgetPoolId: null } | fails | Expense needs pool |
| 7 | allows null budgetPoolId for transfer | { type: "transfer", budgetPoolId: null } | passes | Transfer no pool (Rule 3) |
| 8 | allows null budgetPoolId for settlement | { type: "settlement", budgetPoolId: null } | passes | Settlement no pool (Rule 4) |
| 9 | rejects invalid type | { type: "refund" } | fails | Type enum |

#### 2.10.5 Envelope Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts protected_reserve | { kind: "protected_reserve", amountCents: 10000 } | passes | DEC-042 |
| 2 | accepts allocation | { kind: "allocation", amountCents: 5000 } | passes | Valid kind |
| 3 | rejects informational kind | { kind: "informational" } | fails | Removed from MVP (DEC-042) |
| 4 | rejects negative amount | { amountCents: -100 } | fails | Can't be negative |

#### 2.10.6 Wallet Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid wallet | { name: "Wise", walletType: "digital", currency: "EUR" } | passes | Valid |
| 2 | rejects invalid walletType | { walletType: "bitcoin" } | fails | WalletType enum |
| 3 | accepts zero initial balance | { initialBalanceCents: 0 } | passes | Cash wallet no balance |

#### 2.10.7 AppSettings Validation

| # | Test Name | Input | Expected Output | Edge Case |
|---|-----------|-------|-----------------|-----------|
| 1 | accepts valid settings | full valid AppSettings object | passes | Standard |
| 2 | rejects invalid alertTone | { alertTone: "mean" } | fails | AlertTone enum |
| 3 | rejects invalid theme | { theme: "neon" } | fails | ThemePreference enum |
| 4 | accepts null defaultWalletId | { defaultWalletId: null } | passes | No default wallet |
| 5 | rejects backupReminderDays <= 0 | { backupReminderDays: 0 } | fails | Must be positive |

---

## 3. Component Tests — Critical UI (React Testing Library)

### 3.1 Dashboard

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Renders "Livre para usar" hero with correct formatted amount | Hero displays formatted currency from budget engine result |
| 2 | Shows phase name and date range in header | Header text matches active phase data |
| 3 | Shows fund balance breakdown below hero | Breakdown shows: Saldo restante, Reservado para fases futuras, Reserva protegida, = Livre para usar |
| 4 | Shows personal shopping card with remaining amount | Card shows remaining from global shopping pool (DEC-041) |
| 5 | Shows recent expenses list | Last N expenses with category icon, amount, time |
| 6 | Shows FAB button | Central `+` button is visible and clickable |
| 7 | Does NOT render engine-dependent cards | No occasion counters, savings, amigo sincero, active outing, pending shared (DEC-055) |
| 8 | Shows correct empty state when no expenses | Empty state with CTA to register first expense |
| 9 | Shows demo banner when demo data loaded | "Dados de demonstração" banner visible (DEC-038) |
| 10 | Hero label includes phase end date | "Livre para usar até [data]" (DEC-023) |

### 3.2 Expense Form

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Submits expense with all fields filled | Creates Transaction with correct values, navigates back |
| 2 | Submits expense without wallet selection | Creates Transaction with walletId: null (DEC-051) |
| 3 | Validates amount > 0 | Shows error when amount is 0 or empty |
| 4 | Shows budget pool selector | BudgetPool options populated from phase pools |
| 5 | Auto-selects pool when only one operational | Pool pre-selected, selector may be hidden |
| 6 | Shows category selector with preset categories | Category list includes bar, market, restaurant, etc. |
| 7 | Pre-selects market category for "Registrar mercado" | Category field pre-filled with "market" |
| 8 | Pre-selects default wallet but allows clearing | Default wallet shown, clear button works (DEC-051) |
| 9 | Shows confirmation when budget is zero/negative | Warning dialog appears, allows proceeding (DEC-053) |
| 10 | Amount input accepts decimal values | €7.50 converts to 750 cents internally |

### 3.3 Wallet Selector

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Shows all wallets from current trip | All non-deleted wallets listed |
| 2 | Pre-selects default wallet | Default wallet is initially selected |
| 3 | Allows clearing selection (no wallet) | User can clear to "Carteira não informada" |
| 4 | No generic "Outra carteira" option | Option does not exist (DEC-051) |
| 5 | Shows wallet type icon/label | Wallet type (digital, cash, credit) visually indicated |

### 3.4 Budget Breakdown Card

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Shows correct hierarchy: hero > breakdown > details | Visual weight decreases: hero largest, breakdown smaller |
| 2 | Breakdown items sum correctly to hero | Saldo - futuro - reserva = Livre |
| 3 | Protected reserve shows correct value from Envelope | Value derived from Envelope entity (DEC-042) |
| 4 | Future floor shows correct value from policy | Value from BudgetPoolPhaseLink.futureFloorCents or FuturePhaseReservePolicy |

### 3.5 Empty States

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Dashboard empty — no trips | Shows CTA to create trip or import |
| 2 | Expenses empty — no transactions | Shows CTA to register first expense |
| 3 | Wallets empty — no wallets | Shows CTA to create first wallet |
| 4 | Participants empty — no participants | Shows CTA to add participant |
| 5 | Each empty state has icon, heading, description, CTA button | All four elements present |

### 3.6 Settings Form

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Renders all DEC-057 settings | Alert tone, currency (display), quick-add defaults, default wallet, vibration, backup reminder, theme, language, device name, persistent storage status |
| 2 | Alert tone select changes value | Selecting "calmo" updates AppSettings |
| 3 | Vibration toggle works | Toggle changes vibrationEnabled |
| 4 | Backup reminder toggle and days input | On/off toggle + days input works |
| 5 | Theme selector shows dark/light/system | Three options available |
| 6 | Language shows pt-BR as display only | Not editable in V1 |
| 7 | Device name is editable text | Can input and save device name |

### 3.7 Bottom Navigation

| # | What to Test | Expected Behavior |
|---|-------------|-------------------|
| 1 | Shows 5 items: Início, Gastos, FAB, Planejar, Mais | All items rendered |
| 2 | Correct item has active state | Active item shows `--primary` color, bold label |
| 3 | Inactive items show `--on-surface-faint` | Correct inactive styling |
| 4 | FAB click opens full-screen overlay menu | Overlay with dark background appears |
| 5 | FAB icon changes to × when menu is open | Icon toggles |
| 6 | Menu shows only D1 actions | "Registrar gasto" and "Registrar mercado" visible, others hidden |
| 7 | Tapping overlay background closes menu | Menu dismisses |

---

## 4. E2E Tests — Main Flows (Playwright)

All E2E tests run in Chromium with viewport `390×844` (iPhone 14 Pro equivalent).

### 4.1 Onboarding Flow

**File**: `onboarding.spec.ts`

```
Steps:
1. Open app → Welcome screen visible
2. Verify three options: "Criar viagem", "Importar backup", "Carregar demonstração"
3. Tap "Criar viagem"
4. Fill trip name: "Europa 2026"
5. Fill phase name: "Burgos antes"
6. Set start date: 2026-07-01
7. Set end date: 2026-07-15
8. Set amount: 760 (€760)
9. Skip optional protected reserve
10. Submit wizard
11. Land on dashboard
12. Verify phase name "Burgos antes" in header
13. Verify "Livre para usar" shows "€760,00" (full amount, no reserve)
14. Verify "Registrar gasto" is accessible via FAB
```

**Assertions**:
- Welcome screen renders with 3 options
- Onboarding wizard progresses through all steps
- Dashboard loads with correct hero amount
- Phase name visible in header

### 4.2 Register Expense

**File**: `expense-registration.spec.ts`

```
Steps (assumes trip exists from onboarding):
1. Tap FAB → overlay opens
2. Tap "Registrar gasto"
3. Expense form appears (bottom sheet)
4. Enter amount: 7 (€7.00)
5. Select category: "bar"
6. Enter description: "Cerveja"
7. Leave wallet as default (or skip)
8. Tap "Registrar"
9. Verify toast: expense registered
10. Verify dashboard "Livre para usar" decreased by €7.00 → shows "€753,00"
11. Verify expense appears in recent list with "Cerveja" and "€7,00"
12. Navigate to Gastos tab
13. Verify expense appears in expense list
```

**Assertions**:
- FAB menu opens and shows correct D1 actions
- Expense form submits successfully
- Dashboard hero updates in real time
- Expense visible in recent list and expense list

### 4.3 Backup & Restore

**File**: `backup-restore.spec.ts`

```
Steps:
1. Register 3 expenses: €7 (bar), €12 (restaurant), €5 (market)
2. Navigate to Mais → Backup e importação
3. Tap "Exportar backup"
4. Verify JSON file downloads (check content or file creation)
5. Note current "Livre para usar" value (should be 760 - 24 = €736)
6. Clear all data (via replace import with empty, or app reset)
7. Verify app shows Welcome screen (no trip)
8. Tap "Importar backup"
9. Select the exported JSON file
10. Verify pre-import summary shows: 1 trip, 1 phase, 1 pool, 3 transactions
11. Confirm import (merge or replace)
12. Verify dashboard loads with same trip
13. Verify "Livre para usar" shows €736,00
14. Verify all 3 expenses appear in expense list
```

**Assertions**:
- Backup file is valid JSON with all entities
- Import restores full state
- Dashboard values match pre-export state
- All expenses present after restore

### 4.4 Demo Data

**File**: `demo-data.spec.ts`

```
Steps:
1. Open app → Welcome screen
2. Tap "Carregar demonstração"
3. Verify demo banner "Dados de demonstração" is visible
4. Verify dashboard is populated (hero number > 0)
5. Verify phase name appears in header
6. Navigate to Gastos tab → expenses exist
7. Navigate to Mais → Carteiras → wallets exist
8. Return to dashboard
9. Tap "Apagar e começar do zero" (or equivalent demo reset)
10. Confirm deletion
11. Verify app returns to Welcome screen
12. Verify no trips exist (clean state)
```

**Assertions**:
- Demo loads complete dataset (DEC-038)
- Demo banner clearly visible
- Dashboard populated with financial data
- Reset returns to clean Welcome state

### 4.5 Multi-Pool Phase

**File**: `multi-pool.spec.ts`

```
Steps:
1. Create trip with 2 phases:
   - Phase 1: "Burgos antes" (Jul 1–15)
   - Phase 2: "Burgos depois" (Aug 1–15)
2. Create 1 BudgetPool: "Fundo Burgos" = €760
3. Link pool to both phases
4. Set protected reserve: €100 (creates Envelope kind: protected_reserve)
5. Set future floor for phase 2: €170 (on BudgetPoolPhaseLink)
6. Navigate to dashboard (phase 1 active)
7. Verify "Livre para usar" = €760 - €100 - €170 = €490
8. Register expense: €28 (bar) in phase 1
9. Verify "Livre para usar" = €490 - €28 = €462
10. Verify breakdown shows:
    - Saldo restante do fundo: €732 (760 - 28)
    - Reservado para fases futuras: €170
    - Reserva protegida: €100
    - = Livre para usar: €462
```

**Assertions**:
- Pool correctly linked to multiple phases
- Protected reserve deducted from freeToSpend
- Future floor deducted from freeToSpend
- Expense reduces freeToSpend correctly
- Breakdown math is internally consistent

### 4.6 CSV Export

**File**: `csv-export.spec.ts`

```
Steps:
1. Register varied expenses:
   - €7 bar "Cerveja"
   - €12 restaurant "Almoço"
   - €5 market "Água, pão"  (tests comma escaping)
   - €35 outing "Valladolid"
2. Navigate to Mais → Exportar para planilha
3. Select "Basic" (17 fields)
4. Tap export
5. Verify CSV file downloads
6. Parse CSV content:
   - Verify header row has 17 columns
   - Verify first header is "Data"
   - Verify 4 data rows
   - Verify "Água, pão" is properly escaped with quotes
7. Repeat with "Advanced" (23 fields)
8. Verify header row has 23 columns
9. Verify field 18 contains a UUID
```

**Assertions**:
- CSV file downloads successfully
- Correct column count (17 basic, 23 advanced)
- Portuguese headers match DEC-058
- Comma and quote escaping works
- Data rows match registered expenses

---

## 5. Test Data Fixtures

Reusable factory functions for consistent test setup. All fixtures return entities matching the TypeScript interfaces from `database-schema.md`.

### 5.1 `createTestTrip(overrides?)`

```typescript
{
  id: uuid(),
  name: 'Europa 2026',
  baseCurrency: 'EUR',
  startDate: '2026-07-01',
  endDate: '2026-08-15',
  status: 'active',
  notes: null,
  ...syncMetadata(),
}
```

### 5.2 `createTestPhase(overrides?)`

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  name: 'Burgos antes',
  startDate: '2026-07-01',
  endDate: '2026-07-15',
  order: 0,
  notes: null,
  ...syncMetadata(),
}
```

### 5.3 `createTestBudgetPool(overrides?)`

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  name: 'Fundo Burgos',
  scope: 'linked_phases',
  totalAmountCents: 76000,  // €760
  currency: 'EUR',
  notes: null,
  ...syncMetadata(),
}
```

### 5.4 `createTestEnvelope(overrides?)`

```typescript
{
  id: uuid(),
  budgetPoolId: defaultPoolId,
  kind: 'protected_reserve',
  name: 'Reserva protegida',
  amountCents: 10000,  // €100
  notes: null,
  ...syncMetadata(),
}
```

### 5.5 `createTestExpense(overrides?)`

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  phaseId: defaultPhaseId,
  budgetPoolId: defaultPoolId,
  walletId: null,               // DEC-051: optional
  sessionId: null,
  type: 'expense',
  amountCents: 700,             // €7
  personalCostCents: 700,
  currency: 'EUR',
  baseCurrencyAmountCents: 700,
  exchangeRate: null,
  category: 'bar',
  description: 'Cerveja',
  date: new Date().toISOString(),
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
  ...syncMetadata(),
}
```

### 5.6 `createTestParticipant(overrides?)`

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  name: 'Maria Silva',
  nickname: 'Mari',
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
  ...syncMetadata(),
}
```

### 5.7 `createTestWallet(overrides?)`

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  name: 'Wise',
  walletType: 'digital',
  currency: 'EUR',
  initialBalanceCents: 50000,  // €500
  isDefault: true,
  notes: null,
  ...syncMetadata(),
}
```

### 5.8 `createTestSession(overrides?)` — DEFERRED (D4)

Schema prepared but session lifecycle is D4. When needed:

```typescript
{
  id: uuid(),
  tripId: defaultTripId,
  phaseId: defaultPhaseId,
  startPhaseId: defaultPhaseId,
  budgetPoolId: defaultPoolId,
  activityProfileId: null,
  name: 'Bar session',
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  targetCents: 2500,     // €25
  ceilingCents: 3500,    // €35
  maxCents: 5000,        // €50
  avgDrinkPriceCents: 500,
  quickAddValuesCents: [300, 500, 700, 1000, 1500],
  currentTotalCents: 0,
  personalTotalCents: 0,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  notes: null,
  ...syncMetadata(),
}
```

### 5.9 `createDemoData()`

Returns a complete dataset matching DEC-038:

| Entity | Count | Key Content |
|--------|-------|-------------|
| Trip | 1 | "Aventura Mediterrâneo" (fictional) |
| Phase | 2 | Non-consecutive, linked to same pool |
| BudgetPool | 2 | 1 linked_phases (operational) + 1 global (personal shopping) |
| BudgetPoolPhaseLink | 2 | Pool → Phase 1 + Pool → Phase 2 |
| Envelope | 1 | Protected reserve on operational pool |
| Participant | 3 | Fictional names (DEC-014) |
| Wallet | 2 | 1 digital + 1 cash |
| Transaction | 10 | Mixed: 8 expenses, 1 shared, 1 adjustment |
| AppSettings | 1 | Default values |
| Device | 1 | Demo device |

### 5.10 `syncMetadata(overrides?)`

Reusable helper for sync fields:

```typescript
{
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  revision: 1,
  sourceDeviceId: defaultDeviceId,
}
```

---

## 6. Coverage Targets

| Layer | Tool | Target | Rationale |
|-------|------|--------|-----------|
| Domain logic | Vitest | **>90%** | Financial calculations are the product's core value. Bugs here = user loses money trust |
| Critical components | RTL | **>70%** | Dashboard, expense form, wallet selector, navigation — the screens users see most |
| Main flows | Playwright | **6 flows** | Covers the happy paths for all D1 features |

### Priority Order for Implementation

1. **Budget calculations** (freeToSpend, poolSpent, walletBalance) — highest impact, pure math
2. **Money utilities** (toCents, fromCents, formatMoney, splitEqually) — foundational
3. **Validation schemas** (Zod) — prevents bad data at the boundary
4. **Transaction creation** (expense, adjustment) — core data creation
5. **Multi-phase pool logic** — distinguishing feature, complex
6. **Backup/Import** (create, parse, merge, replace) — data safety
7. **CSV export** — data portability
8. **Dashboard component** — hero number display correctness
9. **Expense form component** — primary user interaction
10. **E2E flows** — end-to-end confidence

---

## 7. Test File Organization

```
src/tests/
├── unit/
│   ├── domain/
│   │   ├── budget/
│   │   │   ├── calculate-free-to-spend.test.ts
│   │   │   ├── calculate-pool-spent.test.ts
│   │   │   └── calculate-wallet-balance.test.ts
│   │   ├── transactions/
│   │   │   ├── create-expense.test.ts
│   │   │   └── create-adjustment.test.ts
│   │   └── pools/
│   │       ├── multi-phase-pool.test.ts
│   │       └── get-pools-for-phase.test.ts
│   ├── money/
│   │   ├── cents-conversion.test.ts
│   │   ├── format-money.test.ts
│   │   └── split-equally.test.ts
│   ├── backup/
│   │   ├── create-backup.test.ts
│   │   ├── parse-backup.test.ts
│   │   ├── merge-import.test.ts
│   │   ├── replace-import.test.ts
│   │   └── export-csv.test.ts
│   ├── validation/
│   │   ├── trip.test.ts
│   │   ├── phase.test.ts
│   │   ├── budget-pool.test.ts
│   │   ├── transaction.test.ts
│   │   ├── envelope.test.ts
│   │   ├── wallet.test.ts
│   │   └── app-settings.test.ts
│   ├── dates/
│   │   └── phase-status.test.ts
│   └── wallets/
│       └── unassigned-wallet.test.ts
├── component/
│   ├── dashboard/
│   │   ├── dashboard.test.tsx
│   │   └── budget-breakdown.test.tsx
│   ├── expenses/
│   │   └── expense-form.test.tsx
│   ├── wallets/
│   │   └── wallet-selector.test.tsx
│   ├── navigation/
│   │   ├── bottom-nav.test.tsx
│   │   └── fab-menu.test.tsx
│   ├── settings/
│   │   └── settings-form.test.tsx
│   └── shared/
│       └── empty-states.test.tsx
└── e2e/
    ├── onboarding.spec.ts
    ├── expense-registration.spec.ts
    ├── backup-restore.spec.ts
    ├── demo-data.spec.ts
    ├── multi-pool.spec.ts
    └── csv-export.spec.ts
```

### Naming Conventions

| Convention | Example |
|------------|---------|
| Unit test files | `*.test.ts` |
| Component test files | `*.test.tsx` |
| E2E test files | `*.spec.ts` |
| Test fixture functions | `createTest*()` |
| Describe blocks | `describe('calculateFreeToSpend', ...)` |
| Test names | `it('returns full pool amount when no deductions', ...)` |

### Fixture File

```
src/tests/
└── fixtures/
    ├── entities.ts           # createTestTrip, createTestPhase, etc.
    ├── sync-metadata.ts      # syncMetadata() helper
    └── demo-data.ts          # createDemoData() — full dataset
```

---

## 8. Deferred Test Areas

| Area | Delivery | Reason |
|------|----------|--------|
| Equal/custom split engine | D2 | ParticipantShare creation with split math |
| Debt tracking and settlement | D2 | Settlement entity lifecycle |
| Cash withdrawal as wallet transfer | D2 | Transfer transaction flow |
| Cash reconciliation full flow | D2 | Expected vs counted comparison + UI |
| Forecast engine calculations | D3 | Occasion-based forecasting math |
| Scenario planner [-]/[+] logic | D3 | Interactive budget rebalancing |
| Simulator risk assessment | D3 | Combined risk factor evaluation |
| Trade-off suggestions | D3 | "2 more outings = 1 fewer bar night" |
| Outing Mode session lifecycle | D4 | Start → quick-add → alerts → end |
| Three-limit gauge zones | D4 | Target/ceiling/max zone calculations |
| Progressive alerts | D4 | Visual + vibration alert triggers |
| Session phase boundary | D4 | DEC-053 cross-phase session handling |
| End-of-session review screen | D4 | DEC-049 single review screen |
| PWA offline caching | D5 | Service worker + persistent storage |
| Light mode theme | D5 | Theme switching |
| Capacitor native features | D6 | Local notifications, haptics |

---

*This test plan is the reference for Lucas (test creator) and Bruno (test executor). All test cases trace back to master-spec-d1.md, database-schema.md, and the 60 approved decisions.*
