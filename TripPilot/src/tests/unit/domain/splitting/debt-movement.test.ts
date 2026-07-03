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
 *
 * DEC-451 (D07) extends the move to CONNECTED people: sources are movable too
 * (their device receives an informative debt_move) and destinations with a
 * reachable mailbox are direct, movable targets. The name trail
 * (`reassignedFromName`) travels with the share so provenance survives devices
 * where the original debtor does not exist.
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
    const moved = reassignShares(toMove, 'debora', 'bruno', 'Débora');
    const after = baselineShares.map((s) => moved.find((m) => m.id === s.id) ?? s);

    const balances = ownerPairwiseBalances(txs, after, [], OWNER);
    expect(balances.get('debora') ?? 0).toBe(0); // Débora zeroed
    expect(balances.get('bruno')).toBe(-5200); // Bruno absorbed the €12
    // INVARIANT: the owner's total receivable is identical — only the holder moved.
    expect(ownerTotalNet(balances)).toBe(baselineTotal);
  });

  it('never touches share amounts (only participantId + reassignedFrom/Name)', () => {
    const [moved] = reassignShares([baselineShares[1]!], 'debora', 'bruno', 'Débora');
    expect(moved!.shareAmountCents).toBe(1200); // unchanged
    expect(moved!.participantId).toBe('bruno');
    expect(moved!.reassignedFrom).toBe('debora');
    expect(moved!.reassignedFromName).toBe('Débora'); // DEC-451: name travels with the share
  });
});

describe('reassignShares — visible attribution (DEC-414)', () => {
  it("Bruno's statement shows the moved item as 'moved from Débora'", () => {
    const moved = reassignShares([baselineShares[1]!], 'debora', 'bruno', 'Débora');
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

  it('DEC-451: the trail survives when the source person does not exist locally (recipient device)', () => {
    // A moved-in share on Bruno's own device: `reassignedFrom` points to an id
    // his device never had; the carried NAME still renders the provenance.
    const share = mkShare('s-in', 'tx-deb', 'bruno', 1200, {
      reassignedFrom: 'unknown-remote-id',
      reassignedFromName: 'Débora',
    });
    const statement = buildParticipantStatement(
      'bruno',
      [txDeb],
      [mkShare('s-o1', 'tx-deb', OWNER, 8800), share],
      participants.filter((p) => p.id !== 'debora'),
      [],
      OWNER,
    );
    const line = statement.lines.find((l) => l.transactionId === 'tx-deb');
    expect(line!.reassignedFromName).toBe('Débora');
  });
});

describe('revertReassignedShares — undo (DEC-414)', () => {
  it('returns the debt to Débora and clears the trail, restoring the baseline net', () => {
    const moved = reassignShares([baselineShares[1]!], 'debora', 'bruno', 'Débora');
    const after = baselineShares.map((s) => moved.find((m) => m.id === s.id) ?? s);

    const reverted = revertReassignedShares(after.filter((s) => s.id === 's-deb'), 'debora');
    const restored = after.map((s) => reverted.find((r) => r.id === s.id) ?? s);

    const balances = ownerPairwiseBalances(txs, restored, [], OWNER);
    expect(balances.get('debora')).toBe(-1200);
    expect(balances.get('bruno')).toBe(-4000);
    const share = restored.find((s) => s.id === 's-deb')!;
    expect(share.participantId).toBe('debora');
    expect(share.reassignedFrom).toBeNull();
    expect(share.reassignedFromName).toBeNull(); // DEC-451: the name trail clears too
  });
});

describe('isShareReassignable — open, confirmed debts (DEC-414, widened by DEC-451)', () => {
  const base = { deletedAt: null, confirmationStatus: 'confirmed' as const, isPaid: false };

  it('a confirmed unpaid share is movable — connected sources included (DEC-451)', () => {
    // DEC-430's "connected origin is frozen" rule is superseded: the P2P layer
    // now propagates the move, so the share itself is movable.
    expect(isShareReassignable(base)).toBe(true);
  });

  it('pending / rejected / paid / deleted shares are never movable', () => {
    expect(isShareReassignable({ ...base, confirmationStatus: 'pending' })).toBe(false);
    expect(isShareReassignable({ ...base, confirmationStatus: 'rejected' })).toBe(false);
    expect(isShareReassignable({ ...base, isPaid: true })).toBe(false);
    expect(isShareReassignable({ ...base, deletedAt: '2026-01-01T00:00:00.000Z' })).toBe(false);
  });
});

describe('classifyMoveDestination — connected with a key is MOVABLE (DEC-451, revises DEC-430)', () => {
  it('a local, non-owner, non-source person is an ELIGIBLE direct destination', () => {
    expect(
      classifyMoveDestination({ isOwner: false, isSource: false, isLocal: true, hasMailboxKey: false }),
    ).toBe('eligible');
  });

  it('a connected person WITH a reachable mailbox is CONNECTED_MOVABLE (direct move + debt_move fold)', () => {
    expect(
      classifyMoveDestination({ isOwner: false, isSource: false, isLocal: false, hasMailboxKey: true }),
    ).toBe('connected_movable');
  });

  it('a connected person WITHOUT a key stays CONNECTED_PEER — charge-only path', () => {
    // We cannot seal an envelope to them, so their device cannot be updated;
    // the sheet keeps the honest accept-first charge instead.
    expect(
      classifyMoveDestination({ isOwner: false, isSource: false, isLocal: false, hasMailboxKey: false }),
    ).toBe('connected_peer');
  });

  it('the owner is never a candidate, regardless of locality', () => {
    expect(classifyMoveDestination({ isOwner: true, isSource: false, isLocal: true, hasMailboxKey: false })).toBeNull();
    expect(classifyMoveDestination({ isOwner: true, isSource: false, isLocal: false, hasMailboxKey: true })).toBeNull();
  });

  it('the source person (moving FROM) is never their own destination', () => {
    expect(classifyMoveDestination({ isOwner: false, isSource: true, isLocal: true, hasMailboxKey: false })).toBeNull();
    expect(classifyMoveDestination({ isOwner: false, isSource: true, isLocal: false, hasMailboxKey: true })).toBeNull();
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
