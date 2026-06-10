import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository } from '@/data/repositories';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAppData failure handling (DEC-109 / R5-01)', () => {
  it('flags error=true when the DB read rejects — never a fake empty state', async () => {
    vi.spyOn(appSettingsRepository, 'get').mockRejectedValue(
      new Error('InvalidStateError: connection is closing'),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAppData());

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

    const { result } = renderHook(() => useAppData());

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
});
