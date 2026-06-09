export interface NotificationOptions {
  title: string;
  body: string;
  id?: number;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleLocalNotification(options: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  new Notification(options.title, {
    body: options.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `trippilot-${options.id ?? Date.now()}`,
  });
}

export function cancelAllNotifications(): void {
  // Web Notifications API doesn't support cancellation
  // Capacitor LocalNotifications plugin handles this natively
}
