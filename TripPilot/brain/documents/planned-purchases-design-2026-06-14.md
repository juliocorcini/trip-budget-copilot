# Planned Purchases — "Planejados / Vou gastar" (DEC-175)

> Design doc — 2026-06-14. Status: building (v0.17.0).

## Problem

The user knows about money they WILL spend (skincare creams across several stores,
clothes "at some point") and wants to earmark it NOW so the app reflects what they
can *really* spend. Today there is no discoverable place for this:

- **Personal-shopping global fund** (DEC-011/041) exists but, by design, does NOT
  reduce free-to-spend (Core Rule 6) and tracks *actuals vs a limit* — not a list
  of intended purchases.
- **Event reserves** (`reservedCents`, DEC-072) DO reduce free-to-spend, but are
  shaped as dated events tied to outing sessions, with no "I bought it → log it"
  conversion. The user literally tried using a planned *event* for a one-off pharmacy
  item and it couldn't be marked bought / update values.

So the two halves (a home for shopping + an earmark mechanism) exist but were never
joined into a discoverable, purpose-built "things I plan to buy" surface.

## Solution (chosen via council, direction `lista_earmark`, scope `completo`)

A new first-class concept: **Planned Purchases**. A list of intended purchases, each
with an estimated cost, that:

1. **Reserves** money from a chosen fund — deducting EXPLICITLY from that fund's
   free-to-spend (shows as a new line in the FTS breakdown, DEC-168/172). Never
   touches the daily "Livre hoje" silently (Core Rule 6 honored: explicit + the
   pool choice decides what it affects).
2. **Converts on "Comprei"** → opens QuickAdd pre-filled (amount = remaining reserve,
   category, fund, description); on save the new expense is **linked** to the
   purchase and the reserve **shrinks by the real spend** (so no double counting —
   same handoff philosophy as event reserve → real session, generalized to partial).
3. **Supports the multi-store reality** without a grouping entity: one purchase
   "Skincare €60" is whittled down purchase-by-purchase (€20 at the pharmacy, €25 at
   Druni…); when the remaining reserve hits 0, or the user taps "concluir", it closes.
4. Is **discoverable**: a dashboard card ("Planejado: €X reservado em N itens"), a
   dedicated page, a More-menu entry, and a per-fund "reserved for planned" line.

### Why a NEW entity (not extend PlannedOccurrence)

`PlannedOccurrence` is phase + date + session + activity-profile centric and feeds
"occasions = sessions" (DEC-115), the planner events line and the dashboard day card.
A purchase is usually trip-wide, undated, and must NOT create a session/occasion.
Overloading the occurrence would muddy those semantics; the user already found the
event flow inadequate. A purpose-built entity keeps both concepts clean. We REUSE the
proven patterns: the subtractive FTS term, the reserve→real-spend handoff, the
QuickAdd prefill via query params, the `Breakdown` component, `EmptyState`, toasts.

## Data model — `PlannedPurchase` (Dexie v6, table `plannedPurchases`)

```
tripId: string
budgetPoolId: string          // fund it draws from (default: global shopping pool, else primary operational)
name: string                  // "Cremes skincare", "Roupas"
category: string              // a QuickAdd CATEGORY_KEY, for the "Comprei" prefill
estimatedCostCents: number    // the plan
reservedCents: number | null  // amount that deducts from FTS; null = track only (no reserve)
status: 'planned' | 'bought' | 'cancelled'
linkedTransactionIds: string[]// expenses logged via "Comprei" (supports partial / multi-store)
store: string | null          // optional hint ("Farmácia", "Primor")
targetDate: string | null     // optional "by when"
notes: string | null
phaseId: string | null        // optional association (not required)
```

New table → Dexie **v6**, no upgrade() callback needed (like v5 localSnapshots).
Added to backup (`BACKUP_TABLE_KEYS`, BackupData, normalize, schema). LOCAL→backup safe
(old backups lack the key → defaults to []).

## Domain (`domain/planning/planned-purchases.ts`, pure)

- `createPlannedPurchase(input)` — factory.
- `plannedPurchaseSpentCents(p, txs)` — Σ personal cost of linked, non-deleted txs.
- `plannedPurchaseReservedRemainingCents(p, txs)` — `status==='planned' ? max(0,(reservedCents??0) − spent) : 0`.
- `calculatePlannedPurchaseReserves(purchases, txs, poolId)` — Σ remaining for that pool (the FTS term).
- `plannedPurchaseProgress(p, txs)` — `{ spentCents, estimatedCostCents, remainingReserveCents, percent }`.
- `linkTransactionToPlannedPurchase(p, txId, txs)` — append id; if remaining ≤ 0 → status 'bought'.
- `isPlannedPurchaseOpen(p)` — `status==='planned' && deletedAt===null`.

## Free-to-spend

`FreeToSpendResult.plannedPurchasesCents`; `calculateFreeToSpend(..., plannedPurchases)`
adds the term (filtered to the pool) and subtracts it; `buildFreeToSpendBreakdown`
gets a `planned_purchases` line. All 9 callers + tests updated (required 7th param,
consistent with the existing `occurrences` positional).

## Orchestrators (`domain/orchestrators/planned-purchase-orchestrators.ts`)

create / update / cancel / completeWithoutExpense / delete / `linkExpenseToPlannedPurchase`
(called by QuickAdd after a "Comprei" save). All atomic via the repository.

## UI

- **/planned page** — total reserved header; open list (name, store, progress
  spent/estimate, remaining reserve, "Comprei" / edit / done / cancel); closed
  (bought/cancelled) collapsed; add/edit BottomSheet; EmptyState + help (DEC-121).
- **QuickAdd** — reads `?planned=&desc=&pool=` (plus existing `?amount=&cat=`),
  pre-fills, and on save links the tx to the purchase.
- **Dashboard card** — "Planejado / Vou gastar" (total reserved + count → /planned),
  registered in /settings/dashboard (DEC-119).
- **Funds page** — per-pool "reserved for planned" line.
- **More menu** — "Planejados" entry.
- **Simulator** — planned purchases offered as a "where" destination (DEC-116):
  "you already reserved €X for this."

## Rules honored

- Core Rule 6 (personal shopping never silently reduces the daily budget): the
  reserve reduces the chosen fund's free-to-spend EXPLICITLY (visible breakdown line,
  user-created), never the silent daily allowance.
- Core Rule 8 (every number explainable): the reserve appears as a labeled FTS line
  and the purchase shows its own spent/estimate/remaining breakdown.
- Core Rule 13 (never block): planning and buying never block; over-reserve just shows.
- No double counting: reserve = estimate − real linked spend; once bought, only the
  real expenses (already in pool spent) count.
