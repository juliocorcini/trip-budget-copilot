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

export interface SessionLimits {
  targetCents: number;
  ceilingCents: number;
  maxCents: number;
  avgDrinkPriceCents: number | null;
}

/** DEC-045 (decision D-B): single source for quick-add defaults — €3/5/7/10/15. */
export const DEFAULT_QUICK_ADD_VALUES_CENTS = [300, 500, 700, 1000, 1500];

/**
 * DEC-045: the quick-add button closest to the session's average drink price
 * gets the visual highlight. Falls back to the middle button.
 */
export function findHighlightedQuickValueIndex(
  quickValuesCents: number[],
  avgDrinkPriceCents: number | null,
): number {
  const fallback = Math.min(2, Math.max(0, quickValuesCents.length - 1));
  if (avgDrinkPriceCents === null || avgDrinkPriceCents <= 0) return fallback;
  let bestIndex = fallback;
  let bestDistance = Number.POSITIVE_INFINITY;
  quickValuesCents.forEach((value, index) => {
    const distance = Math.abs(value - avgDrinkPriceCents);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

const LIMIT_STEP_CENTS = 500;

function roundToStep(cents: number): number {
  return Math.max(LIMIT_STEP_CENTS, Math.round(cents / LIMIT_STEP_CENTS) * LIMIT_STEP_CENTS);
}

/**
 * DEC-010/044: every session needs three valid limits. Profiles without
 * explicit defaults derive them from learned values (safe value as the
 * comfort target), rounded to €5 steps, always ordered target < ceiling < max.
 */
export function deriveSessionLimits(profile: ActivityProfile): SessionLimits {
  if (
    profile.defaultTargetCents !== null &&
    profile.defaultCeilingCents !== null &&
    profile.defaultMaxCents !== null
  ) {
    return {
      targetCents: profile.defaultTargetCents,
      ceilingCents: profile.defaultCeilingCents,
      maxCents: profile.defaultMaxCents,
      avgDrinkPriceCents: profile.defaultAvgDrinkPriceCents,
    };
  }

  const baseCents = profile.safeValueCents > 0 ? profile.safeValueCents : profile.typicalValueCents;
  const targetCents = roundToStep(baseCents);
  const ceilingCents = Math.max(roundToStep(targetCents * 1.25), targetCents + LIMIT_STEP_CENTS);
  const maxCents = Math.max(roundToStep(targetCents * 1.5), ceilingCents + LIMIT_STEP_CENTS);

  return {
    targetCents,
    ceilingCents,
    maxCents,
    avgDrinkPriceCents: profile.defaultAvgDrinkPriceCents,
  };
}

export interface CreateSessionInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Null for one-off event sessions (DEC-073). */
  activityProfileId: string | null;
  name: string;
  limits: SessionLimits;
  quickAddValuesCents: number[];
}

export function createSession(input: CreateSessionInput): Session {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    activityProfileId: input.activityProfileId,
    status: 'active',
    name: input.name,
    targetCents: input.limits.targetCents,
    ceilingCents: input.limits.ceilingCents,
    maxCents: input.limits.maxCents,
    startedAt: new Date().toISOString(),
    endedAt: null,
    quickAddValuesCents: input.quickAddValuesCents,
    avgDrinkPriceCents: input.limits.avgDrinkPriceCents,
    firedAlertPercents: [],
    overMaxConfirmedAt: null,
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

/**
 * Personal session total: shared items count only the user's part
 * (personalCostCents) — DEC-047.
 */
export function calculateSessionTotal(transactions: Transaction[]): number {
  return sumCents(
    transactions
      .filter((t) => t.deletedAt === null && t.type === 'expense')
      .map((t) => t.personalCostCents ?? t.amountCents),
  );
}

export function getSessionPercentUsed(
  totalSpentCents: number,
  limitCents: number | null,
): number {
  if (!limitCents || limitCents === 0) return 0;
  return Math.round((totalSpentCents / limitCents) * 100);
}

// DEC-113 (R5-09): the gauge bar segments have FIXED visual widths
// (flex 3:2:1:1 → green ends at 42.86%, primary at 71.43%, then amber/red
// up to 100%). The dot must be mapped piecewise onto those visual ranges —
// a linear spent/max position puts e.g. 40 of target 35 / ceiling 45 /
// max 55 past the 45 mark on screen.
const GAUGE_TARGET_END = 300 / 7; // 42.857% — end of the green segment
const GAUGE_CEILING_END = 500 / 7; // 71.428% — end of the primary segment

export function calculateGaugePosition(
  spentCents: number,
  targetCents: number,
  ceilingCents: number,
  maxCents: number,
): number {
  if (spentCents <= 0) return 0;
  if (maxCents <= 0) return 0;
  if (spentCents >= maxCents) return 100;

  const mapSegment = (
    value: number,
    fromStart: number,
    fromEnd: number,
    toStart: number,
    toEnd: number,
  ): number => {
    const span = fromEnd - fromStart;
    if (span <= 0) return toEnd;
    return toStart + ((value - fromStart) / span) * (toEnd - toStart);
  };

  if (targetCents > 0 && spentCents <= targetCents) {
    return mapSegment(spentCents, 0, targetCents, 0, GAUGE_TARGET_END);
  }
  if (ceilingCents > targetCents && spentCents <= ceilingCents) {
    return mapSegment(spentCents, targetCents, ceilingCents, GAUGE_TARGET_END, GAUGE_CEILING_END);
  }
  // Beyond the ceiling (or degenerate thresholds): amber + red zone.
  const zoneStart = Math.max(targetCents, ceilingCents);
  return mapSegment(spentCents, zoneStart, maxCents, GAUGE_CEILING_END, 100);
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

/**
 * Compact duration of a completed session for the outing history
 * (DEC-079 / FIELD-09): "3h12" / "45min". Null endedAt → empty string.
 */
export function formatSessionDuration(startedAt: string, endedAt: string | null): string {
  if (endedAt === null) return '';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return '0min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
