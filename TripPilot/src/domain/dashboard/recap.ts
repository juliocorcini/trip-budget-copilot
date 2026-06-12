import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';
import { calculateSpentOnDate } from '@/domain/transactions';
import { calculateEffectiveSpendingDays, getDaySpendingWeight } from '@/domain/phases';
import { localDayOf } from '@/domain/dates';

/**
 * DEC-129: yesterday recap — "Ontem: €34, €12 abaixo do plano · 3º dia
 * seguido". Each past day's allowance is reconstructed by adding the spending
 * registered SINCE that day back onto the current free-to-spend (the same
 * add-back trick DEC-088 uses for "free today"). Reserve/envelope changes
 * made mid-phase are not replayed — the recap is an insight, not accounting.
 */

export interface YesterdayRecap {
  yesterdayIso: string;
  spentCents: number;
  allowanceCents: number;
  within: boolean;
  /** Distance from the allowance: saved when within, overshoot when not. */
  deltaCents: number;
  /** Consecutive days ending yesterday with spend <= that day's allowance. */
  streakDays: number;
}

export interface BuildYesterdayRecapInput {
  /** Current free-to-spend of the primary pool. */
  freeToSpendCents: number;
  todaySpentCents: number;
  /** Pool-scoped transactions (same set the hero math uses). */
  transactions: Transaction[];
  phase: Phase;
  todayIso: string;
}

const MAX_LOOKBACK_DAYS = 60;

function shiftIsoDay(iso: string, deltaDays: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function calculateDayAllowance(
  startOfDayFreeCents: number,
  phase: Phase,
  dayIso: string,
): number {
  const effectiveDays = calculateEffectiveSpendingDays(phase, dayIso);
  if (effectiveDays <= 0 || startOfDayFreeCents <= 0) {
    return Math.max(0, startOfDayFreeCents);
  }
  const weight = getDaySpendingWeight(phase, dayIso);
  return Math.round((startOfDayFreeCents * weight) / effectiveDays);
}

export function buildYesterdayRecap(input: BuildYesterdayRecapInput): YesterdayRecap | null {
  const phaseStart = input.phase.startDate.slice(0, 10);
  const yesterdayIso = shiftIsoDay(input.todayIso, -1);
  if (yesterdayIso < phaseStart) return null;

  // Nothing registered before today → there is no day to recap yet.
  const hasSpendBeforeToday = input.transactions.some((tx) => {
    if (tx.deletedAt !== null) return false;
    if (tx.type !== 'expense' && tx.type !== 'adjustment') return false;
    const day = localDayOf(tx.date);
    return day < input.todayIso && day >= phaseStart;
  });
  if (!hasSpendBeforeToday) return null;

  let recap: YesterdayRecap | null = null;
  let streak = 0;
  let addBackCents = input.todaySpentCents;

  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const dayIso = shiftIsoDay(input.todayIso, -(i + 1));
    if (dayIso < phaseStart) break;

    const spentCents = calculateSpentOnDate(input.transactions, dayIso);
    addBackCents += spentCents;
    const startOfDayFreeCents = input.freeToSpendCents + addBackCents;
    const allowanceCents = calculateDayAllowance(startOfDayFreeCents, input.phase, dayIso);
    const within = spentCents <= allowanceCents;

    if (i === 0) {
      recap = {
        yesterdayIso: dayIso,
        spentCents,
        allowanceCents,
        within,
        deltaCents: Math.abs(allowanceCents - spentCents),
        streakDays: 0,
      };
      if (!within) break;
    }

    if (!within) break;
    streak += 1;
  }

  if (recap && recap.within) recap.streakDays = streak;
  return recap;
}
