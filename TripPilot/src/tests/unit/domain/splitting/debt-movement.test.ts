import { describe, it, expect } from 'vitest';
import {
  ownerPairwiseBalances,
  buildParticipantStatement,
  filterStatementToCounterparty,
  isShareReassignable,
  classifyMoveDestination,
  reassignShares,
  revertReassignedShares,
  createDebtMovement,
} from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';

/**
 * DEC-414 (G6 · Â-DEBT-TRACEABLE) — moving a debt between people by reassigning
 * shares. The keystone is INVARIANCE: the owner's TOTAL pairwise net never moves,
 * only the per-person holder. Julio's case: Débora owes me €12, Bruno €40 → move
 * Débora's €12 to Bruno → Débora zeros, Bruno becomes €52, my total stays €52.
 */
const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const OWNER = 'julio';

const participants: Participant[] = [
  { ...meta, id: OWNER, tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
  { ...meta, id: 'debora', tripId: 'trip-1', name: 'Débora', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
  { ...meta, id: 'bruno', tripId: 'trip-1', name: 'Bruno', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
];

const mkTx = (id: string, payerId: string | null): Transaction => ({
  ...meta, id, tripId: 'trip-1', phaseId: 'ph-1',
  budgetPoolId: 'pool-1', walletId: null, sessionId: null,
  type: 'expense', amountCents: 20000, personalCostCents: null,
  currency: 'EUR', baseCurrencyAmountCents: 20000, exchangeRate: null,
  category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null,
  description: id, date: '2026-07-01T00:00:00.000Z',
  isShared: true, paidByParticipantId: payerId,
  activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
  sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
});

const mkShare = (
  id: string,
  txId: string,
  participantId: string,
  cents: number,
  overrides: Partial<ParticipantShare> = {},
): ParticipantShare => ({
  ...meta, id, transactionId: txId, participantId, shareAmountCents: cents,
  shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null,
  ...overrides,
});

// Owner paid both expenses → Débora owes €12, Bruno owes €40.
const txDeb = mkTx('tx-deb', OWNER);
const txBru = mkTx('tx-bru', OWNER);
const baselineShares: ParticipantShare[] = [
  mkShare('s-o1', 'tx-deb', OWNER, 8800),
  mkShare('s-deb', 'tx-deb', 'debora', 1200),
  mkShare('s-o2', 'tx-bru', OWNER, 16000),
  mkShare('s-bru', 'tx-bru', 'bruno', 4000),
];
const txs = [txDeb, txBru];

const ownerTotalNet = (balances: Map<string, number>): number =>
  -[...balances.values()].reduce((a, b) => a + b, 0);

describe('reassignShares — the money invariant (DEC-414)', () => {
  it('moves Débora €12 → Bruno: Débora zeros, Bruno becomes €52, total net unchanged', () => {
    const baseline = ownerPairwiseBalances(txs, baselineShares, [], OWNER);
    expect(baseline.get('debora')).toBe(-1200);
    expect(baseline.get('bruno')).toBe(-4000);
    const baselineTotal = ownerTotalNet(baseline);
    expect(baselineTotal).toBe(5200); // I am owed €52 total

    // Move Débora's single share to Bruno.
    const toMove = baselineShares.filter((s) => s.id === 's-deb');
    const moved = reassignShares(toMove, 'debora', 'bruno');
    const after = baselineShares.map((s) => moved.find((m) => m.id === s.id) ?? s);

    const balances = ownerPairwiseBalances(txs, after, [], OWNER);
    expect(balances.get('debora') ?? 0).toBe(0); // Débora zeroed
    expect(balances.get('bruno')).toBe(-5200); // Bruno absorbed the €12
    // INVARIANT: the owner's total receivable is identical — only the holder moved.
    expect(ownerTotalNet(balances)).toBe(baselineTotal);
  });

  it('never touches share amounts (only participantId + reassignedFrom)', () => {
    const [moved] = reassignShares([baselineShares[1]!], 'debora', 'bruno');
    expect(moved!.shareAmountCents).toBe(1200); // unchanged
    expect(moved!.participantId).toBe('bruno');
    expect(moved!.reassignedFrom).toBe('debora');
  });
});

describe('reassignShares — visible attribution (DEC-414)', () => {
  it("Bruno's statement shows the moved item as 'moved from Débora'", () => {
    const moved = reassignShares([baselineShares[1]!], 'debora', 'bruno');
    const after = baselineShares.map((s) => moved.find((m) => m.id === s.id) ?? s);

    const statement = filterStatementToCounterparty(
      buildParticipantStatement('bruno', txs, after, participants, [], OWNER),
      OWNER,
    );
    const movedLine = statement.lines.find((l) => l.transactionId === 'tx-deb');
    expect(movedLine).toBeDefined();
    expect(movedLine!.reassignedFromId).toBe('debora');
    expect(movedLine!.reassignedFromName).toBe('Débora');
    // Bruno's own original line carries no trail.
    const ownLine = statement.lines.find((l) => l.transactionId === 'tx-bru');
    expect(ownLine!.reassignedFromId).toBeNull();
  });
});

describe('revertReassignedShares — undo (DEC-414)', () => {
  it('returns the debt to Débora and clears the trail, restoring the baseline net', () => {
    const moved = reassignShares([baselineShares[1]!], 'debora', 'bruno');
    const after = baselineShares.map((s) => moved.find((m) => m.id === s.id) ?? s);

    const reverted = revertReassignedShares(after.filter((s) => s.id === 's-deb'), 'debora');
    const restored = after.map((s) => reverted.find((r) => r.id === s.id) ?? s);

    const balances = ownerPairwiseBalances(txs, restored, [], OWNER);
    expect(balances.get('debora')).toBe(-1200);
    expect(balances.get('bruno')).toBe(-4000);
    const share = restored.find((s) => s.id === 's-deb')!;
    expect(share.participantId).toBe('debora');
    expect(share.reassignedFrom).toBeNull();
  });
});

describe('isShareReassignable — only local, open, confirmed debts (DEC-414)', () => {
  const base = { deletedAt: null, confirmationStatus: 'confirmed' as const, isPaid: false };

  it('a local confirmed unpaid share is movable', () => {
    expect(isShareReassignable(base, false)).toBe(true);
  });

  it('a P2P-connected origin is NOT movable (would break their mirror)', () => {
    expect(isShareReassignable(base, true)).toBe(false);
  });

  it('pending / rejected / paid / deleted shares are never movable', () => {
    expect(isShareReassignable({ ...base, confirmationStatus: 'pending' }, false)).toBe(false);
    expect(isShareReassignable({ ...base, confirmationStatus: 'rejected' }, false)).toBe(false);
    expect(isShareReassignable({ ...base, isPaid: true }, false)).toBe(false);
    expect(isShareReassignable({ ...base, deletedAt: '2026-01-01T00:00:00.000Z' }, false)).toBe(false);
  });
});

describe('classifyMoveDestination — connected peers are charged, not moved (DEC-430)', () => {
  it('a local, non-owner, non-source person is an ELIGIBLE direct destination', () => {
    expect(classifyMoveDestination({ isOwner: false, isSource: false, isLocal: true })).toBe('eligible');
  });

  it('a P2P-connected (non-local) person is a CONNECTED_PEER — not a direct destination', () => {
    // The "why not eligible": reassigning a mirrored share would desync their device
    // (Â-DEBT-SYNC-SAFE), so the sheet routes to an accept-first charge instead.
    expect(classifyMoveDestination({ isOwner: false, isSource: false, isLocal: false })).toBe(
      'connected_peer',
    );
  });

  it('the owner is never a candidate, regardless of locality', () => {
    expect(classifyMoveDestination({ isOwner: true, isSource: false, isLocal: true })).toBeNull();
    expect(classifyMoveDestination({ isOwner: true, isSource: false, isLocal: false })).toBeNull();
  });

  it('the source person (moving FROM) is never their own destination', () => {
    expect(classifyMoveDestination({ isOwner: false, isSource: true, isLocal: true })).toBeNull();
    expect(classifyMoveDestination({ isOwner: false, isSource: true, isLocal: false })).toBeNull();
  });
});

describe('createDebtMovement — the audit log (DEC-414)', () => {
  it('captures who, whom, which shares and the total', () => {
    const movement = createDebtMovement('trip-1', 'debora', 'bruno', ['s-deb'], 1200);
    expect(movement.fromParticipantId).toBe('debora');
    expect(movement.toParticipantId).toBe('bruno');
    expect(movement.shareIds).toEqual(['s-deb']);
    expect(movement.amountCents).toBe(1200);
    expect(movement.undoneAt).toBeNull();
    expect(movement.tripId).toBe('trip-1');
  });
});
