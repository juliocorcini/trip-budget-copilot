import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeLocalStorage } from '@/utils/safe-storage';
import { createSyncMetadata } from '@/utils/entity-factory';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeLocalStorage (BUG-005/018)', () => {
  it('never throws when getItem throws — falls back to the in-memory value', () => {
    safeLocalStorage.set('k1', 'persisted');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(() => safeLocalStorage.get('k1')).not.toThrow();
    expect(safeLocalStorage.get('k1')).toBe('persisted');
  });

  it('never throws when setItem throws (QuotaExceededError) — keeps value in memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => safeLocalStorage.set('k2', 'v2')).not.toThrow();
    // The in-memory fallback still serves the value within the session.
    expect(safeLocalStorage.get('k2')).toBe('v2');
  });
});

describe('getDeviceId resilience (BUG-005)', () => {
  it('createSyncMetadata still produces a device id when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    let meta: ReturnType<typeof createSyncMetadata> | undefined;
    expect(() => {
      meta = createSyncMetadata();
    }).not.toThrow();
    expect(meta?.sourceDeviceId).toBeTruthy();
  });
});
