import { describe, it, expect } from 'vitest';
import { summarizeOwnerDebts } from '@/domain/splitting';
import type { DebtEntry } from '@/domain/splitting';

const OWNER = 'julio';

function debt(
  debtorId: string,
  creditorId: string,
  amountCents: number,
): DebtEntry {
  return {
    debtorId,
    debtorName: debtorId,
    creditorId,
    creditorName: creditorId,
    amountCents,
  };
}

describe('summarizeOwnerDebts (G2 · DL-3)', () => {
  it('sums what others owe the owner into receivable, with per-person breakdown', () => {
    const debts = [debt('ana', OWNER, 5000), debt('bia', OWNER, 3000)];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.receivableCents).toBe(8000);
    expect(summary.payableCents).toBe(0);
    expect(summary.netCents).toBe(8000);
    expect(summary.receivableFrom.map((c) => c.participantId)).toEqual(['ana', 'bia']);
    expect(summary.payableTo).toEqual([]);
  });

  it('sums what the owner owes into payable, with per-person breakdown', () => {
    const debts = [debt(OWNER, 'ana', 4200), debt(OWNER, 'caio', 800)];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.payableCents).toBe(5000);
    expect(summary.receivableCents).toBe(0);
    expect(summary.netCents).toBe(-5000);
    expect(summary.payableTo.map((c) => c.participantId)).toEqual(['ana', 'caio']);
  });

  it('nets receivable minus payable when the owner is on both sides', () => {
    const debts = [debt('ana', OWNER, 9000), debt(OWNER, 'bia', 2500)];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.receivableCents).toBe(9000);
    expect(summary.payableCents).toBe(2500);
    expect(summary.netCents).toBe(6500);
  });

  it('ignores debts that do not involve the owner', () => {
    const debts = [debt('ana', 'bia', 7000), debt('caio', 'bia', 1000)];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.receivableCents).toBe(0);
    expect(summary.payableCents).toBe(0);
    expect(summary.netCents).toBe(0);
    expect(summary.receivableFrom).toEqual([]);
    expect(summary.payableTo).toEqual([]);
  });

  it('skips non-positive amounts so a settled pair never pollutes the hero', () => {
    const debts = [debt('ana', OWNER, 0), debt('bia', OWNER, -500), debt('caio', OWNER, 1200)];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.receivableCents).toBe(1200);
    expect(summary.receivableFrom).toHaveLength(1);
    expect(summary.receivableFrom[0]!.participantId).toBe('caio');
  });

  it('sorts each side by amount descending (largest debt first)', () => {
    const debts = [
      debt('ana', OWNER, 1000),
      debt('bia', OWNER, 9000),
      debt('caio', OWNER, 4000),
    ];

    const summary = summarizeOwnerDebts(debts, OWNER);

    expect(summary.receivableFrom.map((c) => c.amountCents)).toEqual([9000, 4000, 1000]);
    expect(summary.receivableFrom.map((c) => c.participantId)).toEqual(['bia', 'caio', 'ana']);
  });

  it('returns an all-zero summary for an empty debt graph (em dia)', () => {
    const summary = summarizeOwnerDebts([], OWNER);

    expect(summary).toEqual({
      receivableCents: 0,
      payableCents: 0,
      netCents: 0,
      receivableFrom: [],
      payableTo: [],
    });
  });
});
