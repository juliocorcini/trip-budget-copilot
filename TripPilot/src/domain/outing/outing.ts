import type { Session, SessionItem } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import { createSyncMetadata } from '@/utils/entity-factory';
import { sumCents } from '@/domain/money';
import type { AlertTone } from '@/domain/types/common';

export interface OutingAlert {
  percent: number;
  type: 'info' | 'warning' | 'danger' | 'critical';
  message: string;
}

export function createSession(
  tripId: string,
  phaseId: string,
  poolId: string,
  profile: ActivityProfile,
  quickAddValues: number[],
): Session {
  return {
    ...createSyncMetadata(),
    tripId,
    phaseId,
    budgetPoolId: poolId,
    activityProfileId: profile.id,
    status: 'active',
    name: profile.name,
    targetCents: profile.defaultTargetCents,
    ceilingCents: profile.defaultCeilingCents,
    maxCents: profile.defaultMaxCents,
    startedAt: new Date().toISOString(),
    endedAt: null,
    quickAddValuesCents: quickAddValues,
    avgDrinkPriceCents: profile.defaultAvgDrinkPriceCents,
    notes: null,
  };
}

export function createSessionItem(
  sessionId: string,
  transactionId: string,
  order: number,
): SessionItem {
  return {
    ...createSyncMetadata(),
    sessionId,
    transactionId,
    order,
  };
}

export function calculateSessionTotal(transactions: Transaction[]): number {
  return sumCents(
    transactions
      .filter((t) => t.deletedAt === null && t.type === 'expense')
      .map((t) => t.amountCents),
  );
}

export function getSessionPercentUsed(
  totalSpentCents: number,
  limitCents: number | null,
): number {
  if (!limitCents || limitCents === 0) return 0;
  return Math.round((totalSpentCents / limitCents) * 100);
}

export function getProgressiveAlerts(
  totalSpentCents: number,
  session: Session,
  _alertTone: AlertTone = 'amigo_sincero',
): OutingAlert[] {
  const alerts: OutingAlert[] = [];
  const limit = session.ceilingCents ?? session.targetCents;
  if (!limit) return alerts;

  const percent = getSessionPercentUsed(totalSpentCents, limit);

  const thresholds: { pct: number; type: OutingAlert['type']; msgKey: string }[] = [
    { pct: 50, type: 'info', msgKey: 'halfway' },
    { pct: 75, type: 'warning', msgKey: 'three_quarters' },
    { pct: 90, type: 'danger', msgKey: 'almost_limit' },
    { pct: 100, type: 'critical', msgKey: 'at_limit' },
  ];

  for (const threshold of thresholds) {
    if (percent >= threshold.pct) {
      alerts.push({
        percent: threshold.pct,
        type: threshold.type,
        message: threshold.msgKey,
      });
    }
  }

  return alerts;
}

export function calculateNextDrinkImpact(
  currentTotalCents: number,
  drinkPriceCents: number,
  ceilingCents: number | null,
): { afterCents: number; percentAfter: number; exceedsCeiling: boolean } {
  const afterCents = currentTotalCents + drinkPriceCents;
  const percentAfter = ceilingCents
    ? Math.round((afterCents / ceilingCents) * 100)
    : 0;
  return {
    afterCents,
    percentAfter,
    exceedsCeiling: ceilingCents !== null && afterCents > ceilingCents,
  };
}

export interface ReportedTotalResult {
  diffCents: number;
  needsAdjustment: boolean;
  isNegative: boolean;
}

/**
 * DEC-046: when the user reports the session total, keep every logged item
 * and create an adjustment for the difference — never replace history.
 */
export function calculateReportedTotalDiff(
  reportedTotalCents: number,
  currentTotalCents: number,
): ReportedTotalResult {
  const diffCents = reportedTotalCents - currentTotalCents;
  return {
    diffCents,
    needsAdjustment: diffCents !== 0,
    isNegative: diffCents < 0,
  };
}

export function endSession(session: Session): Session {
  return {
    ...session,
    status: 'completed',
    endedAt: new Date().toISOString(),
  };
}
