import { isNativeApp } from './platform';

/**
 * B1 (Onda 4 / DEC-215): receive a `.csv` shared/opened from another app
 * (Wise, Files…) in the native shell and hand the raw text to the web layer.
 *
 * The CSV is kept in a tiny in-memory buffer (NOT the URL — a statement is far
 * too large for a query string, per the plan). The native `ShareTarget` plugin
 * delivers it; `RootLayout` registers a nav handler that routes the user to the
 * Wise import preview, and `WiseImportPage` drains it through the exact same
 * pure `parseWiseCsv` path as a manual upload.
 *
 * Anti-regression: the PWA Web Share Target (DEC-161, `/quick-add`) is a
 * separate browser mechanism and is untouched — every entry point here is
 * guarded by `isNativeApp()`.
 */

let pendingCsv: string | null = null;
let navHandler: (() => void) | null = null;

/** True while a shared CSV is waiting to be consumed. */
export function hasPendingSharedCsv(): boolean {
  return pendingCsv !== null;
}

/** Returns the buffered CSV exactly once, then clears it. */
export function takePendingSharedCsv(): string | null {
  const csv = pendingCsv;
  pendingCsv = null;
  return csv;
}

/**
 * Registers the callback that brings the user to the import preview when a CSV
 * arrives (set by RootLayout, cleared on unmount). Passing `null` detaches it.
 */
export function setSharedCsvNavHandler(handler: (() => void) | null): void {
  navHandler = handler;
}

/**
 * Boundary entry called by the native plugin event (and unit tests): buffers a
 * delivered CSV and, if the UI is listening, asks it to navigate. Empty/blank
 * payloads are ignored.
 */
export function deliverSharedCsv(csv: string | null | undefined): void {
  if (!csv || csv.trim().length === 0) return;
  pendingCsv = csv;
  navHandler?.();
}

interface ShareTargetPlugin {
  getPending(): Promise<{ csv: string | null }>;
  addListener(
    event: 'csvShared',
    handler: (data: { csv: string }) => void,
  ): Promise<{ remove: () => void }>;
}

/**
 * Boot-time setup (native only): subscribes to live shares and drains any CSV
 * the app was cold-started with. No-op on the web.
 */
export async function initShareTarget(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const plugin = registerPlugin<ShareTargetPlugin>('ShareTarget');
    // Awaited inside the try so that an older shell WITHOUT the native plugin
    // (e.g. an OTA bundle reaching the 0.56.0 APK) rejects here and is swallowed
    // instead of surfacing an unhandled rejection.
    await plugin.addListener('csvShared', (data) => deliverSharedCsv(data?.csv));
    const pending = await plugin.getPending();
    deliverSharedCsv(pending?.csv);
  } catch {
    // best-effort; the web/PWA path never reaches here (isNativeApp guard).
  }
}
