import { flushOutbox, drainMailboxIntoApp } from '@/domain/orchestrators';
import { appSettingsRepository } from '@/data/repositories';
import { getDeviceIdentity } from '@/data/sync/identity-crypto';
import { subscribePeerPings } from '@/data/sync/peer-ping';
import { showLocalNotification } from '@/utils/native/notifications';
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

/**
 * Drains the mailbox. `force` (a real-time peer-ping, DEC-352) bypasses the
 * polling debounce — a poke means "there is something for you right now."
 */
export async function runMailboxSync(force = false): Promise<void> {
  if (running) return;
  const now = Date.now();
  if (!force && now - lastRunAt < MIN_INTERVAL_MS) return;
  running = true;
  lastRunAt = now;
  try {
    await flushOutbox();
    const { statements, backups, connects, debts, payments, invites } = await drainMailboxIntoApp();
    if (statements > 0 || backups > 0 || connects > 0 || debts > 0 || payments > 0 || invites > 0) {
      window.dispatchEvent(new CustomEvent(MAILBOX_DRAINED_EVENT));
    }
    if (statements > 0) {
      showToast(i18n.t('mailbox.received_statements', { count: statements }), 'info');
    }
    if (backups > 0) {
      showToast(i18n.t('mailbox.received_backups', { count: backups }), 'info');
    }
    // DEC-344 (G6): a peer connected back — surface it so the new connection is felt.
    if (connects > 0) {
      showToast(i18n.t('mailbox.received_connections', { count: connects }), 'info');
    }
    // DEC-345/346 (G7): inbound debts/payments wait PENDING in /shared — toast so
    // the user knows to go accept/confirm (accept-first ÂNCORA: never auto-applied).
    if (debts > 0) {
      showToast(i18n.t('mailbox.received_debts', { count: debts }), 'info');
    }
    if (payments > 0) {
      showToast(i18n.t('mailbox.received_payments', { count: payments }), 'info');
    }
    // DEC-355 (G8): inbound group invites wait PENDING (accept-first) — toast so the
    // user goes to accept; the group only joins their list on accept.
    if (invites > 0) {
      showToast(i18n.t('mailbox.received_invites', { count: invites }), 'info');
    }
    // DEC-352 (F18, G6): a charge/payment/invite that arrived in real-time (or while
    // backgrounded) also fires a native OS notification so it is felt at once and
    // survives a missed toast. Connect handshakes are silent here (the toast above
    // is enough); only the actionable items escalate to the OS layer.
    const actionable = debts + payments + invites;
    if (actionable > 0) {
      void showLocalNotification(
        i18n.t('mailbox.native_title'),
        i18n.t('mailbox.native_body', { count: actionable }),
      );
    }
  } catch {
    // Offline or worker down — the queue persists for the next attempt.
  } finally {
    running = false;
  }
}

let pingHandle: ReturnType<typeof subscribePeerPings> = null;

export function registerMailboxSync(): void {
  // Deferred so it never competes with first paint.
  window.setTimeout(() => void runMailboxSync(), 1500);
  window.addEventListener('online', () => void runMailboxSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runMailboxSync();
  });
  // DEC-352 (F17, G6): subscribe to MY OWN signal room so a peer's ping drains my
  // mailbox in real-time. Best-effort — the boot/focus pull stays the floor.
  void registerPeerPingSubscription();
}

async function registerPeerPingSubscription(): Promise<void> {
  if (pingHandle) return;
  try {
    const settings = await appSettingsRepository.get();
    if (!settings.mailboxEnabled) return;
    const me = await getDeviceIdentity();
    pingHandle = subscribePeerPings(me.actorId, () => void runMailboxSync(true));
  } catch {
    // No identity/settings yet — boot/focus draining still delivers, just slower.
  }
}
