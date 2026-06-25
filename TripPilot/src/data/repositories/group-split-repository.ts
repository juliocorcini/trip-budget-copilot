import { db } from '@/data/db/database';
import type { GroupSplitRecord } from '@/domain/types/group-split-record';
import type { GroupSplitEvent } from '@/domain/group-split/types';
import { createSyncMetadata } from '@/utils/entity-factory';
import { BaseRepository } from './base-repository';

/**
 * C23 / DEC-297 — persistence for Tricount group splits. The record id mirrors
 * the embedded event id so reverse lookups are trivial; `tripId`/`status` are
 * indexed projections kept in step on every save.
 */
class GroupSplitRepository extends BaseRepository<GroupSplitRecord> {
  constructor() {
    super(db.groupSplitEvents);
  }

  /** Persist a brand-new event as a record (id === event.id). */
  async createFromEvent(event: GroupSplitEvent): Promise<GroupSplitRecord> {
    const record: GroupSplitRecord = {
      ...createSyncMetadata({ id: event.id }),
      tripId: event.tripId,
      status: event.status,
      event,
    };
    return this.create(record);
  }

  /** Replace the embedded event, refreshing the indexed projections. */
  async saveEvent(event: GroupSplitEvent): Promise<GroupSplitRecord | undefined> {
    const existing = await this.getById(event.id);
    if (!existing) return undefined;
    return this.update({ ...existing, tripId: event.tripId, status: event.status, event });
  }

  /** All group splits (optionally trip-scoped), newest first. */
  async listEvents(tripId?: string | null): Promise<GroupSplitRecord[]> {
    const rows = await this.getAll();
    const scoped = tripId === undefined ? rows : rows.filter((r) => r.tripId === tripId);
    return scoped.sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt));
  }

  async getEvent(id: string): Promise<GroupSplitEvent | undefined> {
    const record = await this.getById(id);
    return record?.event;
  }
}

export const groupSplitRepository = new GroupSplitRepository();
