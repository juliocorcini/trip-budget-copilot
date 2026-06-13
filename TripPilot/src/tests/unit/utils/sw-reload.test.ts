import { describe, it, expect, beforeEach } from 'vitest';
import {
  setActiveOuting,
  isActiveOuting,
  shouldReloadOnUpdate,
  isReloadPending,
  takePendingReload,
  resetSwReloadState,
} from '@/utils/sw-reload';

beforeEach(() => {
  resetSwReloadState();
});

describe('SW reload deferral during an active outing (BUG-011)', () => {
  it('reloads immediately when no outing is active', () => {
    expect(isActiveOuting()).toBe(false);
    expect(shouldReloadOnUpdate()).toBe(true);
    // Nothing is queued — an immediate reload leaves no pending work.
    expect(isReloadPending()).toBe(false);
    expect(takePendingReload()).toBe(false);
  });

  it('defers the reload while an outing is active and queues it', () => {
    setActiveOuting(true);
    expect(shouldReloadOnUpdate()).toBe(false);
    expect(isReloadPending()).toBe(true);
  });

  it('applies the deferred reload exactly once when the outing ends', () => {
    setActiveOuting(true);
    shouldReloadOnUpdate();
    expect(isReloadPending()).toBe(true);

    // Outing ends → the page consumes the pending reload a single time.
    setActiveOuting(false);
    expect(takePendingReload()).toBe(true);
    expect(takePendingReload()).toBe(false);
    expect(isReloadPending()).toBe(false);
  });

  it('does not queue a reload when the outing ends without an update', () => {
    setActiveOuting(true);
    setActiveOuting(false);
    expect(takePendingReload()).toBe(false);
  });

  it('reloads normally again after a deferred cycle completes', () => {
    setActiveOuting(true);
    shouldReloadOnUpdate();
    setActiveOuting(false);
    takePendingReload();

    // A later update with no active outing reloads straight away.
    expect(shouldReloadOnUpdate()).toBe(true);
  });
});
