import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * DEC-459 — adapter for the custom `HomeWidget` Capacitor plugin ("Livre hoje"
 * home-screen widget). The WEB side owns all math and formatting: it pushes the
 * already-formatted daily-free string (the Home hero value) plus localized
 * labels; native only stores and re-renders. No-op on the web/PWA.
 *
 * The domain stays pure — only the dashboard page (an infra boundary, where the
 * hero value already exists) calls this.
 */
interface HomeWidgetPlugin {
  update(options: { value: string; label: string; addHint: string }): Promise<void>;
  /** DEC-468 — full widget-suite payload (single JSON for all 7 widgets). */
  push(options: { data: string }): Promise<void>;
}

const HomeWidget = registerPlugin<HomeWidgetPlugin>('HomeWidget');

let lastPushed: string | null = null;
let lastPayloadPushed: string | null = null;

export interface HomeWidgetState {
  /** Formatted daily free amount, e.g. "€ 23,50" — the Home hero string. */
  value: string;
  /** Localized "Livre hoje" label. */
  label: string;
  /** Localized "+" hint for the quick-add pill (kept short). */
  addHint: string;
}

/**
 * Push the latest "Livre hoje" state to the widget. Deduped per session so a
 * dashboard re-render never spams the bridge; best-effort — the widget shows
 * the last successful push, and failures must never disturb the app.
 */
export async function updateHomeWidget(state: HomeWidgetState): Promise<void> {
  if (!isNativeApp()) return;
  const signature = `${state.value}|${state.label}|${state.addHint}`;
  if (signature === lastPushed) return;
  try {
    await HomeWidget.update(state);
    lastPushed = signature;
  } catch {
    // Older APKs without the plugin (pre-0.71.0) land here; silently skip.
  }
}

/**
 * DEC-468 — push the whole widget-suite payload (already-built JSON string of
 * `WidgetPayload`). Deduped per session; best-effort: a pre-0.72.0 APK has no
 * `push` method and lands in the catch (the legacy `update` call above keeps
 * its "Livre hoje" widget alive).
 */
export async function pushWidgetData(payloadJson: string): Promise<void> {
  if (!isNativeApp()) return;
  if (payloadJson === lastPayloadPushed) return;
  try {
    await HomeWidget.push({ data: payloadJson });
    lastPayloadPushed = payloadJson;
  } catch {
    // Older APKs without the method; silently skip.
  }
}
