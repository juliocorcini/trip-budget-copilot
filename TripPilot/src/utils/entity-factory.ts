import { v4 as uuidv4 } from 'uuid';
import type { SyncMetadata } from '@/domain/types/common';
import { safeLocalStorage } from '@/utils/safe-storage';

const DEVICE_ID_KEY = 'trippilot_device_id';

// BUG-005: getDeviceId runs inside createSyncMetadata/markUpdated/softDelete,
// i.e. on EVERY create/update/delete. A throwing localStorage (iOS private
// mode / quota) must never break a save — safeLocalStorage falls back to a
// volatile in-memory id that still works for the whole session.
function getDeviceId(): string {
  let id = safeLocalStorage.get(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    safeLocalStorage.set(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * DEC-105: the per-install device id doubles as the actor identity for
 * QR pairing — stable, account-less, never leaves the device except
 * inside identity QR codes the user chooses to show.
 */
export function getInstallationId(): string {
  return getDeviceId();
}

/**
 * FIELD item 8: adopt a device id from a restored backup so the new phone keeps
 * the old phone's mailbox address and pairing (user choice "restaurar mantém o
 * pareamento"). Only used on a replace-import — never during normal operation.
 */
export function setInstallationId(id: string): void {
  safeLocalStorage.set(DEVICE_ID_KEY, id);
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

/** DEC-126: undo — soft deletes are reversible by clearing deletedAt. */
export function restoreDeleted<T extends SyncMetadata>(entity: T): T {
  return markUpdated({ ...entity, deletedAt: null });
}
