import i18n from '@/i18n';
import { showToast } from '@/components/Toast';

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // First install (no controller yet) → "ready for offline use" (DEC-053d / GAP-036).
      const isFirstInstall = !navigator.serviceWorker.controller;

      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  if (isFirstInstall) {
                    showToast(i18n.t('pwa.offline_ready'), 'success');
                  } else if (navigator.serviceWorker.controller) {
                    console.info('[SW] New version available');
                  }
                }
              });
            }
          });
        })
        .catch((err) => console.error('[SW] Registration failed:', err));
    });
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }
  return false;
}
