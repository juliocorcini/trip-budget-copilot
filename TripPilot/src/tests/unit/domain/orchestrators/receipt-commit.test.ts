import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { commitReceipt, undoReceiptCommit } from '@/domain/orchestrators';
import type { ReceiptDraftItem } from '@/domain/receipt';
import type { Attachment } from '@/domain/types/attachment';

// DEC-206 (G2): commitReceipt turns a reviewed receipt into a completed outing
// (one session, N expense items) atomically, splitting flagged lines via the
// DEC-114 payer truth table. Tested against the real (fake-indexeddb) db.

const OWNER = 'owner-1';

const mkItem = (overrides: Partial<ReceiptDraftItem> = {}): ReceiptDraftItem => ({
  id: crypto.randomUUID(),
  description: 'Item',
  qty: 1,
  amountCents: 500,
  category: 'other',
  include: true,
  participantIds: [],
  paidByParticipantId: null,
  ...overrides,
});

const mkInput = (items: ReceiptDraftItem[], attachmentId: string | null = null) => ({
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  ownerId: OWNER,
  currency: 'EUR',
  name: 'Mercadona BURGOS',
  items,
  attachmentId,
});

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

describe('commitReceipt (DEC-206)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.sessions.clear(),
      db.transactions.clear(),
      db.sessionItems.clear(),
      db.participantShares.clear(),
      db.attachments.clear(),
    ]);
  });

  it('creates a completed session with one expense item per kept line', async () => {
    const result = await commitReceipt(
      mkInput([
        mkItem({ description: 'Leche', amountCents: 240 }),
        mkItem({ description: 'Pan', amountCents: 100 }),
      ]),
    );

    expect(result.transactionIds).toHaveLength(2);

    const session = await db.sessions.get(result.sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
    expect(session!.endedAt).not.toBeNull();
    expect(session!.activityProfileId).toBeNull();
    expect(session!.name).toBe('Mercadona BURGOS');

    const txs = await db.transactions.where('sessionId').equals(result.sessionId).toArray();
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.type === 'expense')).toBe(true);
    expect(txs.every((t) => t.excludeFromLearning)).toBe(true);
    expect(txs.every((t) => t.externalRef?.startsWith('receipt:'))).toBe(true);

    const items = await db.sessionItems.where('sessionId').equals(result.sessionId).toArray();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.order).sort()).toEqual([1, 2]);
  });

  it('ignores excluded and non-positive lines', async () => {
    const result = await commitReceipt(
      mkInput([
        mkItem({ amountCents: 500 }),
        mkItem({ amountCents: 700, include: false }),
        mkItem({ amountCents: 0 }),
      ]),
    );
    expect(result.transactionIds).toHaveLength(1);
    const txs = await db.transactions.where('sessionId').equals(result.sessionId).toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]!.amountCents).toBe(500);
  });

  it('splits a flagged line equally and records the owner as confirmed (DEC-114)', async () => {
    const result = await commitReceipt(
      mkInput([
        mkItem({
          description: 'Shared platter',
          amountCents: 1000,
          participantIds: [OWNER, 'friend-1'],
        }),
      ]),
    );

    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.isShared).toBe(true);
    expect(tx.personalCostCents).toBe(500); // owner's equal half

    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    expect(shares).toHaveLength(2);
    const ownerShare = shares.find((s) => s.participantId === OWNER)!;
    const friendShare = shares.find((s) => s.participantId === 'friend-1')!;
    expect(ownerShare.shareAmountCents).toBe(500);
    expect(friendShare.shareAmountCents).toBe(500);
    expect(ownerShare.confirmationStatus).toBe('confirmed');
  });

  it('keeps a non-split line personal (full cost, no shares)', async () => {
    const result = await commitReceipt(mkInput([mkItem({ amountCents: 900 })]));
    const tx = (await db.transactions.where('sessionId').equals(result.sessionId).toArray())[0]!;
    expect(tx.isShared).toBe(false);
    expect(tx.personalCostCents).toBe(900);
    const shares = await db.participantShares.where('transactionId').equals(tx.id).toArray();
    expect(shares).toHaveLength(0);
  });

  it('links the receipt photo to the created session', async () => {
    const att = mkAttachment('att-1');
    await db.attachments.add(att);

    const result = await commitReceipt(mkInput([mkItem()], 'att-1'));

    const linked = await db.attachments.get('att-1');
    expect(linked!.sessionId).toBe(result.sessionId);
    expect(linked!.transactionId).toBeNull();
  });

  it('undo soft-deletes the session, its items, transactions and shares', async () => {
    const result = await commitReceipt(
      mkInput([mkItem({ amountCents: 1000, participantIds: [OWNER, 'friend-1'] })]),
    );

    await undoReceiptCommit({ sessionId: result.sessionId, transactionIds: result.transactionIds });

    const session = await db.sessions.get(result.sessionId);
    expect(session!.deletedAt).not.toBeNull();

    const txs = await db.transactions.bulkGet(result.transactionIds);
    expect(txs.every((t) => t!.deletedAt !== null)).toBe(true);

    const items = await db.sessionItems.where('sessionId').equals(result.sessionId).toArray();
    expect(items.every((i) => i.deletedAt !== null)).toBe(true);

    const shares = await db.participantShares
      .where('transactionId')
      .anyOf(result.transactionIds)
      .toArray();
    expect(shares.every((s) => s.deletedAt !== null)).toBe(true);
  });
});
