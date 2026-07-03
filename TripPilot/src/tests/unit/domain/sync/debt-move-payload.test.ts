import { describe, it, expect } from 'vitest';
import {
  buildDebtMovePayload,
  parseDebtMovePayload,
  debtMoveTotalCents,
  externalRefForDebtMoveItem,
  debtMoveRefPrefix,
} from '@/domain/sync/debt-move-payload';

/**
 * DEC-451 (D07) — the `debt_move` mailbox payload. Unlike `debt` (accept-first),
 * a move is applied IMMEDIATELY on the recipient's drain, so the payload itself
 * must carry everything both devices show: provenance names, per-item amounts,
 * and the apply/revert correlation id.
 */
const MOVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const baseInput = {
  moveId: MOVE_ID,
  direction: 'apply' as const,
  role: 'recipient' as const,
  fromPersonName: 'Débora',
  toPersonName: 'Bruno',
  movedByName: 'Julio',
  currency: 'EUR',
  items: [
    { moveItemId: 'share-1', amountCents: 1200, description: 'Jantar', occurredAt: '2026-07-01T00:00:00.000Z' },
    { moveItemId: 'share-2', amountCents: 800, description: 'Uber', occurredAt: null },
  ],
};

describe('buildDebtMovePayload / parseDebtMovePayload — roundtrip', () => {
  it('survives a build → parse roundtrip intact', () => {
    const payload = buildDebtMovePayload(baseInput);
    const parsed = parseDebtMovePayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed!.moveId).toBe(MOVE_ID);
    expect(parsed!.direction).toBe('apply');
    expect(parsed!.role).toBe('recipient');
    expect(parsed!.fromPersonName).toBe('Débora');
    expect(parsed!.toPersonName).toBe('Bruno');
    expect(parsed!.movedByName).toBe('Julio');
    expect(parsed!.items).toHaveLength(2);
    expect(parsed!.items[0]!.amountCents).toBe(1200);
  });

  it('clamps names to 60 chars and descriptions to 120 (never rejects long human text)', () => {
    const payload = buildDebtMovePayload({
      ...baseInput,
      fromPersonName: 'D'.repeat(200),
      items: [{ moveItemId: 's', amountCents: 100, description: 'x'.repeat(500), occurredAt: null }],
    });
    expect(payload.fromPersonName).toHaveLength(60);
    expect(payload.items[0]!.description).toHaveLength(120);
    expect(parseDebtMovePayload(payload)).not.toBeNull();
  });

  it('an empty description falls back instead of producing an invalid payload', () => {
    const payload = buildDebtMovePayload({
      ...baseInput,
      items: [{ moveItemId: 's', amountCents: 100, description: '   ', occurredAt: null }],
    });
    expect(payload.items[0]!.description).toBe('—');
    expect(parseDebtMovePayload(payload)).not.toBeNull();
  });

  it('rejects tampered payloads: bad direction/role, zero/negative/fraction cents, no items', () => {
    const good = buildDebtMovePayload(baseInput);
    expect(parseDebtMovePayload({ ...good, direction: 'sideways' })).toBeNull();
    expect(parseDebtMovePayload({ ...good, role: 'owner' })).toBeNull();
    expect(parseDebtMovePayload({ ...good, items: [] })).toBeNull();
    expect(
      parseDebtMovePayload({ ...good, items: [{ ...good.items[0]!, amountCents: 0 }] }),
    ).toBeNull();
    expect(
      parseDebtMovePayload({ ...good, items: [{ ...good.items[0]!, amountCents: -500 }] }),
    ).toBeNull();
    expect(
      parseDebtMovePayload({ ...good, items: [{ ...good.items[0]!, amountCents: 12.5 }] }),
    ).toBeNull();
    expect(parseDebtMovePayload({ ...good, moveId: 'not-a-uuid' })).toBeNull();
    expect(parseDebtMovePayload(null)).toBeNull();
  });

  it('the drain annotations (appliedAt/revertedAt) survive a re-parse — the card state persists', () => {
    const applied = { ...buildDebtMovePayload(baseInput), appliedAt: '2026-07-03T12:00:00.000Z' };
    const parsed = parseDebtMovePayload(applied);
    expect(parsed!.appliedAt).toBe('2026-07-03T12:00:00.000Z');
    const reverted = { ...buildDebtMovePayload(baseInput), revertedAt: '2026-07-03T13:00:00.000Z' };
    expect(parseDebtMovePayload(reverted)!.revertedAt).toBe('2026-07-03T13:00:00.000Z');
  });
});

describe('debtMoveTotalCents — the card headline number', () => {
  it('sums the items in integer cents', () => {
    expect(debtMoveTotalCents(buildDebtMovePayload(baseInput))).toBe(2000);
  });
});

describe('externalRef — cross-device idempotency keys', () => {
  it('one ref per item, all sharing the move prefix (so a revert can find every fold)', () => {
    const ref1 = externalRefForDebtMoveItem('actor-1', MOVE_ID, 'share-1');
    const ref2 = externalRefForDebtMoveItem('actor-1', MOVE_ID, 'share-2');
    const prefix = debtMoveRefPrefix('actor-1', MOVE_ID);
    expect(ref1).toBe(`debt_move:actor-1:${MOVE_ID}:share-1`);
    expect(ref1.startsWith(prefix)).toBe(true);
    expect(ref2.startsWith(prefix)).toBe(true);
    expect(ref1).not.toBe(ref2);
    // A different move never collides with this one's prefix.
    expect(
      externalRefForDebtMoveItem('actor-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'share-1').startsWith(prefix),
    ).toBe(false);
  });
});
