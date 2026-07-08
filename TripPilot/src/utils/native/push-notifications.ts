import { isNativeApp } from './platform';
import { getSyncWorkerUrl } from '@/data/sync/config';
import { getInstallationId } from '@/utils/entity-factory';
import { logger } from '@/utils/logger';

/**
 * FCM push notifications for the native (Capacitor) app. Registers the device
 * token with the Worker so it can send push notifications even when the app
 * process is completely killed.
 *
 * On the web/PWA this is a no-op — Web Push VAPID handles that path.
 * Only active on native Android (sideloaded APK with Google Play Services).
 */

let registered = false;

export async function registerFcmPush(): Promise<void> {
  if (registered || !isNativeApp()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== 'granted') return;
    } else if (permStatus.receive !== 'granted') {
      return;
    }

    PushNotifications.addListener('registration', async (token) => {
      const workerUrl = getSyncWorkerUrl();
      try {
        await fetch(`${workerUrl}/push/register-fcm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installId: getInstallationId(),
            fcmToken: token.value,
          }),
        });
        registered = true;
        logger.info('fcm_token_registered', { module: 'push' });
      } catch (err) {
        logger.error('fcm_token_register_failed', { module: 'push' }, err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      logger.error('fcm_registration_error', { module: 'push' }, err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info('fcm_foreground_received', {
        module: 'push',
        title: notification.title,
        body: notification.body,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const deepLink =
        action.notification.data?.deepLink as string | undefined;
      if (deepLink) {
        window.location.assign(deepLink);
      }
    });

    await PushNotifications.register();
    logger.info('fcm_register_called', { module: 'push' });
  } catch (err) {
    logger.error('fcm_setup_failed', { module: 'push' }, err);
  }
}
