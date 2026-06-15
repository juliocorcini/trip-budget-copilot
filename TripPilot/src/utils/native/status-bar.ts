import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp } from './platform';

// Mirrors the theme background tokens (tokens.css). The status bar paints with
// the active theme color so the top of the app looks integrated (DEC-192).
const STATUS_BAR_BG: Record<'dark' | 'light', string> = {
  dark: '#0F1419',
  light: '#F5F0EB',
};

/**
 * One-time: keep the status bar OUT of the WebView so app content never renders
 * behind it (the user's #1 issue). A CSS safe-area fallback (`--safe-top`) covers
 * the case where the OS still forces edge-to-edge.
 */
export async function initNativeStatusBar(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Plugin unavailable / older shell — the CSS safe-area fallback still applies.
  }
}

/**
 * Theme-reactive: the status bar background and icon contrast follow the active
 * theme. Style.Dark renders LIGHT icons (for dark backgrounds); Style.Light
 * renders DARK icons (for light backgrounds).
 */
export async function applyNativeStatusBar(resolved: 'dark' | 'light'): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({ style: resolved === 'light' ? Style.Light : Style.Dark });
    await StatusBar.setBackgroundColor({ color: STATUS_BAR_BG[resolved] });
  } catch {
    // setBackgroundColor is Android-only; ignore where unsupported.
  }
}
