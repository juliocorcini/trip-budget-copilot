import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V11 } from '@/data/db/schema';
import { createGroupSplitEvent, createGroupParticipant, addParticipant, addExpense, buildGroupExpense } from '@/domain/group-split';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

const v11Split = (id: string) => ({
  ...meta,
  id,
  tripId: 'trip-1',
  sessionId: null,
  status: 'live' as const,
  splitMeta: {
    id,
    tripId: 'trip-1',
    phaseId: null,
    name: 'Jantar',
    currency: 'BRL',
    status: 'live' as const,
    mode: 'itemized' as const,
    serviceCharge: { mode: 'none' as const, source: 'manual' as const, amountCents: 0, percent: null },
    adjustments: [],
    items: [],
    participants: [],
    readTotalCents: null,
    createdAt: meta.createdAt,
  },
});

describe('Dexie v12 migration (C23 — Tricount group split / groupSplitEvents)', () => {
  it('adds the empty groupSplitEvents table without touching existing data', async () => {
    const dbName = `MigrationV12-${Date.now()}`;
    const v11db = new Dexie(dbName);
    v11db.version(11).stores(SCHEMA_V11);
    await v11db.open();
    await v11db.table('splitSessions').bulkAdd([v11Split('split-a'), v11Split('split-b')]);
    v11db.close();

    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      // Brand-new table exists and is empty after the additive upgrade.
      expect(await db.groupSplitEvents.count()).toBe(0);
      // The prior table is byte-preserved.
      expect(await db.splitSessions.count()).toBe(2);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });

  it('persists and round-trips a GroupSplitRecord (indexed projections queryable)', async () => {
    const dbName = `MigrationV12-rt-${Date.now()}`;
    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      let event = createGroupSplitEvent({ name: 'Viagem Bariloche', currency: 'BRL', ownerName: 'Ana', tripId: 'trip-9' });
      const bruno = createGroupParticipant({ name: 'Bruno' });
      event = addParticipant(event, bruno);
      event = addExpense(
        event,
        buildGroupExpense({
          description: 'Churrasco',
          amountCents: 9000,
          paidByParticipantId: event.ownerParticipantId,
          splitMode: 'equal',
          participantIds: [event.ownerParticipantId, bruno.id],
        }),
      );

      await db.groupSplitEvents.add({ ...meta, id: event.id, tripId: event.tripId, status: event.status, event });

      const byStatus = await db.groupSplitEvents.where('status').equals('open').toArray();
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0]!.event.expenses[0]!.description).toBe('Churrasco');

      const byTrip = await db.groupSplitEvents.where('tripId').equals('trip-9').toArray();
      expect(byTrip).toHaveLength(1);
      expect(byTrip[0]!.event.participants).toHaveLength(2);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });
});
