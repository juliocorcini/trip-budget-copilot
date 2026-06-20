import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// haptics.ts gates the web `navigator.vibrate` path on the FIRST user gesture so
// a haptic fired during boot (auto-restore toast, mount animations) is a clean
// no-op instead of the Chromium "blocked before gesture" console error + a
// silently-dropped call. Native (Capacitor plugin) is unaffected — these tests
// run on the web path (Capacitor.isNativePlatform() === false in jsdom).
describe('haptics — web vibrate gated on the first user gesture', () => {
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
  const setVibrate = (fn: unknown) =>
    Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true });

  beforeEach(() => {
    // Fresh module so the `userHasGestured` flag starts false each time.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
    else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'vibrate');
  });

  it('does NOT call navigator.vibrate before any user gesture', async () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const { hapticSelection } = await import('@/utils/haptics');
    hapticSelection();
    await Promise.resolve();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('calls navigator.vibrate once a user gesture is marked', async () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const { hapticSelection, markUserGesture } = await import('@/utils/haptics');
    markUserGesture();
    hapticSelection();
    await Promise.resolve();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(5); // 'light' weight
  });

  it('stays silent when haptics are disabled, even after a gesture', async () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const { hapticSelection, markUserGesture, setHapticsEnabled } = await import('@/utils/haptics');
    markUserGesture();
    setHapticsEnabled(false);
    hapticSelection();
    await Promise.resolve();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
