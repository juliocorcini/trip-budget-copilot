import { App } from '@capacitor/app';
import i18n from '@/i18n';
import { showToast } from '@/components/Toast';
import { dismissTopOverlay } from '@/utils/overlay-dismiss';
import { isNativeApp } from './platform';

// Routes where there is nothing left to go back to inside the app.
const HOME_PATHS = new Set(['/', '/dashboard']);

let exitArmed = false;
let exitTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Native hardware/gesture back (DEC-193): close an open overlay first, then walk
 * back through in-app history, and only leave the app from a home route after a
 * second press. Replaces the web-only history hack (`useBackButtonGuard`).
 */
export function initBackButton(): void {
  if (!isNativeApp()) return;
  void App.addListener('backButton', () => {
    if (dismissTopOverlay()) return;

    if (!HOME_PATHS.has(window.location.pathname)) {
      window.history.back();
      return;
    }

    if (exitArmed) {
      void App.exitApp();
      return;
    }
    exitArmed = true;
    showToast(i18n.t('common.press_again_to_exit'), 'info');
    if (exitTimer) clearTimeout(exitTimer);
    exitTimer = setTimeout(() => {
      exitArmed = false;
    }, 2000);
  });
}
