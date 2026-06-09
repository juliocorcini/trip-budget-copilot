import type { EntityTable } from 'dexie';
import type { SyncMetadata } from '@/domain/types/common';
import { markUpdated, softDelete } from '@/utils/entity-factory';

/* eslint-disable @typescript-eslint/no-explicit-any */

export class BaseRepository<T extends SyncMetadata> {
  constructor(protected table: EntityTable<T, 'id'>) {}

  async getById(id: string): Promise<T | undefined> {
    const item = await this.table.get(id as any);
    return item && item.deletedAt === null ? item : undefined;
  }

  async getAll(): Promise<T[]> {
    return this.table.filter((item) => item.deletedAt === null).toArray();
  }

  async getAllIncludingDeleted(): Promise<T[]> {
    return this.table.toArray();
  }

  async getByIds(ids: string[]): Promise<T[]> {
    const items = await this.table.bulkGet(ids as any);
    return items.filter((item): item is T => item !== undefined && item.deletedAt === null);
  }

  async create(entity: T): Promise<T> {
    await this.table.add(entity);
    return entity;
  }

  async bulkCreate(entities: T[]): Promise<void> {
    await this.table.bulkAdd(entities);
  }

  async update(entity: T): Promise<T> {
    const updated = markUpdated(entity);
    await this.table.put(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const entity = await this.table.get(id as any);
    if (entity) {
      const deleted = softDelete(entity);
      await this.table.put(deleted);
    }
  }

  async hardDelete(id: string): Promise<void> {
    await this.table.delete(id as any);
  }

  async count(): Promise<number> {
    return this.table.filter((item) => item.deletedAt === null).count();
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }
}
