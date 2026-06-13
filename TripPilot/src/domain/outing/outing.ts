import type { Session, SessionItem } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Participant } from '@/domain/types/participant';
import { createSyncMetadata } from '@/utils/entity-factory';
import { sumCents, splitEqually } from '@/domain/money';
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

/**
 * DEC-045 (E3 / M6): the quick-add buttons learn the last value used. The
 * button closest to the new item adopts its value, so the set keeps the same
 * size and order. A value already present is left untouched (no duplicates).
 */
export function updateQuickValuesFromItem(
  currentValuesCents: number[],
  newItemCents: number,
): number[] {
  if (newItemCents <= 0 || currentValuesCents.length === 0) return currentValuesCents;
  if (currentValuesCents.includes(newItemCents)) return currentValuesCents;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  currentValuesCents.forEach((value, index) => {
    const distance = Math.abs(value - newItemCents);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return currentValuesCents.map((value, index) =>
    index === closestIndex ? newItemCents : value,
  );
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
// R6-12 (R5-09): exported so the UI anchors the limit labels/ticks on the
// REAL segment boundaries instead of justify-between (0/50/100%).
export const GAUGE_TARGET_END = 300 / 7; // 42.857% — end of the green segment
export const GAUGE_CEILING_END = 500 / 7; // 71.428% — end of the primary segment

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

/**
 * DEC-117 (R-08): honest outing zones. The TARGET is the goal of the night —
 * the conversation changes the moment it is crossed, not near the max.
 */
export type OutingZone = 'under_target' | 'over_target' | 'over_ceiling' | 'over_max';

export function getOutingZone(
  totalSpentCents: number,
  targetCents: number,
  ceilingCents: number,
  maxCents: number,
): OutingZone {
  if (maxCents > 0 && totalSpentCents > maxCents) return 'over_max';
  if (ceilingCents > 0 && totalSpentCents > ceilingCents) return 'over_ceiling';
  if (targetCents > 0 && totalSpentCents > targetCents) return 'over_target';
  return 'under_target';
}

/**
 * DEC-048 + DEC-117 (R-08): progressive alerts re-anchored on the zones.
 * Milestones: half of the TARGET, crossing the target, crossing the ceiling,
 * reaching the max. `percent` is the stable id stored in firedAlertPercents
 * (50 = half target, 100 = over target, 150 = over ceiling, 200 = at max).
 */
export function getProgressiveAlerts(
  totalSpentCents: number,
  session: Session,
  _alertTone: AlertTone = 'amigo_sincero',
): OutingAlert[] {
  const alerts: OutingAlert[] = [];
  const targetCents = session.targetCents ?? 0;
  const ceilingCents = session.ceilingCents ?? 0;
  const maxCents = session.maxCents ?? 0;
  if (targetCents <= 0) return alerts;

  const milestones: { id: number; reached: boolean; type: OutingAlert['type']; msgKey: string }[] = [
    { id: 50, reached: totalSpentCents >= targetCents / 2, type: 'info', msgKey: 'halfway' },
    { id: 100, reached: totalSpentCents > targetCents, type: 'warning', msgKey: 'over_target' },
    {
      id: 150,
      reached: ceilingCents > 0 && totalSpentCents > ceilingCents,
      type: 'danger',
      msgKey: 'over_ceiling',
    },
    {
      id: 200,
      reached: maxCents > 0 && totalSpentCents >= maxCents,
      type: 'critical',
      msgKey: 'at_max',
    },
  ];

  for (const milestone of milestones) {
    if (milestone.reached) {
      alerts.push({
        percent: milestone.id,
        type: milestone.type,
        message: milestone.msgKey,
      });
    }
  }

  return alerts;
}

/**
 * DEC-117 (R-08): the "next drink" hint is anchored on the TARGET. The
 * inviting copy ("still fits without affecting other outings") may ONLY
 * appear while the next drink stays inside the target.
 */
export type NextDrinkMessageKind = 'fits_target' | 'crosses_target' | 'over_target';

export function getNextDrinkMessageKind(
  totalSpentCents: number,
  drinkPriceCents: number,
  targetCents: number,
): NextDrinkMessageKind {
  if (targetCents > 0 && totalSpentCents > targetCents) return 'over_target';
  if (targetCents > 0 && totalSpentCents + drinkPriceCents > targetCents) return 'crosses_target';
  return 'fits_target';
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

/**
 * E3 (M8): a "round" buys `count` drinks at the same unit price. DEC-047 —
 * the total is always count × unit, never a hidden surcharge.
 */
export function calculateRoundTotalCents(count: number, unitPriceCents: number): number {
  if (count <= 0 || unitPriceCents <= 0) return 0;
  return count * unitPriceCents;
}

/**
 * E3 (M8) + DEC-114: the buyer's personal cost of a round. Paying alone keeps
 * the whole total; splitting equally among `splitWays` people leaves the buyer
 * one equal share per drink (summed per item so it matches the persisted
 * shares, where the owner is the first participant).
 */
export function calculateRoundPersonalCents(
  count: number,
  unitPriceCents: number,
  splitWays: number,
): number {
  if (count <= 0 || unitPriceCents <= 0) return 0;
  if (splitWays <= 1) return count * unitPriceCents;
  const ownerSharePerItem = splitEqually(unitPriceCents, splitWays)[0] ?? 0;
  return count * ownerSharePerItem;
}

/**
 * E3 (M9): fairness rotation for "who pays the next round". Suggests the
 * participant who has paid the fewest items so far (ties broken by list
 * order). Pure suggestion — never assigns a payer. Null with < 2 participants.
 */
export function suggestNextPayer(
  participants: Participant[],
  sessionTxs: Transaction[],
  ownerId: string,
): Participant | null {
  if (participants.length < 2) return null;

  const paidCount = new Map<string, number>();
  participants.forEach((participant) => paidCount.set(participant.id, 0));
  for (const tx of sessionTxs) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const payerId = tx.paidByParticipantId ?? ownerId;
    if (paidCount.has(payerId)) {
      paidCount.set(payerId, (paidCount.get(payerId) ?? 0) + 1);
    }
  }

  let suggested: Participant | null = null;
  let fewest = Number.POSITIVE_INFINITY;
  for (const participant of participants) {
    const count = paidCount.get(participant.id) ?? 0;
    if (count < fewest) {
      fewest = count;
      suggested = participant;
    }
  }
  return suggested;
}

/**
 * E3 (M10): at the current spending rate, minutes until the session reaches
 * its ceiling. Read-only projection — null when it can't be estimated (no
 * spend yet, no elapsed time) and 0 once the ceiling is already reached.
 */
export function projectTimeToCeiling(
  currentTotalCents: number,
  ceilingCents: number,
  startedAt: string,
  now: string,
): number | null {
  if (currentTotalCents <= 0 || ceilingCents <= 0) return null;
  if (currentTotalCents >= ceilingCents) return 0;
  const elapsedMs = new Date(now).getTime() - new Date(startedAt).getTime();
  if (elapsedMs <= 0) return null;
  const centsPerMs = currentTotalCents / elapsedMs;
  if (centsPerMs <= 0) return null;
  const remainingCents = ceilingCents - currentTotalCents;
  return Math.round(remainingCents / centsPerMs / 60000);
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
