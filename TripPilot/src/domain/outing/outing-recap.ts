import type { Transaction } from '@/domain/types/transaction';
import { calculateSessionTotal } from './outing';

/**
 * M17-lite (DEC-292) — the "light closing recap". A pure, testable model of how an
 * outing went, reusing the exact figures the end-of-outing review already shows
 * (total, rounds, duration, vs-target). The closing moment and the review screen
 * read from this single source so they can never disagree.
 */
export type OutingRecapOutcome = 'under' | 'on' | 'over' | 'no_target';

export interface OutingRecap {
  totalCents: number;
  itemCount: number;
  durationMin: number;
  targetCents: number;
  /** target − total: positive = under target (money saved), negative = over. */
  vsTargetCents: number;
  outcome: OutingRecapOutcome;
}

export interface BuildOutingRecapInput {
  transactions: Transaction[];
  startedAt: string;
  endedAt: string | null;
  targetCents: number | null;
  /** Injectable clock so a recap built before `endedAt` is persisted stays stable in tests. */
  now?: number;
}

export function buildOutingRecap(input: BuildOutingRecapInput): OutingRecap {
  const totalCents = calculateSessionTotal(input.transactions);
  const itemCount = input.transactions.length;
  const endMs = input.endedAt ? new Date(input.endedAt).getTime() : (input.now ?? Date.now());
  const durationMin = Math.max(
    0,
    Math.floor((endMs - new Date(input.startedAt).getTime()) / 60000),
  );
  const targetCents = input.targetCents ?? 0;
  const vsTargetCents = targetCents - totalCents;
  return {
    totalCents,
    itemCount,
    durationMin,
    targetCents,
    vsTargetCents,
    outcome: resolveOutcome(targetCents, totalCents, vsTargetCents),
  };
}

/** A vs-target read only makes sense with a real target AND real spend (DEC-173). */
function resolveOutcome(
  targetCents: number,
  totalCents: number,
  vsTargetCents: number,
): OutingRecapOutcome {
  if (targetCents <= 0 || totalCents <= 0) return 'no_target';
  if (vsTargetCents > 0) return 'under';
  if (vsTargetCents < 0) return 'over';
  return 'on';
}

const HEADLINE_KEYS: Record<OutingRecapOutcome, string> = {
  under: 'outing.recap_headline_under',
  on: 'outing.recap_headline_on',
  over: 'outing.recap_headline_over',
  no_target: 'outing.recap_headline_done',
};

/** i18n key for the warm peak-end headline matching the outcome. */
export function recapHeadlineKey(outcome: OutingRecapOutcome): string {
  return HEADLINE_KEYS[outcome];
}

/** Compact duration label ("45min" / "2h30") shared by the recap chips. */
export function formatRecapDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
