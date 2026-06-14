import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// DEC-170: useAppData no longer dead-ends on a transient IndexedDB blip — it
// runs the recovery ladder first (close+reopen, then a bounded reload) and only
// surfaces `error` once recovery is exhausted. Here we drive that orchestration
// with a controllable db-recovery layer; the real connection cycle + bounded
// reload budget are covered in db-recovery.test.ts.
vi.mock('@/data/db/db-recovery', () => ({
  openWithWatchdog: vi.fn(async () => {}),
  recoverConnection: vi.fn(async () => false),
  escalateToReload: vi.fn(() => false),
  clearHardReloadGuard: vi.fn(),
}));

import { useAppData } from '@/hooks/useAppData';
import { AppDataProvider } from '@/app/AppDataProvider';
import { appSettingsRepository } from '@/data/repositories';
import {
  openWithWatchdog,
  recoverConnection,
  escalateToReload,
  clearHardReloadGuard,
} from '@/data/db/db-recovery';

const mockRecover = vi.mocked(recoverConnection);
const mockEscalate = vi.mocked(escalateToReload);

beforeEach(() => {
  vi.mocked(openWithWatchdog).mockReset().mockResolvedValue(undefined);
  vi.mocked(clearHardReloadGuard).mockReset();
  mockRecover.mockReset().mockResolvedValue(false);
  mockEscalate.mockReset().mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAppData failure handling (DEC-109 / DEC-170)', () => {
  it('self-heals a transient DB blip — recovers without ever surfacing an error', async () => {
    const realGet = appSettingsRepository.get.bind(appSettingsRepository);
    let calls = 0;
    vi.spyOn(appSettingsRepository, 'get').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('UnknownError: Connection to Indexed Database server lost');
      return realGet();
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRecover.mockResolvedValue(true); // close+reopen succeeds

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(result.current.error).toBe(false);
    expect(result.current.settings).not.toBeNull();
    expect(mockRecover).toHaveBeenCalled();
  });

  it('surfaces error=true when recovery is exhausted — never a fake empty state', async () => {
    vi.spyOn(appSettingsRepository, 'get').mockRejectedValue(
      new Error('InvalidStateError: the database connection is closing'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRecover.mockResolvedValue(false); // reopen fails
    mockEscalate.mockReturnValue(false); // reload budget spent

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 });
    expect(result.current.error).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('recovers via manual retry once the DB responds again', async () => {
    const getSpy = vi
      .spyOn(appSettingsRepository, 'get')
      .mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });
    await waitFor(() => expect(result.current.error).toBe(true), { timeout: 3000 });

    // DB responds again and the reopen now succeeds.
    getSpy.mockRestore();
    mockRecover.mockResolvedValue(true);
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(false);
      expect(result.current.settings).not.toBeNull();
    });
  });

  // BUG-019: a persistently broken DB must not storm reloads every time the app
  // returns to the foreground. Rapid visibilitychange events inside the cooldown
  // window collapse into at most one extra attempt.
  it('throttles the foreground auto-retry when the DB stays broken', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    const getSpy = vi
      .spyOn(appSettingsRepository, 'get')
      .mockRejectedValue(new Error('still broken'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });

    await waitFor(() => expect(result.current.error).toBe(true), { timeout: 3000 });
    expect(getSpy).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }

    await waitFor(() => expect(result.current.loading).toBe(false));
    // 1 initial load + exactly 1 throttled retry (the other 2 are within cooldown).
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
