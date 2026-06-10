import i18n from '@/i18n';
import { showToast } from '@/components/Toast';

// DEC-082 (GAP-R2-001): when a new SW is waiting, show a persistent toast.
// Tapping it tells the SW to skipWaiting; controllerchange then reloads once.
function promptUpdate(reg: ServiceWorkerRegistration): void {
  showToast(i18n.t('pwa.update_available'), 'info', {
    persistent: true,
    onTap: () => {
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
    },
  });
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // First install (no controller yet) → "ready for offline use" (DEC-053d / GAP-036).
    const isFirstInstall = !navigator.serviceWorker.controller;

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // clients.claim() also fires this on first install — no reload then.
      if (isFirstInstall || reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptUpdate(reg);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptUpdate(reg);
            } else if (newWorker.state === 'activated' && isFirstInstall) {
              showToast(i18n.t('pwa.offline_ready'), 'success');
            }
          });
        });
      })
      .catch((err) => console.error('[SW] Registration failed:', err));
  });
}

// GAP-R2-005: persistence is requested automatically at key moments
// (onboarding done, first expense) — idempotent, safe to call repeatedly.
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) return true;
    return navigator.storage.persist();
  }
  return false;
}
