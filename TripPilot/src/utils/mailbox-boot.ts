import { flushOutbox, drainMailboxIntoApp } from '@/domain/orchestrators';
import { showToast } from '@/components/Toast';
import i18n from '@/i18n';

/**
 * FIELD item 8: drives the async mailbox from outside React. On boot, on
 * regaining connectivity, and when the app returns to the foreground it flushes
 * any queued outgoing blobs and drains incoming ones (when the feature is on).
 * Pages listen for MAILBOX_DRAINED_EVENT to refresh without a navigation.
 */

export const MAILBOX_DRAINED_EVENT = 'tp:mailbox-drained';

const MIN_INTERVAL_MS = 30_000;
let running = false;
let lastRunAt = 0;

export async function runMailboxSync(): Promise<void> {
  if (running) return;
  const now = Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) return;
  running = true;
  lastRunAt = now;
  try {
    await flushOutbox();
    const { statements, backups } = await drainMailboxIntoApp();
    if (statements > 0 || backups > 0) {
      window.dispatchEvent(new CustomEvent(MAILBOX_DRAINED_EVENT));
    }
    if (statements > 0) {
      showToast(i18n.t('mailbox.received_statements', { count: statements }), 'info');
    }
    if (backups > 0) {
      showToast(i18n.t('mailbox.received_backups', { count: backups }), 'info');
    }
  } catch {
    // Offline or worker down — the queue persists for the next attempt.
  } finally {
    running = false;
  }
}

export function registerMailboxSync(): void {
  // Deferred so it never competes with first paint.
  window.setTimeout(() => void runMailboxSync(), 1500);
  window.addEventListener('online', () => void runMailboxSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runMailboxSync();
  });
}
