import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import { sumCents } from '@/domain/money';

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

export function calculatePoolSpent(transactions: Transaction[]): number {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.deletedAt === null &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map((t) => t.amountCents),
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
