import { describe, it, expect } from 'vitest';
import {
  buildExpenseSharePayload,
  parseExpenseSharePayload,
  EXPENSE_SHARE_MAX_IMAGES,
} from '@/domain/sync';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-457 — the `/x/` shared-expense payload. Two hard guarantees:
 * (1) the payload is a faithful, bounded snapshot of the EXPENSE the guest can
 *     render; (2) the owner's internal finances (funds, wallets, budgets,
 *     shares) structurally cannot enter it — the builder has no such fields.
 */

function fixtureTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'e1a4b216-0aeb-4a7f-84ce-44f5906fbb0f',
    createdAt: '2026-07-03T20:00:00.000Z',
    updatedAt: '2026-07-03T20:00:00.000Z',
    deletedAt: null,
    revision: 1,
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: 'wallet-1',
    sessionId: null,
    type: 'expense',
    amountCents: 2350,
    personalCostCents: 2350,
    currency: 'EUR',
    baseCurrencyAmountCents: 2350,
    exchangeRate: null,
    category: 'restaurant',
    subcategoryId: null,
    placeLabel: 'Casa Ojeda',
    latitude: 42.34,
    longitude: -3.7,
    placeId: null,
    description: 'Jantar em Burgos',
    date: '2026-07-03T21:30:00+02:00',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: 'Menu do dia',
    ...overrides,
  } as Transaction;
}

const IMAGES = [
  { r2Id: '550e8400-e29b-41d4-a716-446655440000', mime: 'image/jpeg', w: 800, h: 600 },
];

describe('buildExpenseSharePayload', () => {
  it('snapshots the expense fields the guest renders — and round-trips the parser', () => {
    const payload = buildExpenseSharePayload({
      ownerName: 'Julio',
      transaction: fixtureTx(),
      images: IMAGES,
      now: new Date('2026-07-03T22:00:00Z'),
    });
    expect(payload).toEqual({
      v: 1,
      kind: 'expense',
      ownerName: 'Julio',
      description: 'Jantar em Burgos',
      category: 'restaurant',
      amountCents: 2350,
      currency: 'EUR',
      date: '2026-07-03T21:30:00+02:00',
      placeLabel: 'Casa Ojeda',
      latitude: 42.34,
      longitude: -3.7,
      notes: 'Menu do dia',
      images: IMAGES,
      generatedAt: '2026-07-03T22:00:00.000Z',
    });
    expect(parseExpenseSharePayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('NEVER carries internal finance fields (fund/wallet/budget/shares)', () => {
    const payload = buildExpenseSharePayload({
      ownerName: 'Julio',
      transaction: fixtureTx(),
      images: [],
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('pool');
    expect(serialized).not.toContain('wallet');
    expect(serialized).not.toContain('budget');
    expect(serialized).not.toContain('phase');
    expect(serialized).not.toContain('participant');
  });

  it('clamps text fields and caps images at the max', () => {
    const payload = buildExpenseSharePayload({
      ownerName: 'x'.repeat(100),
      transaction: fixtureTx({
        description: 'd'.repeat(300),
        notes: 'n'.repeat(900),
        placeLabel: 'p'.repeat(200),
      }),
      images: Array.from({ length: 8 }, (_, i) => ({
        r2Id: `550e8400-e29b-41d4-a716-44665544000${i}`,
        mime: 'image/jpeg',
        w: 10,
        h: 10,
      })),
    });
    expect(payload.ownerName.length).toBe(60);
    expect(payload.description.length).toBe(200);
    expect(payload.notes!.length).toBe(500);
    expect(payload.placeLabel!.length).toBe(120);
    expect(payload.images.length).toBe(EXPENSE_SHARE_MAX_IMAGES);
    expect(parseExpenseSharePayload(payload)).toEqual(payload);
  });

  it('handles a bare expense (no place, no notes, no photos, blank owner name)', () => {
    const payload = buildExpenseSharePayload({
      ownerName: '  ',
      transaction: fixtureTx({ placeLabel: null, latitude: null, longitude: null, notes: null }),
      images: [],
    });
    expect(payload.ownerName).toBe('TripPilot');
    expect(payload.placeLabel).toBeNull();
    expect(payload.notes).toBeNull();
    expect(payload.images).toEqual([]);
    expect(parseExpenseSharePayload(payload)).toEqual(payload);
  });
});

describe('parseExpenseSharePayload', () => {
  it('rejects malformed blobs instead of throwing', () => {
    expect(parseExpenseSharePayload(null)).toBeNull();
    expect(parseExpenseSharePayload('x')).toBeNull();
    expect(parseExpenseSharePayload({ v: 2, kind: 'expense' })).toBeNull();
    expect(parseExpenseSharePayload({ v: 1, kind: 'statement' })).toBeNull();
    const good = buildExpenseSharePayload({
      ownerName: 'Julio',
      transaction: fixtureTx(),
      images: [],
    });
    expect(parseExpenseSharePayload({ ...good, amountCents: 1.5 })).toBeNull();
    expect(parseExpenseSharePayload({ ...good, images: [{ r2Id: 'short' }] })).toBeNull();
  });
});
