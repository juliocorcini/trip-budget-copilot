import { describe, it, expect } from 'vitest';
import {
  addParticipant,
  computeGroupBalances,
  createGroupParticipant,
  createGroupSplitEvent,
  groupExpenseImages,
  parseGroupClaimResponse,
  reduceGroupClaims,
} from '@/domain/group-split';
import type { GroupExpense } from '@/domain/group-split';
import type { ImageRef } from '@/domain/media';

/**
 * G2 / DEC-348 — `groupExpenseImages` unifies the new multi-photo `imageRefs[]`
 * (F08, plaintext) with the legacy single `imageRef` (E2E, 1.2.4-rc); the claim
 * schema + reducer carry `imageRefs` end-to-end without touching the ledger math.
 */
const plain: ImageRef = { r2Id: 'r2-plain', mime: 'image/jpeg', w: 800, h: 600 };
const legacy: ImageRef = { r2Id: 'r2-legacy', key: 'k'.repeat(43), mime: 'image/jpeg', w: 800, h: 600 };

function makeExpense(partial: Partial<GroupExpense>): GroupExpense {
  return {
    id: 'e1',
    description: 'x',
    amountCents: 100,
    paidByParticipantId: 'p1',
    splitMode: 'equal',
    participantIds: ['p1'],
    customAmountsCents: {},
    category: 'other',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('groupExpenseImages (DEC-348 image read)', () => {
  it('returns the multi-photo imageRefs when present', () => {
    expect(groupExpenseImages(makeExpense({ imageRefs: [plain] }))).toEqual([plain]);
  });

  it('falls back to the legacy single imageRef', () => {
    expect(groupExpenseImages(makeExpense({ imageRef: legacy }))).toEqual([legacy]);
  });

  it('prefers imageRefs over a stale legacy single', () => {
    expect(groupExpenseImages(makeExpense({ imageRefs: [plain], imageRef: legacy }))).toEqual([plain]);
  });

  it('returns an empty list when there is no image', () => {
    expect(groupExpenseImages(makeExpense({}))).toEqual([]);
  });
});

describe('claim fold carries plaintext imageRefs without changing the ledger', () => {
  function buildEvent() {
    const base = createGroupSplitEvent({ name: 'Trip', currency: 'EUR', ownerName: 'Ana' });
    return addParticipant(base, createGroupParticipant({ name: 'Bruno' }));
  }

  it('parses a guest claim with imageRefs (no key) and folds the receipt onto the expense', () => {
    const event = buildEvent();
    const owner = event.participants[0]!;
    const bruno = event.participants[1]!;
    const claim = parseGroupClaimResponse({
      v: 1,
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: bruno.id,
      markedPaid: false,
      expenses: [
        {
          id: 'g:dev-bruno:1',
          description: 'Taxi',
          amountCents: 2000,
          paidByParticipantId: bruno.id,
          splitMode: 'equal',
          participantIds: [owner.id, bruno.id],
          imageRefs: [{ r2Id: 'r2-taxi', mime: 'image/jpeg', w: 800, h: 600 }],
        },
      ],
      at: '2026-01-01T00:00:00.000Z',
    });
    expect(claim).not.toBeNull();

    const folded = reduceGroupClaims(event, [claim!]);
    const taxi = folded.expenses.find((e) => e.id === 'g:dev-bruno:1');
    expect(taxi).toBeTruthy();
    expect(groupExpenseImages(taxi!)).toEqual([{ r2Id: 'r2-taxi', mime: 'image/jpeg', w: 800, h: 600 }]);

    // Ledger-math invariance: Bruno paid €20, both share €10 → Bruno +€10, Ana −€10, Σ=0.
    const net = new Map(computeGroupBalances(folded).map((b) => [b.participantId, b.netCents]));
    expect(net.get(bruno.id)).toBe(1000);
    expect(net.get(owner.id)).toBe(-1000);
    expect((net.get(bruno.id) ?? 0) + (net.get(owner.id) ?? 0)).toBe(0);
  });
});
