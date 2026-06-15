import { isNativeApp } from '@/utils/native/platform';

/**
 * N8 (Gate 1C): haptic feedback boundary. No-op when the user turns off
 * "Vibration" in Settings (mirrored here via `setHapticsEnabled`). Native uses
 * the Capacitor Haptics plugin (lazy-imported); the Web/PWA falls back to
 * `navigator.vibrate` (Android browsers support it). Curated triggers only —
 * the goal is a subtle tactile confirmation, never vibration fatigue.
 */

let enabled = true;

/** Kept in sync with `settings.vibrationEnabled` (RootLayout). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

type ImpactWeight = 'light' | 'medium' | 'heavy';
type NotifyKind = 'success' | 'warning' | 'error';

function webVibrate(pattern: number | number[]): void {
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
      const style =
        weight === 'light'
          ? ImpactStyle.Light
          : weight === 'heavy'
            ? ImpactStyle.Heavy
            : ImpactStyle.Medium;
      await Haptics.impact({ style });
    } catch {
      // plugin unavailable — silently skip.
    }
    return;
  }
  webVibrate(weight === 'light' ? 8 : weight === 'heavy' ? 22 : 14);
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
  webVibrate(kind === 'error' ? [18, 40, 18] : kind === 'warning' ? 18 : 12);
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
