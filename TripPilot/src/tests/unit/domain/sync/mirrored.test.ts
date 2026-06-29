import { describe, it, expect } from 'vitest';
import {
  buildMirroredStatement,
  answerMirroredLine,
  clearSentResponses,
} from '@/domain/sync/mirrored';
import type { StatementPayload, StatementPayloadLine } from '@/domain/sync';

const SHARE_A = '11111111-1111-4111-8111-111111111111';
const SHARE_B = '22222222-2222-4222-8222-222222222222';
const SHARE_C = '33333333-3333-4333-8333-333333333333';
const TX = '44444444-4444-4444-8444-444444444444';
const OWNER = '55555555-5555-4555-8555-555555555555';
const PARTICIPANT = '66666666-6666-4666-8666-666666666666';
const SETTLE = '77777777-7777-4777-8777-777777777777';

function line(shareId: string, amountCents: number, status: StatementPayloadLine['confirmationStatus']): StatementPayloadLine {
  return {
    shareId,
    transactionId: TX,
    kind: 'owes',
    description: 'Dinner',
    category: 'restaurant',
    subcategoryId: null,
    occurredAt: '2026-06-09T20:00:00.000Z',
    amountCents,
    counterpartyName: 'Julio',
    confirmationStatus: status,
  };
}

function payload(lines: StatementPayloadLine[], netCents: number): StatementPayload {
  return {
    v: 1,
    owner: { actorId: OWNER, name: 'Julio' },
    participantId: PARTICIPANT,
    peerName: 'Debora',
    currency: 'EUR',
    netCents,
    generatedAt: '2026-06-10T12:00:00.000Z',
    lines,
  };
}

describe('mirrored statement lifecycle (DEC-106 mirror side)', () => {
  it('stores a fresh statement with exact cents and no queued responses', () => {
    const statement = buildMirroredStatement(payload([line(SHARE_A, 1250, 'pending')], -1250), null);
    expect(statement.peerActorId).toBe(OWNER);
    expect(statement.netCents).toBe(-1250);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0]!.amountCents).toBe(1250);
    expect(statement.pendingResponses).toEqual([]);
  });

  it('queues confirm/reject answers and updates the local line', () => {
    let statement = buildMirroredStatement(
      payload([line(SHARE_A, 1250, 'pending'), line(SHARE_B, 800, 'pending')], -2050),
      null,
    );
    statement = answerMirroredLine(statement, SHARE_A, 'confirmed');
    statement = answerMirroredLine(statement, SHARE_B, 'rejected');

    expect(statement.lines.find((l) => l.shareId === SHARE_A)!.confirmationStatus).toBe('confirmed');
    expect(statement.lines.find((l) => l.shareId === SHARE_B)!.confirmationStatus).toBe('rejected');
    expect(statement.pendingResponses).toEqual([
      { shareId: SHARE_A, status: 'confirmed' },
      { shareId: SHARE_B, status: 'rejected' },
    ]);
  });

  it('ignores answers to non-pending lines', () => {
    let statement = buildMirroredStatement(payload([line(SHARE_A, 1250, 'confirmed')], -1250), null);
    statement = answerMirroredLine(statement, SHARE_A, 'rejected');
    expect(statement.lines[0]!.confirmationStatus).toBe('confirmed');
    expect(statement.pendingResponses).toEqual([]);
  });

  it('replacing the statement preserves queued responses for surviving lines only', () => {
    let statement = buildMirroredStatement(
      payload([line(SHARE_A, 1250, 'pending'), line(SHARE_B, 800, 'pending')], -2050),
      null,
    );
    statement = answerMirroredLine(statement, SHARE_A, 'confirmed');
    statement = answerMirroredLine(statement, SHARE_B, 'rejected');

    // New statement from the same owner: SHARE_B is gone, SHARE_C is new.
    const refreshed = buildMirroredStatement(
      payload([line(SHARE_A, 1250, 'pending'), line(SHARE_C, 500, 'pending')], -1750),
      statement,
    );

    expect(refreshed.id).toBe(statement.id);
    expect(refreshed.pendingResponses).toEqual([{ shareId: SHARE_A, status: 'confirmed' }]);
    expect(refreshed.lines.map((l) => l.shareId)).toEqual([SHARE_A, SHARE_C]);
  });

  it('mirrors settlements and item places so the guest reconciles items + payments (DEC-402)', () => {
    const base = payload([line(SHARE_A, 7000, 'confirmed')], -5000);
    const incoming: StatementPayload = {
      ...base,
      lines: [{ ...base.lines[0]!, placeLabel: 'Cantina', latitude: 38.7, longitude: -9.1, placeId: null }],
      settlements: [
        { settlementId: SETTLE, kind: 'paid', amountCents: 2000, settledAt: '2026-06-10T10:00:00.000Z', note: null },
      ],
    };

    const statement = buildMirroredStatement(incoming, null);

    expect(statement.lines[0]!.placeLabel).toBe('Cantina');
    expect(statement.lines[0]!.latitude).toBe(38.7);
    expect(statement.settlements).toHaveLength(1);
    expect(statement.settlements![0]!.kind).toBe('paid');

    // RECONCILES: −7000 confirmed items + 2000 payment = −5000 = the headline net.
    const lineSum = statement.lines
      .filter((l) => l.confirmationStatus === 'confirmed')
      .reduce((sum, l) => sum + (l.kind === 'owes' ? -l.amountCents : l.amountCents), 0);
    const settleSum = statement.settlements!.reduce(
      (sum, s) => sum + (s.kind === 'paid' ? s.amountCents : -s.amountCents),
      0,
    );
    expect(lineSum + settleSum).toBe(statement.netCents);
  });

  it('reads back null settlements for an older payload without the field', () => {
    const statement = buildMirroredStatement(payload([line(SHARE_A, 1250, 'pending')], -1250), null);
    expect(statement.settlements).toBeNull();
  });

  it('clears only acked responses after a flush', () => {
    let statement = buildMirroredStatement(
      payload([line(SHARE_A, 1250, 'pending'), line(SHARE_B, 800, 'pending')], -2050),
      null,
    );
    statement = answerMirroredLine(statement, SHARE_A, 'confirmed');
    statement = answerMirroredLine(statement, SHARE_B, 'rejected');

    const flushed = clearSentResponses(statement, [SHARE_A]);
    expect(flushed.pendingResponses).toEqual([{ shareId: SHARE_B, status: 'rejected' }]);
  });
});
