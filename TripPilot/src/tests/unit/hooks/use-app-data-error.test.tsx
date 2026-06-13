import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAppData } from '@/hooks/useAppData';
import { AppDataProvider } from '@/app/AppDataProvider';
import { appSettingsRepository } from '@/data/repositories';

afterEach(() => {
  vi.restoreAllMocks();
});

// BUG-007: useAppData now reads the shared context, so the hook is exercised
// through its Provider — which is exactly what every route mounts at runtime.
describe('useAppData failure handling (DEC-109 / R5-01)', () => {
  it('flags error=true when the DB read rejects — never a fake empty state', async () => {
    vi.spyOn(appSettingsRepository, 'get').mockRejectedValue(
      new Error('InvalidStateError: connection is closing'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('recovers via retry once the DB responds again', async () => {
    const getSpy = vi
      .spyOn(appSettingsRepository, 'get')
      .mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppData(), { wrapper: AppDataProvider });

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    getSpy.mockRestore();
    consoleSpy.mockRestore();
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

    await waitFor(() => expect(result.current.error).toBe(true));
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
