/**
 * DEC-127 (Bar Mode): keep the screen awake while the fullscreen outing
 * view is open. Progressive enhancement — browsers without the Wake Lock
 * API simply keep their normal screen-off behavior.
 */

let sentinel: WakeLockSentinel | null = null;

export async function acquireScreenWakeLock(): Promise<void> {
  try {
    if (!('wakeLock' in navigator)) return;
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    // Permission/visibility refusals are non-fatal: the screen just dims.
    sentinel = null;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    // Releasing an already-released sentinel throws on some browsers.
  }
  sentinel = null;
}
