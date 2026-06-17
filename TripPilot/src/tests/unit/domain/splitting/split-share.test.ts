import { describe, it, expect } from 'vitest';
import { collectSplitNotifyTargets } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkParticipant(overrides: Partial<Participant> & { id: string }): Participant {
  return {
    ...meta,
    tripId: 'trip-1',
    name: overrides.id,
    nickname: null,
    isOwner: false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
    ...overrides,
  };
}

function mkShare(overrides: Partial<ParticipantShare> & { participantId: string }): ParticipantShare {
  return {
    ...meta,
    id: `share-${overrides.participantId}`,
    transactionId: 'tx-1',
    shareAmountCents: 1000,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'pending',
    notes: null,
    ...overrides,
  };
}

const owner = mkParticipant({ id: 'julio', name: 'Julio', isOwner: true });
const ana = mkParticipant({ id: 'ana', name: 'Ana' });
const bruno = mkParticipant({ id: 'bruno', name: 'Bruno' });

describe('collectSplitNotifyTargets (B5)', () => {
  it('returns the non-owner participants who owe a positive amount', () => {
    const shares = [
      mkShare({ participantId: 'julio', shareAmountCents: 1000 }),
      mkShare({ participantId: 'ana', shareAmountCents: 1000 }),
    ];
    const targets = collectSplitNotifyTargets(shares, [owner, ana, bruno], 'julio');
    expect(targets.map((p) => p.id)).toEqual(['ana']);
  });

  it('excludes the owner even when the owner has a share', () => {
    const shares = [mkShare({ participantId: 'julio', shareAmountCents: 5000 })];
    expect(collectSplitNotifyTargets(shares, [owner, ana], 'julio')).toEqual([]);
  });

  it('excludes zero and negative shares', () => {
    const shares = [
      mkShare({ participantId: 'ana', shareAmountCents: 0 }),
      mkShare({ participantId: 'bruno', shareAmountCents: -500 }),
    ];
    expect(collectSplitNotifyTargets(shares, [owner, ana, bruno], 'julio')).toEqual([]);
  });

  it('de-duplicates a participant who appears in multiple shares', () => {
    const shares = [
      mkShare({ id: 'a1', participantId: 'ana', shareAmountCents: 1000 }),
      mkShare({ id: 'a2', participantId: 'ana', shareAmountCents: 2000 }),
    ];
    const targets = collectSplitNotifyTargets(shares, [owner, ana], 'julio');
    expect(targets.map((p) => p.id)).toEqual(['ana']);
  });

  it('preserves the participants order regardless of share order', () => {
    const shares = [
      mkShare({ id: 's-bruno', participantId: 'bruno', shareAmountCents: 1000 }),
      mkShare({ id: 's-ana', participantId: 'ana', shareAmountCents: 1000 }),
    ];
    const targets = collectSplitNotifyTargets(shares, [owner, ana, bruno], 'julio');
    expect(targets.map((p) => p.id)).toEqual(['ana', 'bruno']);
  });

  it('ignores soft-deleted shares', () => {
    const shares = [
      mkShare({ participantId: 'ana', shareAmountCents: 1000, deletedAt: '2026-01-02T00:00:00.000Z' }),
    ];
    expect(collectSplitNotifyTargets(shares, [owner, ana], 'julio')).toEqual([]);
  });

  it('drops a share whose participant is soft-deleted or unknown', () => {
    const deletedAna = mkParticipant({ id: 'ana', deletedAt: '2026-01-02T00:00:00.000Z' });
    const shares = [
      mkShare({ participantId: 'ana', shareAmountCents: 1000 }),
      mkShare({ participantId: 'ghost', shareAmountCents: 1000 }),
    ];
    expect(collectSplitNotifyTargets(shares, [owner, deletedAna], 'julio')).toEqual([]);
  });

  it('returns an empty list when nothing was split', () => {
    expect(collectSplitNotifyTargets([], [owner, ana], 'julio')).toEqual([]);
  });
});
