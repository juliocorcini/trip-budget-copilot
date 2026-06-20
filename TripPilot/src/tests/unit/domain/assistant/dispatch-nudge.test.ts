import { describe, it, expect } from 'vitest';
import { buildSplitNudge } from '@/domain/assistant/dispatch';
import type { ExecOp, DispatchContext } from '@/domain/assistant';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';

/**
 * DEC-246 (B5/DL-5 parity): after an AI split, the same nudge QuickAdd shows —
 * send each debtor their share link, and (only when I paid) offer "Lembrar" with
 * the right amount. This pins WHO gets nudged and WHEN amounts are populated.
 */
const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkPerson = (id: string, name: string, isOwner = false): Participant => ({
  ...meta,
  id,
  tripId: 'trip-1',
  name,
  nickname: null,
  isOwner,
  email: null,
  linkedUserAccountId: null,
  linkedActorId: null,
});

const owner = mkPerson('owner', 'Julio', true);
const bruno = mkPerson('bruno', 'Bruno');
const debora = mkPerson('debora', 'Débora');

const mkShare = (participantId: string, shareAmountCents: number): ParticipantShare => ({
  ...meta,
  id: `s-${participantId}`,
  transactionId: 'tx-1',
  participantId,
  shareAmountCents,
  shareType: 'equal',
  isPaid: false,
  confirmationStatus: 'pending',
  notes: null,
});

const mkExpenseOp = (payerId: string): Extract<ExecOp, { kind: 'expense' }> => ({
  kind: 'expense',
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: payerId === 'owner' ? 'w1' : null,
  amountCents: 3000,
  currency: 'EUR',
  category: 'restaurant',
  description: 'jantar',
  place: null,
  ownerId: 'owner',
  payerId,
  didSplit: true,
  participantIds: ['owner', 'bruno', 'debora'],
  connectedParticipantIds: [],
});

const ctx: DispatchContext = {
  transactions: [],
  participants: [owner, bruno, debora],
  ownerId: 'owner',
};

describe('buildSplitNudge', () => {
  it('I paid a 3-way split → nudge both debtors WITH their owed amounts', () => {
    const shares = [mkShare('bruno', 1000), mkShare('debora', 1000)];
    const nudge = buildSplitNudge(mkExpenseOp('owner'), shares, ctx);
    expect(nudge).toBeDefined();
    expect(nudge!.targets.map((p) => p.id).sort()).toEqual(['bruno', 'debora']);
    expect(nudge!.amountByParticipantId.get('bruno')).toBe(1000);
    expect(nudge!.amountByParticipantId.get('debora')).toBe(1000);
  });

  it('someone else paid → still nudge to send the link, but WITHOUT amounts (not my debt to charge)', () => {
    // Bruno paid; the owner + Débora owe him. Only the non-owner debtor is a target.
    const shares = [mkShare('owner', 1000), mkShare('debora', 1000)];
    const nudge = buildSplitNudge(mkExpenseOp('bruno'), shares, ctx);
    expect(nudge).toBeDefined();
    expect(nudge!.targets.map((p) => p.id)).toEqual(['debora']);
    expect(nudge!.amountByParticipantId.size).toBe(0);
  });

  it('no other debtor (only my own share) → no nudge', () => {
    const shares = [mkShare('owner', 3000)];
    expect(buildSplitNudge(mkExpenseOp('bruno'), shares, ctx)).toBeUndefined();
  });

  it('a plain expense with no shares → no nudge', () => {
    expect(buildSplitNudge(mkExpenseOp('owner'), [], ctx)).toBeUndefined();
  });
});
