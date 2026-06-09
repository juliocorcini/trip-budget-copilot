import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPoolScope } from '@/domain/types/common';
import { sumCents } from '@/domain/money';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface FreeToSpendResult {
  freeToSpendCents: number;
  totalBudgetCents: number;
  totalSpentCents: number;
  protectedReserveCents: number;
  futureFloorCents: number;
  allocationsCents: number;
}

export function calculateFreeToSpend(
  pool: BudgetPool,
  envelopes: Envelope[],
  transactions: Transaction[],
  phaseLinks: BudgetPoolPhaseLink[],
  currentPhaseId: string,
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

  const freeToSpendCents = Math.max(
    0,
    totalBudgetCents - totalSpentCents - protectedReserveCents - futureFloorCents,
  );

  return {
    freeToSpendCents,
    totalBudgetCents,
    totalSpentCents,
    protectedReserveCents,
    futureFloorCents,
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
): BudgetPoolPhaseLink {
  return {
    ...createSyncMetadata(),
    budgetPoolId,
    phaseId,
    futureFloorCents: null,
  };
}
