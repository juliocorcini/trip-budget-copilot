import i18n from '@/i18n';
import { showToast } from '@/components/Toast';
import { shouldReloadOnUpdate } from '@/utils/sw-reload';

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
      // BUG-011: never reload mid-outing — defer until the session ends.
      if (!shouldReloadOnUpdate()) {
        showToast(i18n.t('pwa.update_deferred_outing'), 'info', { persistent: true });
        return;
      }
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
  if (!(navigator.storage && navigator.storage.persist)) return false;
  let persisted = await navigator.storage.persisted();
  if (!persisted) {
    persisted = await navigator.storage.persist();
  }
  // BUG-002: iOS Safari never grants persistence (persist() resolves false),
  // so WebKit's ~7-day inactivity cap can evict IndexedDB and the user loses
  // everything. We cannot force durability there — the real protections are
  // the reinforced backup banner + the emergency snapshot. Here we just log the
  // quota estimate when persistence failed, so the eviction risk is diagnosable.
  if (!persisted) {
    void logStorageEstimate();
  }
  return persisted;
}

async function logStorageEstimate(): Promise<void> {
  try {
    if (!navigator.storage?.estimate) return;
    const { usage, quota } = await navigator.storage.estimate();
    // eslint-disable-next-line no-console
    console.info('[storage] persistence not granted — eviction risk', { usage, quota });
  } catch {
    // estimate() unsupported on this engine — nothing to log.
  }
}

/* ─────────── DEC-135: in-app install button + manual update check ─────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installAvailabilityListeners = new Set<() => void>();

function notifyInstallAvailability(): void {
  installAvailabilityListeners.forEach((listener) => listener());
}

/**
 * Must run at module-boot time: the browser fires `beforeinstallprompt` once,
 * early, and only when the PWA is installable and not yet installed.
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallAvailability();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstallAvailability();
  });
}

export function isInstallPromptAvailable(): boolean {
  return deferredInstallPrompt !== null;
}

export function subscribeInstallPromptAvailability(listener: () => void): () => void {
  installAvailabilityListeners.add(listener);
  return () => installAvailabilityListeners.delete(listener);
}

export async function promptAppInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const pending = deferredInstallPrompt;
  if (!pending) return 'unavailable';
  await pending.prompt();
  const choice = await pending.userChoice;
  if (choice.outcome === 'accepted') {
    deferredInstallPrompt = null;
    notifyInstallAvailability();
  }
  return choice.outcome;
}

export type UpdateCheckResult = 'updating' | 'up_to_date' | 'unsupported';

/**
 * DEC-135: "Chrome updated but the installed app is stale" — force the SW to
 * fetch the latest version. When a new worker lands we skip waiting right away
 * (the user explicitly asked); the existing controllerchange handler reloads.
 */
/** Plain accessor — defeats TS control-flow narrowing across awaits. */
function getWaitingWorker(reg: ServiceWorkerRegistration): ServiceWorker | null {
  return reg.waiting;
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsupported';

  await reg.update();

  const waiting = getWaitingWorker(reg);
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return 'updating';
  }

  const installing = reg.installing;
  if (installing) {
    const installed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 20000);
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          clearTimeout(timeout);
          resolve(true);
        } else if (installing.state === 'redundant') {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
    if (installed) {
      // The worker moved from installing to waiting during the await.
      getWaitingWorker(reg)?.postMessage({ type: 'SKIP_WAITING' });
      return 'updating';
    }
    return 'up_to_date';
  }

  return 'up_to_date';
}
