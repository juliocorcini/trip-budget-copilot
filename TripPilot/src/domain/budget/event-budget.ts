import type { Transaction } from '@/domain/types/transaction';
import { sumCents } from '@/domain/money';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';

/**
 * DEC-386 (G1): how much of an event has actually been spent — the sum of the
 * budget impact (base-currency personal cost, the SAME rule as
 * `calculatePoolSpent`) of every live expense/adjustment explicitly attributed
 * to it via `occurrenceId`. This is the input the consumable event reserve
 * (DEC-385, G2) subtracts from `reservedCents`, so the netting against the pool
 * spent is bit-for-bit consistent. Pure.
 */
export function eventAttributedSpent(
  occurrenceId: string,
  transactions: Transaction[],
): number {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.deletedAt === null &&
          t.occurrenceId === occurrenceId &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map((t) => transactionBasePersonalCostCents(t)),
  );
}

/**
 * Â-ATTRIBUTION (DEC-386): a spend belongs to an event XOR an outing session,
 * never both. True when at most one of the two links is set. The expense factory
 * enforces it by construction (an explicit `occurrenceId` drops the session);
 * this pure guard powers tests and protects the Wise/import paths and legacy
 * records (where a field may read back `undefined`).
 */
export function isEventSessionExclusive(
  tx: { occurrenceId?: string | null; sessionId?: string | null },
): boolean {
  const hasEvent = tx.occurrenceId !== null && tx.occurrenceId !== undefined;
  const hasSession = tx.sessionId !== null && tx.sessionId !== undefined;
  return !(hasEvent && hasSession);
}
