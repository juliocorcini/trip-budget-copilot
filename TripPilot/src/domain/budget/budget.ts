import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { BudgetPoolScope } from '@/domain/types/common';
import { sumCents } from '@/domain/money';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface FreeToSpendResult {
  freeToSpendCents: number;
  totalBudgetCents: number;
  totalSpentCents: number;
  protectedReserveCents: number;
  futureFloorCents: number;
  eventReservesCents: number;
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

  const freeToSpendCents = Math.max(
    0,
    totalBudgetCents - totalSpentCents - protectedReserveCents - futureFloorCents - eventReservesCents,
  );

  return {
    freeToSpendCents,
    totalBudgetCents,
    totalSpentCents,
    protectedReserveCents,
    futureFloorCents,
    eventReservesCents,
    allocationsCents,
  };
}

/**
 * Budget impact uses the personal cost when available (shared expenses):
 * the financial flow (amountCents) may include other participants' shares.
 */
export function calculatePoolSpent(transactions: Transaction[]): number {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.deletedAt === null &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map((t) => t.personalCostCents ?? t.amountCents),
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

export interface SavingsResult {
  savedCents: number;
  percentOfBarNight: number;
  hasSavings: boolean;
}

export function calculateSavings(
  transactions: Transaction[],
  barProfile: { typicalValueCents: number; expectedFrequencyPerPhase: number | null } | null,
  daysElapsed: number,
): SavingsResult {
  if (!barProfile || daysElapsed <= 0) return { savedCents: 0, percentOfBarNight: 0, hasSavings: false };

  const barTxs = transactions.filter(
    (t) => t.category === 'bar' && t.type === 'expense' && t.deletedAt === null,
  );
  const actualBarSpent = sumCents(barTxs.map((t) => t.amountCents));
  const expectedBarSpent = barTxs.length * barProfile.typicalValueCents;

  const savedCents = Math.max(0, expectedBarSpent - actualBarSpent);
  const percentOfBarNight = barProfile.typicalValueCents > 0
    ? Math.round((savedCents / barProfile.typicalValueCents) * 100)
    : 0;

  return { savedCents, percentOfBarNight, hasSavings: savedCents > 0 };
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

export interface AmigoSinceroInsight {
  hasInsight: boolean;
  beforeCount: number;
  afterCount: number;
  category: string;
  reserveStatus: 'intact' | 'affected';
}

export function generateAmigoSinceroInsight(
  freeToSpendCents: number,
  _protectedReserveCents: number,
  profile: { typicalValueCents: number; category: string } | null,
  recentSpendCents: number,
): AmigoSinceroInsight {
  if (!profile || profile.typicalValueCents <= 0) {
    return { hasInsight: false, beforeCount: 0, afterCount: 0, category: 'other', reserveStatus: 'intact' };
  }

  const beforeCount = Math.floor(freeToSpendCents / profile.typicalValueCents);
  const afterCount = Math.floor(
    Math.max(0, freeToSpendCents - recentSpendCents) / profile.typicalValueCents,
  );
  const reserveAffected = freeToSpendCents - recentSpendCents < 0;

  return {
    hasInsight: beforeCount !== afterCount && beforeCount > 0,
    beforeCount,
    afterCount,
    category: profile.category,
    reserveStatus: reserveAffected ? 'affected' : 'intact',
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
