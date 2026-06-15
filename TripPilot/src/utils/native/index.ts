import { isNativeApp } from './platform';
import { initNativeStatusBar } from './status-bar';
import { initBackButton } from './back-button';
import { initNativeNotifications } from './notifications';

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
  void initNativeStatusBar();
  initBackButton();
  void initNativeNotifications();
}

export { isNativeApp } from './platform';
export { applyNativeStatusBar } from './status-bar';
