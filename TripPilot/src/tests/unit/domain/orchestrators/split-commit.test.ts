import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { commitSplit, undoSplitCommit } from '@/domain/orchestrators';
import type { CommitSplitInput } from '@/domain/orchestrators';
import {
  claimItemWhole,
  createSplitItem,
  createSplitSession,
  addParticipant,
} from '@/domain/split';
import type { SplitItem, SplitMode, SplitSession } from '@/domain/split';
import type { Attachment } from '@/domain/types/attachment';

// T1/M3: commitSplit turns an in-progress division into ONE completed outing
// (one expense for the whole bill + per-real-participant shares), keeping the
// readable item-level division in the SplitRecord (splitMeta). Tested against
// the real (fake-indexeddb) db, mirroring commitReceipt's coverage.

const OWNER = 'owner-1';
const FRIEND = 'friend-1';

interface Built {
  session: SplitSession;
  ownerSplitId: string;
  friendSplitId: string;
}

/** Owner + one guest ("Ana"); two items the caller can claim. */
function buildSession(items: SplitItem[], mode: SplitMode = 'itemized'): Built {
  const base = createSplitSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    name: 'Jantar',
    currency: 'BRL',
    mode,
    ownerName: 'Eu',
  });
  const ownerSplitId = base.participants[0]!.id;
  const withItems: SplitSession = { ...base, items };
  const { session, participant } = addParticipant(withItems, 'Ana');
  return { session, ownerSplitId, friendSplitId: participant.id };
}

function mkInput(
  built: Built,
  overrides: Partial<CommitSplitInput> = {},
): CommitSplitInput {
  return {
    session: built.session,
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    ownerParticipantId: OWNER,
    walletId: null,
    participantIdMap: { [built.friendSplitId]: FRIEND },
    exchangeRate: null,
    attachmentId: null,
    ...overrides,
  };
}

const mkAttachment = (id: string): Attachment => ({
  id,
  transactionId: null,
  sessionId: null,
  mimeType: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  thumbnailDataUrl: 'data:image/jpeg;base64,AAAA',
  width: 100,
  height: 100,
  byteSize: 1,
  createdAt: new Date().toISOString(),
});

/** Pizza 6000 claimed by owner, beer 2000 claimed by Ana (itemized). */
function itemizedBill(): { built: Built; pizzaId: string; beerId: string } {
  const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000, category: 'restaurant' });
  const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000, category: 'bar' });
  let built = buildSession([pizza, beer]);
  let session = claimItemWhole(built.session, pizza.id, built.ownerSplitId);
  session = claimItemWhole(session, beer.id, built.friendSplitId);
  built = { ...built, session };
  return { built, pizzaId: pizza.id, beerId: beer.id };
}

describe('commitSplit (T1)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.sessions.clear(),
      db.transactions.clear(),
      db.sessionItems.clear(),
      db.participantShares.clear(),
      db.attachments.clear(),
      db.splitSessions.clear(),
    ]);
  });

  it('creates one completed session holding a single expense for the whole bill', async () => {
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built));

    const session = await db.sessions.get(result.sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
    expect(session!.endedAt).not.toBeNull();
    expect(session!.activityProfileId).toBeNull();
    expect(session!.name).toBe('Jantar');

    const txs = await db.transactions.where('sessionId').equals(result.sessionId).toArray();
    expect(txs).toHaveLength(1);
    const tx = txs[0]!;
    expect(tx.type).toBe('expense');
    expect(tx.amountCents).toBe(8000);
    expect(tx.category).toBe('restaurant');
    expect(tx.excludeFromLearning).toBe(true);
    expect(tx.externalRef?.startsWith('split:')).toBe(true);

    const items = await db.sessionItems.where('sessionId').equals(result.sessionId).toArray();
    expect(items).toHaveLength(1);
  });

  it('DEC-241: charges the owner their slice and records a CONFIRMED debt for a non-connected friend', async () => {
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built));

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.isShared).toBe(true);
    expect(tx.personalCostCents).toBe(6000);
    expect(tx.paidByParticipantId).toBe(OWNER);

    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    expect(shares).toHaveLength(2);
    const owner = shares.find((s) => s.participantId === OWNER)!;
    const friend = shares.find((s) => s.participantId === FRIEND)!;
    expect(owner.shareAmountCents).toBe(6000);
    expect(owner.confirmationStatus).toBe('confirmed');
    expect(owner.isPaid).toBe(true);
    expect(friend.shareAmountCents).toBe(2000);
    // Ana has no paired device (no actorId): the debt is real immediately.
    expect(friend.confirmationStatus).toBe('confirmed');
    expect(friend.isPaid).toBe(false);
    expect(friend.shareType).toBe('custom');
  });

  it('DEC-241: a CONNECTED app friend (actorId) stays pending until they answer the mirror', async () => {
    // Ana joined from her own device (live link) → has an actorId → connected.
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000, category: 'restaurant' });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000, category: 'bar' });
    const base = createSplitSession({
      tripId: 'trip-1', phaseId: 'phase-1', name: 'Jantar', currency: 'BRL', mode: 'itemized', ownerName: 'Eu',
    });
    const ownerSplitId = base.participants[0]!.id;
    const added = addParticipant({ ...base, items: [pizza, beer] }, 'Ana', { actorId: 'actor-ana' });
    let session = claimItemWhole(added.session, pizza.id, ownerSplitId);
    session = claimItemWhole(session, beer.id, added.participant.id);

    const result = await commitSplit(
      mkInput({ session, ownerSplitId, friendSplitId: added.participant.id }),
    );

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    const friend = shares.find((s) => s.participantId === FRIEND)!;
    expect(friend.confirmationStatus).toBe('pending');
  });

  it('persists the SplitRecord as committed, linked to the new session', async () => {
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built));

    expect(result.splitRecordId).toBe(built.session.id);
    const record = await db.splitSessions.get(result.splitRecordId);
    expect(record).toBeDefined();
    expect(record!.status).toBe('committed');
    expect(record!.sessionId).toBe(result.sessionId);
    expect(record!.splitMeta.status).toBe('committed');
    expect(record!.splitMeta.items).toHaveLength(2);
    expect(record!.tripId).toBe('trip-1');
  });

  it('keeps ad-hoc people off the ledger: full bill, no extra debt, not shared', async () => {
    const { built } = itemizedBill();
    // Ana is NOT mapped to a real participant → ad-hoc, no share/debt.
    const result = await commitSplit(mkInput(built, { participantIdMap: {} }));

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.amountCents).toBe(8000); // whole bill still recorded
    expect(tx.personalCostCents).toBe(6000); // owner not over-charged
    expect(tx.isShared).toBe(false);

    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    expect(shares).toHaveLength(0);
  });

  it('mine mode: the owner bears the whole bill with no shares', async () => {
    const a = createSplitItem({ description: 'Conta', amountCents: 5000, category: 'restaurant' });
    const built = buildSession([a], 'mine');
    const result = await commitSplit(mkInput(built));

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.amountCents).toBe(5000);
    expect(tx.personalCostCents).toBe(5000);
    expect(tx.isShared).toBe(false);
    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    expect(shares).toHaveLength(0);
  });

  it('foreign bill: stores the base-currency amount and rate, keeps personal cost in bill cents', async () => {
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built, { exchangeRate: 0.2 }));

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.amountCents).toBe(8000);
    expect(tx.exchangeRate).toBe(0.2);
    expect(tx.baseCurrencyAmountCents).toBe(1600); // 8000 * 0.2
    expect(tx.personalCostCents).toBe(6000); // bill cents; budget scales by rate on read
  });

  it('links the bill photo to the created session', async () => {
    await db.attachments.add(mkAttachment('att-1'));
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built, { attachmentId: 'att-1' }));

    const linked = await db.attachments.get('att-1');
    expect(linked!.sessionId).toBe(result.sessionId);
    expect(linked!.transactionId).toBeNull();
  });

  it('undo soft-deletes session/items/tx/shares and reverts the SplitRecord to draft', async () => {
    const { built } = itemizedBill();
    const result = await commitSplit(mkInput(built));

    await undoSplitCommit({
      splitRecordId: result.splitRecordId,
      sessionId: result.sessionId,
      transactionId: result.transactionId,
    });

    const session = await db.sessions.get(result.sessionId);
    expect(session!.deletedAt).not.toBeNull();

    const tx = await db.transactions.get(result.transactionId);
    expect(tx!.deletedAt).not.toBeNull();

    const items = await db.sessionItems.where('sessionId').equals(result.sessionId).toArray();
    expect(items.every((i) => i.deletedAt !== null)).toBe(true);

    const shares = await db.participantShares.where('transactionId').equals(result.transactionId).toArray();
    expect(shares.every((s) => s.deletedAt !== null)).toBe(true);

    const record = await db.splitSessions.get(result.splitRecordId);
    expect(record!.status).toBe('draft');
    expect(record!.sessionId).toBeNull();
    expect(record!.splitMeta.status).toBe('draft');
    expect(record!.revision).toBeGreaterThan(0);
  });
});
