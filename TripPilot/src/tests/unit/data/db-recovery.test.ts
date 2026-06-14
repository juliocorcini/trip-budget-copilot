import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isConnectionLostError,
  canHardReload,
  recordHardReload,
  clearHardReloadGuard,
  escalateToReload,
  openWithWatchdog,
  recoverConnection,
  DbOpenTimeoutError,
} from '@/data/db/db-recovery';
import { db } from '@/data/db/database';

// DEC-170: the IndexedDB resilience layer. These tests pin the behaviour that
// keeps a WebKit connection wedge from ever becoming a dead end: error
// classification, the bounded (non-looping) reload budget, and the open
// watchdog that turns an infinite hang into a fast, recoverable failure.

describe('isConnectionLostError', () => {
  it('matches the WebKit/Dexie connection-loss signatures by name', () => {
    for (const name of [
      'DatabaseClosedError',
      'UnknownError',
      'InvalidStateError',
      'AbortError',
      'DbOpenTimeoutError',
      'LoadTimeoutError',
    ]) {
      const err = new Error('boom');
      err.name = name;
      expect(isConnectionLostError(err)).toBe(true);
    }
  });

  it('matches by message when the name is generic', () => {
    expect(
      isConnectionLostError(new Error('UnknownError: Connection to Indexed Database server lost')),
    ).toBe(true);
    expect(isConnectionLostError(new Error('Dexie: Need to reopen db'))).toBe(true);
    expect(
      isConnectionLostError(new Error("Failed to execute 'transaction': the database connection is closing")),
    ).toBe(true);
  });

  it('does NOT flag ordinary logic errors as connection loss', () => {
    expect(isConnectionLostError(new TypeError('x is not a function'))).toBe(false);
    expect(isConnectionLostError(new Error('validation failed'))).toBe(false);
    expect(isConnectionLostError(null)).toBe(false);
    expect(isConnectionLostError(undefined)).toBe(false);
  });
});

describe('bounded reload budget (no-loop guarantee)', () => {
  beforeEach(() => clearHardReloadGuard());
  afterEach(() => {
    clearHardReloadGuard();
    vi.useRealTimers();
  });

  it('allows reloads until the cap, then refuses within the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));

    expect(canHardReload()).toBe(true);
    recordHardReload();
    recordHardReload();
    expect(canHardReload()).toBe(true); // 2 < cap (3)
    recordHardReload();
    expect(canHardReload()).toBe(false); // cap reached → no auto-loop
  });

  it('reopens the budget after the window elapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'));
    recordHardReload();
    recordHardReload();
    recordHardReload();
    expect(canHardReload()).toBe(false);

    // 91s later — outside the 90s window — old stamps no longer count.
    vi.setSystemTime(new Date('2026-06-14T12:01:31Z'));
    expect(canHardReload()).toBe(true);
  });

  it('clearHardReloadGuard resets the budget immediately', () => {
    recordHardReload();
    recordHardReload();
    recordHardReload();
    expect(canHardReload()).toBe(false);
    clearHardReloadGuard();
    expect(canHardReload()).toBe(true);
  });
});

describe('escalateToReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    clearHardReloadGuard();
    reloadSpy = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    clearHardReloadGuard();
  });

  it('reloads while budget remains and stops once it is spent (auto)', () => {
    expect(escalateToReload()).toBe(true);
    expect(escalateToReload()).toBe(true);
    expect(escalateToReload()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(3);
    // Budget spent → no further automatic reload (degrades to manual recovery).
    expect(escalateToReload()).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(3);
  });

  it('always allows a manual reload even when the auto budget is spent', () => {
    recordHardReload();
    recordHardReload();
    recordHardReload();
    expect(canHardReload()).toBe(false);
    expect(escalateToReload({ manual: true })).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

describe('openWithWatchdog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns immediately when the connection is already open', async () => {
    vi.spyOn(db, 'isOpen').mockReturnValue(true);
    const openSpy = vi.spyOn(db, 'open');
    await expect(openWithWatchdog(50)).resolves.toBeUndefined();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('rejects with DbOpenTimeoutError when the open hangs (WebKit wedge)', async () => {
    vi.spyOn(db, 'isOpen').mockReturnValue(false);
    // A hung open that never settles — the watchdog must fire.
    vi.spyOn(db, 'open').mockReturnValue(new Promise(() => {}) as ReturnType<typeof db.open>);
    await expect(openWithWatchdog(30)).rejects.toBeInstanceOf(DbOpenTimeoutError);
  });
});

describe('recoverConnection (real close + reopen cycle)', () => {
  it('closes the live handle and reopens it, leaving the DB usable', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
    const recovered = await recoverConnection();
    expect(recovered).toBe(true);
    expect(db.isOpen()).toBe(true);
    // The reopened connection actually serves reads.
    await expect(db.appSettings.count()).resolves.toBeTypeOf('number');
  });
});
