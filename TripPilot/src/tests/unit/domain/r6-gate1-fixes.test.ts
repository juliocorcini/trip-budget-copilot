import { describe, it, expect } from 'vitest';
import {
  findActivePhase,
  resolveActivePhase,
  localDayOf,
  localClockTime,
  moveToLocalDay,
  localDateString,
} from '@/domain/dates';
import { calculateSpentOnDate, createExpenseTransaction } from '@/domain/transactions';
import { sumSpentInOccurrenceInterval } from '@/domain/planning';
import {
  calculateDebts,
  scaleSharesToTotal,
  calculateOwnerPersonalCost,
} from '@/domain/splitting';
import { calculateEffectiveSpendingDays, getDaySpendingWeight } from '@/domain/phases';
import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

/** ISO UTC instant for a LOCAL wall-clock datetime (TZ-independent fixture). */
function localInstant(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: 'tx-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: 1000,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: '2026-06-10T12:00:00.000Z',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
    ...overrides,
  };
}

function makeShare(overrides: Partial<ParticipantShare>): ParticipantShare {
  return {
    ...meta,
    id: 's-1',
    transactionId: 'tx-1',
    participantId: 'p-1',
    shareAmountCents: 1000,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'confirmed',
    notes: null,
    ...overrides,
  };
}

function makeParticipant(id: string, isOwner = false): Participant {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name: id,
    nickname: null,
    isOwner,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
  };
}

/* ── R6-01 / BUG-001: local day projection of UTC instants ─────────────── */

describe('localDayOf (BUG-001)', () => {
  it('keeps a late-evening local expense on its local day', () => {
    const iso = localInstant('2026-06-10T23:30:00');
    expect(localDayOf(iso)).toBe('2026-06-10');
  });

  it('keeps an early-morning local expense on its local day', () => {
    const iso = localInstant('2026-06-10T00:15:00');
    expect(localDayOf(iso)).toBe('2026-06-10');
  });

  it('a transaction created "now" always belongs to today (local)', () => {
    const tx = createExpenseTransaction({
      tripId: 't1',
      phaseId: 'p1',
      budgetPoolId: 'pool1',
      walletId: null,
      amountCents: 700,
      currency: 'EUR',
      category: 'bar',
      description: 'beer',
    });
    expect(localDayOf(tx.date)).toBe(localDateString(new Date()));
  });
});

describe('calculateSpentOnDate (BUG-001)', () => {
  it('counts a 23:30 local expense on the local day, not the UTC day', () => {
    const tx = makeTx({ date: localInstant('2026-06-10T23:30:00') });
    expect(calculateSpentOnDate([tx], '2026-06-10')).toBe(1000);
  });

  it('does not count the expense on the neighbouring days', () => {
    const tx = makeTx({ date: localInstant('2026-06-10T23:30:00') });
    expect(calculateSpentOnDate([tx], '2026-06-09')).toBe(0);
    expect(calculateSpentOnDate([tx], '2026-06-11')).toBe(0);
  });
});

describe('sumSpentInOccurrenceInterval (BUG-001)', () => {
  const occ: PlannedOccurrence = {
    ...meta,
    id: 'occ-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: 'Lisbon',
    plannedDate: '2026-06-10',
    endDate: '2026-06-11',
    kind: 'sub_destination',
    estimatedCostCents: 0,
    reservedCents: null,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    notes: null,
  };

  it('includes a late-evening local expense inside the interval', () => {
    const tx = makeTx({ date: localInstant('2026-06-10T23:30:00') });
    expect(sumSpentInOccurrenceInterval(occ, [tx])).toBe(1000);
  });

  it('excludes an expense from the local day before the interval', () => {
    const tx = makeTx({ date: localInstant('2026-06-09T23:30:00') });
    expect(sumSpentInOccurrenceInterval(occ, [tx])).toBe(0);
  });
});

describe('moveToLocalDay (BUG-001 retroactive edit)', () => {
  it('moves the local day while preserving the local wall-clock time', () => {
    const iso = localInstant('2026-06-10T21:15:30');
    const moved = moveToLocalDay(iso, '2026-06-05');
    expect(localDayOf(moved)).toBe('2026-06-05');
    expect(localClockTime(moved)).toBe('21:15');
  });
});

/* ── R6-02 / BUG-002: the whole end date of a phase is active ──────────── */

describe('findActivePhase end-date inclusivity (BUG-002)', () => {
  const phases: Phase[] = [
    { ...meta, id: 'p1', tripId: 'trip-1', name: 'Phase 1', startDate: '2026-07-01', endDate: '2026-07-15', order: 0, rhythmPreset: null, peakDays: null, notes: null },
    { ...meta, id: 'p2', tripId: 'trip-1', name: 'Phase 2', startDate: '2026-07-16', endDate: '2026-07-31', order: 1, rhythmPreset: null, peakDays: null, notes: null },
  ];

  it('is active at 00:00 local of the end date', () => {
    expect(findActivePhase(phases, new Date('2026-07-15T00:00:00'))?.id).toBe('p1');
  });

  it('is active at 14:00 local of the end date', () => {
    expect(findActivePhase(phases, new Date('2026-07-15T14:00:00'))?.id).toBe('p1');
  });

  it('is active at 23:59 local of the end date', () => {
    expect(findActivePhase(phases, new Date('2026-07-15T23:59:00'))?.id).toBe('p1');
  });

  it('hands over to the next phase on its start date', () => {
    expect(findActivePhase(phases, new Date('2026-07-16T08:00:00'))?.id).toBe('p2');
  });

  it('returns null after the last phase ends', () => {
    expect(findActivePhase(phases, new Date('2026-08-01T08:00:00'))).toBeNull();
  });

  it('resolveActivePhase returns the current phase on the last day (not phases[0])', () => {
    expect(resolveActivePhase(phases, new Date('2026-07-31T14:00:00'))?.id).toBe('p2');
  });
});

/* ── R6-03 / BUG-003: creditor over-allocation ─────────────────────────── */

describe('calculateDebts with multiple debtors and creditors (BUG-003)', () => {
  const participants = [
    makeParticipant('owner', true),
    makeParticipant('A'),
    makeParticipant('B'),
    makeParticipant('C'),
    makeParticipant('D'),
  ];

  // Balances: A -5000, B -2000, C +4000, D +3000.
  const txs = [
    makeTx({ id: 'tx-1', isShared: true, paidByParticipantId: 'C', amountCents: 4000 }),
    makeTx({ id: 'tx-2', isShared: true, paidByParticipantId: 'D', amountCents: 1000 }),
    makeTx({ id: 'tx-3', isShared: true, paidByParticipantId: 'D', amountCents: 2000 }),
  ];
  const shares = [
    makeShare({ id: 's-1', transactionId: 'tx-1', participantId: 'A', shareAmountCents: 4000 }),
    makeShare({ id: 's-2', transactionId: 'tx-2', participantId: 'A', shareAmountCents: 1000 }),
    makeShare({ id: 's-3', transactionId: 'tx-3', participantId: 'B', shareAmountCents: 2000 }),
  ];

  it('never credits a creditor beyond their net balance', () => {
    const { debts, totalDebtCents } = calculateDebts(txs, shares, participants, [], 'owner');

    const creditedTo = (id: string) =>
      debts.filter((d) => d.creditorId === id).reduce((sum, d) => sum + d.amountCents, 0);
    const owedBy = (id: string) =>
      debts.filter((d) => d.debtorId === id).reduce((sum, d) => sum + d.amountCents, 0);

    expect(creditedTo('C')).toBe(4000);
    expect(creditedTo('D')).toBe(3000);
    expect(owedBy('A')).toBe(5000);
    expect(owedBy('B')).toBe(2000);
    expect(totalDebtCents).toBe(7000);
  });
});

/* ── R6-04 / BUG-004: editing total after a rejected share ─────────────── */

describe('edit shared total after rejection (BUG-004, DEC-071)', () => {
  it('returns the rejected scaled share to the payer personal cost', () => {
    // €30 split equally among owner + B + C; B rejected; total edited to €60.
    const tx = makeTx({
      id: 'tx-1',
      isShared: true,
      paidByParticipantId: 'owner',
      amountCents: 3000,
    });
    const shares = [
      makeShare({ id: 's-o', participantId: 'owner', shareAmountCents: 1000 }),
      makeShare({ id: 's-b', participantId: 'B', shareAmountCents: 1000, confirmationStatus: 'rejected' }),
      makeShare({ id: 's-c', participantId: 'C', shareAmountCents: 1000 }),
    ];

    const newShares = scaleSharesToTotal(shares, 6000);
    const cost = calculateOwnerPersonalCost({ ...tx, amountCents: 6000 }, newShares, 'owner');

    // Owner keeps own 2000 + B's rejected 2000 = 6000 - kept C 2000.
    expect(cost).toBe(4000);
  });
});

/* ── R6-05 / PAR-006: rhythm cursor uses the local day ─────────────────── */

describe('calculateEffectiveSpendingDays local cursor (PAR-006)', () => {
  // 2026-06-12 is a Friday (weekday 5).
  const phase: Phase = {
    ...meta,
    id: 'p1',
    tripId: 'trip-1',
    name: 'Peak phase',
    startDate: '2026-06-12',
    endDate: '2026-06-12',
    order: 0,
    rhythmPreset: 'intense',
    peakDays: [5],
    notes: null,
  };

  it('weights the peak weekday correctly', () => {
    expect(getDaySpendingWeight(phase, '2026-06-12')).toBe(1.5);
    expect(calculateEffectiveSpendingDays(phase, '2026-06-12')).toBe(1.5);
  });
});
