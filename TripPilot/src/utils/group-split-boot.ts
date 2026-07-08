import { groupSplitRepository } from '@/data/repositories';
import { loadGroupLive, pullGroupClaims } from '@/features/group-split/group-link';
import { reduceGroupClaims } from '@/domain/group-split';
import { persistGroupSplit } from '@/domain/orchestrators/group-split-orchestrators';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { getSyncWorkerUrl } from '@/data/sync/config';
import { getInstallationId } from '@/utils/entity-factory';
import {
  showLocalNotification,
  showOngoingGroupSplitNotification,
  cancelOngoingGroupSplitNotification,
} from '@/utils/native/notifications';
import { showToast } from '@/components/Toast';
import i18n from '@/i18n';

/**
 * App-level group-split watcher. Subscribes to the WebSocket relay for EVERY
 * open group-split the owner has credentials for, so a guest's "mark as paid"
 * fires a local notification + refreshes the notification center without the
 * owner being on the group-split page.
 *
 * Analogous to `mailbox-boot.ts` for P2P sync: boot once, listen forever,
 * fire a custom event that `useNotifications` picks up.
 */

export const GROUP_SPLIT_CHANGED_EVENT = 'tp:group-split-changed';

const handles = new Map<string, ShareSignalHandle>();
let booted = false;

const notifiedPaymentKeys = new Set<string>();

async function pollGroupAndNotify(eventId: string): Promise<void> {
  const creds = loadGroupLive(eventId);
  if (!creds) return;
  try {
    const claims = await pullGroupClaims(creds);
    const record = await groupSplitRepository.getEvent(eventId);
    if (!record) return;

    const next = reduceGroupClaims(record, claims);
    const changed =
      JSON.stringify(next.participants) !== JSON.stringify(record.participants) ||
      JSON.stringify(next.expenses) !== JSON.stringify(record.expenses);

    if (changed) {
      await persistGroupSplit(next);
    }

    for (const p of next.participants) {
      if (p.paymentStatus === 'marked') {
        const key = `${eventId}:${p.id}`;
        if (notifiedPaymentKeys.has(key)) continue;
        notifiedPaymentKeys.add(key);

        const msg = i18n.t('notifications.pending_group_payment', {
          participantName: p.name,
          groupName: next.name,
        });
        const groupRoute = `/groups/${eventId}`;
        showToast(msg, 'warning', {
          durationMs: 6000,
          actionLabel: i18n.t('common.see'),
          onTap: () => window.location.assign(groupRoute),
        });
        void showLocalNotification(
          i18n.t('group_split.title'),
          msg,
          groupRoute,
        );
      }
    }

    if (changed) {
      window.dispatchEvent(new CustomEvent(GROUP_SPLIT_CHANGED_EVENT));
    }
  } catch {
    // Network failure — the next signal or foreground return retries.
  }
}

function subscribeToGroup(eventId: string, shareId: string, groupName: string): void {
  if (handles.has(shareId)) return;
  const handle = connectShareSignal(shareId, () => void pollGroupAndNotify(eventId));
  handles.set(shareId, handle);

  registerPushWatch(shareId, groupName, eventId);
}

function registerPushWatch(shareId: string, groupName: string, eventId: string): void {
  const workerUrl = getSyncWorkerUrl();
  fetch(`${workerUrl}/push/watch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installId: getInstallationId(),
      shareId,
      groupName,
      eventId,
    }),
  }).catch(() => {});
}

async function refreshAllGroupSplits(): Promise<void> {
  const records = await groupSplitRepository.listEvents();
  for (const record of records) {
    if (record.status === 'settled') continue;
    const creds = loadGroupLive(record.event.id);
    if (!creds) continue;
    subscribeToGroup(record.event.id, creds.shareId, record.event.name);
    await pollGroupAndNotify(record.event.id);
  }
  await syncOngoingNotification();
}

async function syncOngoingNotification(): Promise<void> {
  const records = await groupSplitRepository.listEvents();
  const pending: { name: string; eventId: string; count: number }[] = [];

  for (const r of records) {
    if (r.status === 'settled') continue;
    const markedCount = r.event.participants.filter(
      (p) => p.paymentStatus === 'marked',
    ).length;
    if (markedCount > 0) {
      pending.push({ name: r.event.name, eventId: r.event.id, count: markedCount });
    }
  }

  if (pending.length === 0) {
    void cancelOngoingGroupSplitNotification();
    return;
  }

  const totalPending = pending.reduce((sum, p) => sum + p.count, 0);
  const first = pending[0]!;
  const title = i18n.t('group_split.title');
  const body =
    pending.length === 1
      ? i18n.t('notifications.pending_group_payment_ongoing', {
          count: totalPending,
          groupName: first.name,
        })
      : i18n.t('notifications.pending_group_payment_ongoing_multi', {
          count: totalPending,
          groups: pending.length,
        });
  const deepLink = pending.length === 1 ? `/groups/${first.eventId}` : '/dashboard';

  void showOngoingGroupSplitNotification(title, body, deepLink);
}

export function registerGroupSplitSync(): void {
  if (booted) return;
  booted = true;
  window.setTimeout(() => void refreshAllGroupSplits(), 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshAllGroupSplits();
  });
  window.addEventListener(GROUP_SPLIT_CHANGED_EVENT, () => void syncOngoingNotification());
}

/** Send a "statement updated" signal so connected guests refresh immediately. */
export function signalGroupSplitUpdate(shareId: string): void {
  const handle = handles.get(shareId);
  if (handle) handle.send({ t: 'upd' });
}

export function teardownGroupSplitSync(): void {
  for (const h of handles.values()) h.close();
  handles.clear();
  notifiedPaymentKeys.clear();
  booted = false;
}
