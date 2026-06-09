import { v4 as uuidv4 } from 'uuid';
import type { SyncMetadata } from '@/domain/types/common';

const DEVICE_ID_KEY = 'trippilot_device_id';

function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return uuidv4();
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function createSyncMetadata(overrides?: Partial<SyncMetadata>): SyncMetadata {
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? uuidv4(),
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    deletedAt: overrides?.deletedAt ?? null,
    revision: overrides?.revision ?? 1,
    sourceDeviceId: overrides?.sourceDeviceId ?? getDeviceId(),
  };
}

export function markUpdated<T extends SyncMetadata>(entity: T): T {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
    revision: entity.revision + 1,
    sourceDeviceId: getDeviceId(),
  };
}

export function softDelete<T extends SyncMetadata>(entity: T): T {
  return {
    ...entity,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: entity.revision + 1,
    sourceDeviceId: getDeviceId(),
  };
}
