import { isNativeApp } from '@/utils/native/platform';

/**
 * N8 (Gate 1C): haptic feedback boundary. No-op when the user turns off
 * "Vibration" in Settings (mirrored here via `setHapticsEnabled`). Native uses
 * the Capacitor Haptics plugin (lazy-imported); the Web/PWA falls back to
 * `navigator.vibrate` (Android browsers support it). Curated triggers only —
 * the goal is a subtle tactile confirmation, never vibration fatigue.
 */

let enabled = true;

// Chromium blocks `navigator.vibrate` until the page has seen a user gesture and
// logs a console error every time it's called before then (the call can't be
// caught — the engine refuses it, it doesn't throw). On web we therefore gate
// the vibrate path on the first real gesture so a haptic fired during boot
// (auto-restore toast, mount animations) is a clean no-op instead of console
// noise + a silently-dropped call. Native uses the Capacitor plugin, which has
// no such restriction, so this flag never touches the native path.
let userHasGestured = false;

/** Flip the web-vibrate gate on. Called by the first-gesture listener below and
 *  exposed for tests. */
export function markUserGesture(): void {
  userHasGestured = true;
}

if (typeof window !== 'undefined') {
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
  const onFirstGesture = () => {
    markUserGesture();
    events.forEach((evt) => window.removeEventListener(evt, onFirstGesture, true));
  };
  events.forEach((evt) =>
    window.addEventListener(evt, onFirstGesture, { capture: true, passive: true }),
  );
}

/** Kept in sync with `settings.vibrationEnabled` (RootLayout). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

type ImpactWeight = 'light' | 'medium' | 'heavy';
type NotifyKind = 'success' | 'warning' | 'error';

function webVibrate(pattern: number | number[]): void {
  // Before the first gesture the call would be blocked + logged by the engine.
  if (!userHasGestured) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // some engines throw without a user gesture — ignore.
    }
  }
}

async function impact(weight: ImpactWeight): Promise<void> {
  if (!enabled) return;
  if (isNativeApp()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      // N8 tuning: medium/heavy taps felt too strong on real devices, so every
      // tier is softened one step — Light is the OS's curated discrete tick;
      // only the rare "heavy" trigger keeps a slightly firmer Medium.
      const style = weight === 'heavy' ? ImpactStyle.Medium : ImpactStyle.Light;
      await Haptics.impact({ style });
    } catch {
      // plugin unavailable — silently skip.
    }
    return;
  }
  webVibrate(weight === 'heavy' ? 12 : weight === 'medium' ? 7 : 5);
}

async function notify(kind: NotifyKind): Promise<void> {
  if (!enabled) return;
  if (isNativeApp()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      const type =
        kind === 'success'
          ? NotificationType.Success
          : kind === 'warning'
            ? NotificationType.Warning
            : NotificationType.Error;
      await Haptics.notification({ type });
    } catch {
      // plugin unavailable — silently skip.
    }
    return;
  }
  webVibrate(kind === 'error' ? [12, 30, 12] : kind === 'warning' ? 12 : 8);
}

/** Light tap — tab switch, list selection, toggles, picking an action. */
export function hapticSelection(): void {
  void impact('light');
}

/** Medium tap — opening a menu/sheet, long-press confirmation, the FAB. */
export function hapticImpact(): void {
  void impact('medium');
}

export function hapticSuccess(): void {
  void notify('success');
}

export function hapticWarning(): void {
  void notify('warning');
}

export function hapticError(): void {
  void notify('error');
}
