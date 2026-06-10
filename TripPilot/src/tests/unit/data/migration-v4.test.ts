import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V3 } from '@/data/db/schema';
import { normalizeBackupToV4, BACKUP_VERSION } from '@/domain/backup';
import type { BackupData } from '@/domain/backup';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

describe('Dexie v4 migration (DEC-105/106)', () => {
  it('preserves v3 participants and defaults linkedActorId to null', async () => {
    const dbName = `MigrationV4-${Date.now()}`;
    const v3db = new Dexie(dbName);
    v3db.version(3).stores(SCHEMA_V3);
    await v3db.open();
    await v3db.table('participants').add({
      ...meta,
      id: 'p-1',
      tripId: 'trip-1',
      name: 'Debora',
      nickname: null,
      isOwner: false,
      email: null,
      linkedUserAccountId: null,
    });
    v3db.close();

    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      const participant = await db.participants.get('p-1');
      expect(participant).toBeDefined();
      expect(participant!.name).toBe('Debora');
      expect(participant!.linkedActorId).toBeNull();
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });

  it('creates peerLinks and mirroredStatements tables with their indexes', async () => {
    const dbName = `MigrationV4b-${Date.now()}`;
    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      await db.peerLinks.add({
        ...meta,
        id: 'link-1',
        actorId: 'actor-1',
        displayName: 'Debora',
        participantId: 'p-1',
        lastSyncAt: null,
      });
      await db.mirroredStatements.add({
        ...meta,
        id: 'mirror-1',
        peerActorId: 'actor-1',
        peerName: 'Julio',
        receivedAt: '2026-06-10T12:00:00.000Z',
        currency: 'EUR',
        netCents: -1500,
        lines: [],
        pendingResponses: [],
      });

      const link = await db.peerLinks.where('actorId').equals('actor-1').first();
      expect(link?.displayName).toBe('Debora');
      const mirror = await db.mirroredStatements.where('peerActorId').equals('actor-1').first();
      expect(mirror?.netCents).toBe(-1500);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });
});

describe('backup v3 → v4 import (normalizeBackupToV4)', () => {
  it('fills v4 defaults on a v3 file (missing tables and linkedActorId)', () => {
    const v3File = {
      version: 3,
      exportedAt: '2026-06-01T00:00:00.000Z',
      deviceId: 'dev-1',
      appSettings: { id: 'app-settings' },
      participants: [
        {
          ...meta,
          id: 'p-1',
          tripId: 'trip-1',
          name: 'Debora',
          nickname: null,
          isOwner: false,
          email: null,
          linkedUserAccountId: null,
        },
      ],
      participantShares: [],
      phases: [],
      plannedOccurrences: [],
      phaseProfileSettings: [],
    } as unknown as BackupData;

    const normalized = normalizeBackupToV4(v3File);
    expect(normalized.participants[0]!.linkedActorId).toBeNull();
    expect(normalized.peerLinks).toEqual([]);
    expect(normalized.mirroredStatements).toEqual([]);
    expect(BACKUP_VERSION).toBe(4);
  });
});
