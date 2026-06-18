import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { splitRepository } from '@/data/repositories';
import { createSplitSession } from '@/domain/split';
import type { SplitRecord } from '@/domain/types/split-record';
import type { SplitStatus } from '@/domain/split';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

function makeRecord(input: {
  id: string;
  tripId: string | null;
  sessionId: string | null;
  status: SplitStatus;
  createdAt?: string;
}): SplitRecord {
  const splitMeta = createSplitSession({
    tripId: input.tripId,
    phaseId: null,
    name: input.id,
    currency: 'BRL',
    ownerName: 'Eu',
  });
  return {
    ...meta,
    id: input.id,
    createdAt: input.createdAt ?? meta.createdAt,
    tripId: input.tripId,
    sessionId: input.sessionId,
    status: input.status,
    splitMeta: { ...splitMeta, id: input.id, tripId: input.tripId, status: input.status },
  };
}

describe('splitRepository', () => {
  beforeEach(async () => {
    await db.splitSessions.clear();
  });

  it('finds a committed division by its sessionId', async () => {
    await splitRepository.create(
      makeRecord({ id: 'r1', tripId: 'trip-1', sessionId: 'sess-1', status: 'committed' }),
    );
    const found = await splitRepository.getBySessionId('sess-1');
    expect(found?.id).toBe('r1');
    expect(await splitRepository.getBySessionId('missing')).toBeUndefined();
  });

  it('lists a trip\'s divisions newest first and excludes other trips', async () => {
    await splitRepository.create(
      makeRecord({ id: 'old', tripId: 'trip-1', sessionId: 's1', status: 'committed', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    await splitRepository.create(
      makeRecord({ id: 'new', tripId: 'trip-1', sessionId: 's2', status: 'committed', createdAt: '2026-02-01T00:00:00.000Z' }),
    );
    await splitRepository.create(
      makeRecord({ id: 'other', tripId: 'trip-2', sessionId: 's3', status: 'committed' }),
    );

    const list = await splitRepository.listByTrip('trip-1');
    expect(list.map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('lists only resumable drafts and live sessions', async () => {
    await splitRepository.create(makeRecord({ id: 'draft', tripId: 'trip-1', sessionId: null, status: 'draft' }));
    await splitRepository.create(makeRecord({ id: 'live', tripId: 'trip-1', sessionId: null, status: 'live' }));
    await splitRepository.create(makeRecord({ id: 'done', tripId: 'trip-1', sessionId: 's1', status: 'committed' }));

    const resumable = await splitRepository.listResumable();
    expect(resumable.map((r) => r.id).sort()).toEqual(['draft', 'live']);
  });

  it('hides soft-deleted records from queries', async () => {
    await splitRepository.create(makeRecord({ id: 'r1', tripId: 'trip-1', sessionId: 's1', status: 'committed' }));
    await splitRepository.delete('r1');
    expect(await splitRepository.getBySessionId('s1')).toBeUndefined();
    expect(await splitRepository.listByTrip('trip-1')).toHaveLength(0);
  });
});
