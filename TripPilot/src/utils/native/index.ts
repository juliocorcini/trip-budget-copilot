import { isNativeApp } from './platform';
import { initNativeStatusBar } from './status-bar';
import { initBackButton } from './back-button';
import { initNativeNotifications } from './notifications';
import { initShareTarget } from './share-target';

let initialized = false;

/**
 * One-time native shell setup: status bar overlay mode + hardware back button +
 * native notification permission/action listener. No-op on the web build.
 * Theme-reactive bits (status bar color/style) are driven separately by
 * RootLayout via `applyNativeStatusBar`.
 */
export function initNativeShell(): void {
  if (initialized || !isNativeApp()) return;
  initialized = true;
  // N7: tag the document so native-only calibration (e.g. the WebView zoom that
  // counters Android's smaller default rendering) applies without touching web.
  document.documentElement.classList.add('cap-native');
  void initNativeStatusBar();
  initBackButton();
  void initNativeNotifications();
  // B1 (Onda 4 / DEC-215): subscribe to shared `.csv` files and drain any the
  // app was cold-started with. RootLayout owns the navigation side.
  void initShareTarget();
}

export { isNativeApp } from './platform';
export { applyNativeStatusBar } from './status-bar';
