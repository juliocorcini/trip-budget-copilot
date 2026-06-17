import { describe, it, expect } from 'vitest';
import {
  buildShareResponseBatch,
  parseShareResponseBatch,
  mergeShareResponseBatches,
} from '@/domain/sync';
import type { ShareResponseBatch } from '@/domain/sync';

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHARE_A = '11111111-1111-4111-8111-111111111111';
const SHARE_B = '22222222-2222-4222-8222-222222222222';

describe('buildShareResponseBatch', () => {
  it('builds a v1 batch and trims the name to 60 chars', () => {
    const batch = buildShareResponseBatch({
      fromActorId: ACTOR,
      fromName: '  Cunhado  ',
      responses: [{ shareId: SHARE_A, status: 'confirmed' }],
      settle: null,
    });
    expect(batch.v).toBe(1);
    expect(batch.fromName).toBe('Cunhado');
    expect(batch.responses).toEqual([{ shareId: SHARE_A, status: 'confirmed' }]);
    expect(batch.settle).toBeNull();
    expect(typeof batch.at).toBe('string');
  });

  it('keeps a settle proposal', () => {
    const batch = buildShareResponseBatch({
      fromActorId: ACTOR,
      fromName: 'Cunhado',
      responses: [],
      settle: { amountCents: 4500, currency: 'BRL', note: 'pix enviado' },
    });
    expect(batch.settle).toEqual({ amountCents: 4500, currency: 'BRL', note: 'pix enviado' });
  });
});

describe('parseShareResponseBatch', () => {
  it('parses a valid batch', () => {
    const built = buildShareResponseBatch({
      fromActorId: ACTOR,
      fromName: 'Cunhado',
      responses: [{ shareId: SHARE_A, status: 'rejected' }],
      settle: null,
    });
    const parsed = parseShareResponseBatch(JSON.parse(JSON.stringify(built)));
    expect(parsed).not.toBeNull();
    expect(parsed!.responses[0]!.status).toBe('rejected');
  });

  it('rejects a malformed batch', () => {
    expect(parseShareResponseBatch({ v: 2 })).toBeNull();
    expect(parseShareResponseBatch({ v: 1, fromActorId: 'not-a-uuid' })).toBeNull();
    expect(parseShareResponseBatch(null)).toBeNull();
  });

  it('rejects a settle proposal with a non-positive amount', () => {
    const bad = {
      v: 1,
      fromActorId: ACTOR,
      fromName: 'x',
      responses: [],
      settle: { amountCents: 0, currency: 'BRL', note: null },
      at: new Date().toISOString(),
    };
    expect(parseShareResponseBatch(bad)).toBeNull();
  });
});

describe('mergeShareResponseBatches', () => {
  const mk = (
    at: string,
    responses: ShareResponseBatch['responses'],
    settle: ShareResponseBatch['settle'],
    name = 'Cunhado',
  ): ShareResponseBatch => ({
    v: 1,
    fromActorId: ACTOR,
    fromName: name,
    responses,
    settle,
    at,
  });

  it('lets the latest answer per line win regardless of input order', () => {
    const merged = mergeShareResponseBatches([
      mk('2026-06-16T10:00:00.000Z', [{ shareId: SHARE_A, status: 'rejected' }], null),
      mk('2026-06-16T09:00:00.000Z', [{ shareId: SHARE_A, status: 'confirmed' }], null),
    ]);
    const a = merged.responses.find((r) => r.shareId === SHARE_A);
    expect(a!.status).toBe('rejected'); // 10:00 supersedes 09:00
  });

  it('keeps distinct lines and the most recent settle proposal', () => {
    const merged = mergeShareResponseBatches([
      mk('2026-06-16T09:00:00.000Z', [{ shareId: SHARE_A, status: 'confirmed' }], {
        amountCents: 1000,
        currency: 'BRL',
        note: null,
      }),
      mk('2026-06-16T11:00:00.000Z', [{ shareId: SHARE_B, status: 'confirmed' }], {
        amountCents: 4500,
        currency: 'BRL',
        note: 'final',
      }),
    ]);
    expect(merged.responses).toHaveLength(2);
    expect(merged.settle).toEqual({ amountCents: 4500, currency: 'BRL', note: 'final' });
    expect(merged.fromName).toBe('Cunhado');
  });

  it('returns an empty result for no batches', () => {
    const merged = mergeShareResponseBatches([]);
    expect(merged.responses).toEqual([]);
    expect(merged.settle).toBeNull();
    expect(merged.fromName).toBeNull();
  });
});
