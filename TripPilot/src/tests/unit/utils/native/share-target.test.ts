import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deliverSharedCsv,
  hasPendingSharedCsv,
  setSharedCsvNavHandler,
  takePendingSharedCsv,
} from '@/utils/native/share-target';

// B1 (Onda 4 / DEC-215): boundary test for the in-memory shared-CSV store
// (event -> buffer -> drain). The native plugin + intent reading are validated
// on device (the gate AC); here we prove the JS contract the UI relies on.
afterEach(() => {
  setSharedCsvNavHandler(null);
  takePendingSharedCsv();
});

describe('share-target in-memory CSV store (B1)', () => {
  it('buffers a delivered CSV and notifies the nav handler', () => {
    const navigate = vi.fn();
    setSharedCsvNavHandler(navigate);
    expect(hasPendingSharedCsv()).toBe(false);
    deliverSharedCsv('Date,Amount\n2026-01-01,-12.50');
    expect(hasPendingSharedCsv()).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('returns the CSV exactly once, then clears it', () => {
    deliverSharedCsv('hello,world');
    expect(takePendingSharedCsv()).toBe('hello,world');
    expect(takePendingSharedCsv()).toBeNull();
    expect(hasPendingSharedCsv()).toBe(false);
  });

  it('ignores an empty or blank delivery (no nav, nothing buffered)', () => {
    const navigate = vi.fn();
    setSharedCsvNavHandler(navigate);
    deliverSharedCsv('   ');
    deliverSharedCsv('');
    deliverSharedCsv(null);
    deliverSharedCsv(undefined);
    expect(navigate).not.toHaveBeenCalled();
    expect(hasPendingSharedCsv()).toBe(false);
  });

  it('buffers a cold-start delivery even with no handler attached yet', () => {
    deliverSharedCsv('a,b,c');
    expect(hasPendingSharedCsv()).toBe(true);
    expect(takePendingSharedCsv()).toBe('a,b,c');
  });
});
