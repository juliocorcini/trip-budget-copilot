import { getSyncWorkerUrl } from '@/data/sync/config';
import { getInstallationId } from '@/utils/entity-factory';
import { logger } from '@/utils/logger';

/**
 * Web Push VAPID subscription manager. Registers the browser's push
 * subscription with the Cloudflare Worker so it can send push notifications
 * even when the app is closed (browser still running).
 *
 * The public VAPID key lives here (not a secret); the private key is a Worker
 * secret. Both were generated once and must stay paired forever.
 */

const VAPID_PUBLIC_KEY = 'BDEJYKjNDXBl3pjeFVBPUzXXmqQ5vBn2bgVRdvK-Ed5siuaZ1DOFEzCa99vXLWOMVNSLWHh4LRPEWdgooIIf15E';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

let registered = false;

export async function registerPushSubscription(): Promise<void> {
  if (registered) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    const workerUrl = getSyncWorkerUrl();
    await fetch(`${workerUrl}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installId: getInstallationId(),
        subscription: subscription.toJSON(),
      }),
    });

    registered = true;
    logger.info('push_subscription_registered', { module: 'push' });
  } catch (err) {
    logger.error('push_subscription_failed', { module: 'push' }, err);
  }
}
