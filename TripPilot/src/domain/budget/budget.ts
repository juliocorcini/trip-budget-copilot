import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { BudgetPoolScope } from '@/domain/types/common';
import { sumCents } from '@/domain/money';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { calculatePlannedPurchaseReserves } from '@/domain/planning/planned-purchases';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface FreeToSpendResult {
  freeToSpendCents: number;
  totalBudgetCents: number;
  totalSpentCents: number;
  protectedReserveCents: number;
  futureFloorCents: number;
  eventReservesCents: number;
  /** DEC-175: still-reserved total of OPEN planned purchases charged to this pool. */
  plannedPurchasesCents: number;
  allocationsCents: number;
}

/**
 * DEC-072: money reserved for planned events deducts from freeToSpend until
 * the occurrence is confirmed or linked to a session — then the real spending
 * takes over (Anchor Rule 10).
 */
export function calculateEventReserves(
  occurrences: PlannedOccurrence[],
  phaseId: string,
): number {
  return occurrences
    .filter(
      (o) =>
        o.deletedAt === null &&
        o.phaseId === phaseId &&
        !o.isConfirmed &&
        o.linkedSessionId === null &&
        o.reservedCents !== null,
    )
    .reduce((sum, o) => sum + (o.reservedCents ?? 0), 0);
}

export function calculateFreeToSpend(
  pool: BudgetPool,
  envelopes: Envelope[],
  transactions: Transaction[],
  phaseLinks: BudgetPoolPhaseLink[],
  currentPhaseId: string,
  occurrences: PlannedOccurrence[],
  plannedPurchases: PlannedPurchase[],
): FreeToSpendResult {
  const totalBudgetCents = pool.totalAmountCents;

  const totalSpentCents = calculatePoolSpent(transactions);

  const protectedReserveCents = envelopes
    .filter((e) => e.kind === 'protected_reserve' && e.deletedAt === null)
    .reduce((sum, e) => sum + e.amountCents, 0);

  const allocationsCents = envelopes
    .filter((e) => e.kind === 'allocation' && e.deletedAt === null)
    .reduce((sum, e) => sum + e.amountCents, 0);

  const futureFloorCents = calculateFutureFloor(phaseLinks, currentPhaseId);

  // DEC-072: only reserves of occurrences charged to THIS pool deduct here.
  const eventReservesCents = calculateEventReserves(
    occurrences.filter((o) => o.budgetPoolId === pool.id),
    currentPhaseId,
  );

  // DEC-175: still-reserved total of OPEN planned purchases charged to THIS pool.
  // The reserve already shrinks by the real linked spend (counted in spent), so
  // there is never double counting.
  const plannedPurchasesCents = calculatePlannedPurchaseReserves(
    plannedPurchases,
    transactions,
    pool.id,
  );

  const freeToSpendCents = Math.max(
    0,
    totalBudgetCents -
      totalSpentCents -
      protectedReserveCents -
      futureFloorCents -
      eventReservesCents -
      plannedPurchasesCents,
  );

  return {
    freeToSpendCents,
    totalBudgetCents,
    totalSpentCents,
    protectedReserveCents,
    futureFloorCents,
    eventReservesCents,
    plannedPurchasesCents,
    allocationsCents,
  };
}

/**
 * DEC-168: "where this number comes from" — the hero (free-to-spend) is the most
 * important figure in the app, yet it was an opaque total. This breaks it into the
 * exact terms of the freeToSpend formula so the user can SEE the arithmetic:
 *
 *   budget − spent − protected reserve − future floor − event reserves = free
 *
 * The lines reconcile to `fts.freeToSpendCents` whenever it isn't clamped. When the
 * commitments exceed the budget (raw < 0) freeToSpend is floored at 0, so a `deficit`
 * line surfaces the overflow instead of silently hiding it. Zero terms are dropped
 * (a €0 protected reserve is noise, not information).
 */
export type FtsBreakdownKind = 'base' | 'subtract' | 'total' | 'deficit';

export type FtsBreakdownKey =
  | 'budget'
  | 'spent'
  | 'protected'
  | 'future_floor'
  | 'event_reserves'
  | 'planned_purchases'
  | 'free'
  | 'deficit';

export interface FtsBreakdownLine {
  key: FtsBreakdownKey;
  /** Always a non-negative magnitude; `kind` carries the sign/role for display. */
  cents: number;
  kind: FtsBreakdownKind;
}

export function buildFreeToSpendBreakdown(fts: FreeToSpendResult): FtsBreakdownLine[] {
  const lines: FtsBreakdownLine[] = [{ key: 'budget', cents: fts.totalBudgetCents, kind: 'base' }];

  const subtractions: Array<[FtsBreakdownKey, number]> = [
    ['spent', fts.totalSpentCents],
    ['protected', fts.protectedReserveCents],
    ['future_floor', fts.futureFloorCents],
    ['event_reserves', fts.eventReservesCents],
    ['planned_purchases', fts.plannedPurchasesCents],
  ];
  for (const [key, cents] of subtractions) {
    if (cents > 0) lines.push({ key, cents, kind: 'subtract' });
  }

  const rawFreeCents =
    fts.totalBudgetCents -
    fts.totalSpentCents -
    fts.protectedReserveCents -
    fts.futureFloorCents -
    fts.eventReservesCents -
    fts.plannedPurchasesCents;

  lines.push({ key: 'free', cents: Math.max(0, rawFreeCents), kind: 'total' });
  if (rawFreeCents < 0) lines.push({ key: 'deficit', cents: -rawFreeCents, kind: 'deficit' });

  return lines;
}

/**
 * Budget impact uses the personal cost when available (shared expenses):
 * the financial flow (amountCents) may include other participants' shares.
 * E9: foreign-currency expenses contribute their base-currency value, so the
 * pool (always in the trip's base currency) stays correct — same-currency rows
 * are unaffected (exchangeRate null).
 */
export function calculatePoolSpent(transactions: Transaction[]): number {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.deletedAt === null &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map((t) => transactionBasePersonalCostCents(t)),
  );
}

export function calculateFutureFloor(
  phaseLinks: BudgetPoolPhaseLink[],
  currentPhaseId: string,
): number {
  return phaseLinks
    .filter(
      (pl) =>
        pl.deletedAt === null &&
        pl.phaseId !== currentPhaseId &&
        pl.futureFloorCents !== null,
    )
    .reduce((sum, pl) => sum + (pl.futureFloorCents ?? 0), 0);
}

export function calculatePoolRemaining(
  pool: BudgetPool,
  transactions: Transaction[],
): number {
  return pool.totalAmountCents - calculatePoolSpent(transactions);
}

export interface PoolSummary {
  poolId: string;
  poolName: string;
  scope: string;
  totalCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
}

export function createPoolSummary(
  pool: BudgetPool,
  transactions: Transaction[],
): PoolSummary {
  const spentCents = calculatePoolSpent(transactions);
  const remainingCents = pool.totalAmountCents - spentCents;
  const percentUsed =
    pool.totalAmountCents === 0
      ? 0
      : Math.round((spentCents / pool.totalAmountCents) * 10000) / 100;

  return {
    poolId: pool.id,
    poolName: pool.name,
    scope: pool.scope,
    totalCents: pool.totalAmountCents,
    spentCents,
    remainingCents,
    percentUsed,
  };
}

export function calculateTotalBudget(pools: BudgetPool[]): number {
  return sumCents(
    pools.filter((p) => p.deletedAt === null).map((p) => p.totalAmountCents),
  );
}

export function calculateTotalSpent(transactions: Transaction[]): number {
  return calculatePoolSpent(transactions);
}

export function getBudgetHealthStatus(
  percentUsed: number,
): 'healthy' | 'warning' | 'critical' {
  if (percentUsed >= 90) return 'critical';
  if (percentUsed >= 70) return 'warning';
  return 'healthy';
}

/* ──────────────── DEC-092 (R-10): contextual last-outing savings ──────────────── */

/** Only outings closed within this window count as "recent". */
export const RECENT_OUTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface LastOutingSavings {
  hasSavings: boolean;
  profileName: string;
  spentCents: number;
  savedCents: number;
  typicalCents: number;
}

const NO_LAST_OUTING_SAVINGS: LastOutingSavings = {
  hasSavings: false,
  profileName: '',
  spentCents: 0,
  savedCents: 0,
  typicalCents: 0,
};

/**
 * "Na sua última saída de [perfil], você gastou €X — €Y abaixo do seu normal
 * (€Z)". Requires a RECENT closed outing with a profile whose typical value
 * is reliable (> 0); the saving is event-specific, never trip-wide.
 */
export function calculateLastOutingSavings(
  completedSessions: Array<{
    id: string;
    name: string;
    activityProfileId: string | null;
    endedAt: string | null;
  }>,
  transactions: Transaction[],
  profiles: Array<{ id: string; name: string; typicalValueCents: number }>,
  nowMs: number,
): LastOutingSavings {
  const last = completedSessions
    .filter((s) => s.endedAt !== null && s.activityProfileId !== null)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0];
  if (!last) return NO_LAST_OUTING_SAVINGS;

  const endedMs = new Date(last.endedAt!).getTime();
  if (nowMs - endedMs > RECENT_OUTING_WINDOW_MS) return NO_LAST_OUTING_SAVINGS;

  const profile = profiles.find((p) => p.id === last.activityProfileId);
  if (!profile || profile.typicalValueCents <= 0) return NO_LAST_OUTING_SAVINGS;

  const spentCents = calculatePoolSpent(
    transactions.filter((tx) => tx.sessionId === last.id),
  );
  const savedCents = profile.typicalValueCents - spentCents;
  if (spentCents <= 0 || savedCents <= 0) return NO_LAST_OUTING_SAVINGS;

  return {
    hasSavings: true,
    profileName: profile.name,
    spentCents,
    savedCents,
    typicalCents: profile.typicalValueCents,
  };
}

export interface CreateBudgetPoolInput {
  tripId: string;
  name: string;
  scope: BudgetPoolScope;
  totalAmountCents: number;
  currency: string;
}

export function createBudgetPool(input: CreateBudgetPoolInput): BudgetPool {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    name: input.name,
    scope: input.scope,
    totalAmountCents: input.totalAmountCents,
    currency: input.currency,
    notes: null,
  };
}

export function createBudgetPoolPhaseLink(
  budgetPoolId: string,
  phaseId: string,
  futureFloorCents: number | null = null,
): BudgetPoolPhaseLink {
  return {
    ...createSyncMetadata(),
    budgetPoolId,
    phaseId,
    futureFloorCents,
  };
}

/**
 * DEC-039/040: pools available for an expense in a phase = operational pools
 * linked to that phase + global pools (which require a conscious choice).
 */
export interface AvailablePools {
  operational: BudgetPool[];
  global: BudgetPool[];
  /** Auto-selected only when there is exactly ONE operational pool (DEC-040). */
  autoSelectedPoolId: string | null;
}

export function getAvailablePoolsForPhase(
  pools: BudgetPool[],
  links: BudgetPoolPhaseLink[],
  phaseId: string,
): AvailablePools {
  const linkedPoolIds = new Set(
    links
      .filter((l) => l.deletedAt === null && l.phaseId === phaseId)
      .map((l) => l.budgetPoolId),
  );
  const active = pools.filter((p) => p.deletedAt === null);
  const operational = active.filter(
    (p) => p.scope === 'linked_phases' && linkedPoolIds.has(p.id),
  );
  const global = active.filter((p) => p.scope === 'global');

  return {
    operational,
    global,
    autoSelectedPoolId: operational.length === 1 ? operational[0]!.id : null,
  };
}

/**
 * M10 (E5 / ÂNCORA 13): moving a phase leftover between pools conserves money —
 * the source pool loses exactly what the target pool gains, so the trip total
 * (sum of pool totals) is invariant. Pure integer-cents math.
 */
export interface PoolTransferResult {
  sourceTotalCents: number;
  targetTotalCents: number;
}

export function computePoolTransfer(
  sourceTotalCents: number,
  targetTotalCents: number,
  amountCents: number,
): PoolTransferResult {
  return {
    sourceTotalCents: sourceTotalCents - amountCents,
    targetTotalCents: targetTotalCents + amountCents,
  };
}

export interface CreateEnvelopeInput {
  budgetPoolId: string;
  kind: 'protected_reserve' | 'allocation';
  name: string;
  amountCents: number;
}

export function createEnvelope(input: CreateEnvelopeInput): Envelope {
  return {
    ...createSyncMetadata(),
    budgetPoolId: input.budgetPoolId,
    kind: input.kind,
    name: input.name,
    amountCents: input.amountCents,
    notes: null,
  };
}
