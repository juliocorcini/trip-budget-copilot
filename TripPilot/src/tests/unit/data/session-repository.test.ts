import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { sessionRepository } from '@/data/repositories/session-repository';
import { createSession, endSession } from '@/domain/outing';
import { softDelete } from '@/utils/entity-factory';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

function mkSession(name: string) {
  return createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: null,
    name,
    limits: { targetCents: 3000, ceilingCents: 4000, maxCents: 5000, avgDrinkPriceCents: null },
    quickAddValuesCents: [500],
  });
}

describe('sessionRepository.getCompleted (DEC-079 — FIELD-09)', () => {
  beforeEach(clearAll);

  it('returns only completed sessions, newest first', async () => {
    const older = { ...endSession(mkSession('Bar de tapas')), endedAt: '2026-06-10T23:05:00.000Z' };
    const newer = { ...endSession(mkSession('Parral')), endedAt: '2026-06-12T23:12:00.000Z' };
    const active = mkSession('Ainda rolando');
    await db.sessions.bulkAdd([older, newer, active]);

    const completed = await sessionRepository.getCompleted('trip-1');

    expect(completed.map((s) => s.name)).toEqual(['Parral', 'Bar de tapas']);
  });

  it('excludes soft-deleted sessions and other trips', async () => {
    const deleted = softDelete({
      ...endSession(mkSession('Apagada')),
      endedAt: '2026-06-11T22:00:00.000Z',
    });
    const otherTrip = {
      ...endSession({ ...mkSession('Outra viagem'), tripId: 'trip-2' }),
      endedAt: '2026-06-11T22:00:00.000Z',
    };
    await db.sessions.bulkAdd([deleted, otherTrip]);

    const completed = await sessionRepository.getCompleted('trip-1');

    expect(completed).toHaveLength(0);
  });
});
