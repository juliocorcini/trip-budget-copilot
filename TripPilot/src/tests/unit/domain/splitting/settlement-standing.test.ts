import { describe, it, expect } from 'vitest';
import { resolveSettlementStanding } from '@/domain/splitting';
import type { DebtEntry } from '@/domain/splitting';

function debt(debtorId: string, creditorId: string, amountCents: number): DebtEntry {
  return { debtorId, debtorName: debtorId, creditorId, creditorName: creditorId, amountCents, currency: 'EUR' };
}

/**
 * M18 (DEC-294) — the "tudo acertado ✓" seal must appear EXACTLY when the group
 * balance has zeroed after real splitting, never on a fresh trip with nothing
 * split. `outstandingCents` keeps the per-person "recebe/deve" balance derivable.
 */
describe('resolveSettlementStanding (M18 · DEC-294)', () => {
  it('seals "all settled" only after activity AND zero outstanding', () => {
    const standing = resolveSettlementStanding([], 3, 2);

    expect(standing.allSettled).toBe(true);
    expect(standing.hasActivity).toBe(true);
    expect(standing.outstandingCents).toBe(0);
  });

  it('does NOT seal when debts are still outstanding', () => {
    const standing = resolveSettlementStanding([debt('ana', 'julio', 4000)], 2, 0);

    expect(standing.allSettled).toBe(false);
    expect(standing.outstandingCents).toBe(4000);
  });

  it('does NOT seal a brand-new trip with nothing split (no false positive)', () => {
    const standing = resolveSettlementStanding([], 0, 0);

    expect(standing.hasActivity).toBe(false);
    expect(standing.allSettled).toBe(false);
    expect(standing.outstandingCents).toBe(0);
  });

  it('counts activity from a recorded settlement even with no shared expense rows', () => {
    const standing = resolveSettlementStanding([], 0, 1);

    expect(standing.hasActivity).toBe(true);
    expect(standing.allSettled).toBe(true);
  });

  it('sums only positive debts so a settled/negative pair never blocks the seal', () => {
    const standing = resolveSettlementStanding(
      [debt('ana', 'julio', 0), debt('bia', 'julio', -500)],
      4,
      1,
    );

    expect(standing.outstandingCents).toBe(0);
    expect(standing.allSettled).toBe(true);
  });

  it('keeps the outstanding total derivable across multiple open debts', () => {
    const standing = resolveSettlementStanding(
      [debt('ana', 'julio', 4000), debt('bia', 'caio', 1500)],
      5,
      1,
    );

    expect(standing.outstandingCents).toBe(5500);
    expect(standing.allSettled).toBe(false);
  });
});
