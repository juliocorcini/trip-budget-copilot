import { shareLinkRepository } from '@/data/repositories';
import {
  pullAllShareResponses,
  pullShareResponses,
  republishShareLinkFromDb,
} from '@/domain/orchestrators';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { notifyAppDataChanged } from '@/hooks/useAppData';
import { logger } from '@/utils/logger';
import { showToast } from '@/components/Toast';
import i18n from '@/i18n';

/**
 * App-level share-link watcher. Subscribes to the WebSocket relay for EVERY
 * active share link the owner has, so a guest's confirm/reject fires a data
 * refresh + toast even when the participant's ShareLinkSheet is not open.
 *
 * Follows the same boot pattern as `group-split-boot.ts` and `mailbox-boot.ts`:
 * boot once at startup, listen forever, re-sync on foreground return.
 */

export const SHARE_LINK_RECONCILED_EVENT = 'tp:share-link-reconciled';

const handles = new Map<string, ShareSignalHandle>();
let booted = false;

async function pullForLink(shareId: string): Promise<void> {
  const link = (await shareLinkRepository.getAllActive()).find((l) => l.id === shareId);
  if (!link) return;
  try {
    const result = await pullShareResponses(link);
    if (result.appliedLines > 0) {
      notifyAppDataChanged();
      window.dispatchEvent(new CustomEvent(SHARE_LINK_RECONCILED_EVENT, {
        detail: { shareId, appliedLines: result.appliedLines },
      }));
      showToast(
        i18n.t('shareLink.responses_applied', { count: result.appliedLines }),
        'success',
      );

      const freshLink = await shareLinkRepository.getById(link.id);
      if (freshLink && !freshLink.revokedAt) {
        try {
          await republishShareLinkFromDb(freshLink);
          handles.get(shareId)?.send({ t: 'upd' });
        } catch (err) {
          logger.warn('share_link_boot_republish_failed', { shareId, module: 'share-link-boot' }, err);
        }
      }
    }
  } catch (err) {
    logger.warn('share_link_boot_pull_failed', { shareId, module: 'share-link-boot' }, err);
  }
}

function subscribeToLink(shareId: string): void {
  if (handles.has(shareId)) return;
  const handle = connectShareSignal(shareId, (msg) => {
    if (msg.t === 'resp') {
      window.setTimeout(() => void pullForLink(shareId), 800);
    }
  });
  handles.set(shareId, handle);
}

async function refreshAllShareLinks(): Promise<void> {
  const links = await shareLinkRepository.getAllActive();
  const activeIds = new Set(links.map((l) => l.id));

  for (const [id, handle] of handles) {
    if (!activeIds.has(id)) {
      handle.close();
      handles.delete(id);
    }
  }

  for (const link of links) {
    subscribeToLink(link.id);
  }

  try {
    const result = await pullAllShareResponses();
    if (result.totalApplied > 0) {
      notifyAppDataChanged();
      window.dispatchEvent(new CustomEvent(SHARE_LINK_RECONCILED_EVENT));
      for (const changedId of result.linksWithChanges) {
        handles.get(changedId)?.send({ t: 'upd' });
      }
    }
  } catch (err) {
    logger.warn('share_link_boot_refresh_all_failed', { module: 'share-link-boot' }, err);
  }
}

const PERIODIC_PULL_MS = 90_000;
let periodicTimer: ReturnType<typeof setInterval> | null = null;

export function registerShareLinkSync(): void {
  if (booted) return;
  booted = true;
  window.setTimeout(() => void refreshAllShareLinks(), 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshAllShareLinks();
  });
  // Periodic background poll catches missed WebSocket signals (e.g. the relay
  // was down, the device lost connectivity briefly, or the owner left the app
  // open but backgrounded). Runs only while the document is visible.
  periodicTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshAllShareLinks();
  }, PERIODIC_PULL_MS);
}

export function teardownShareLinkSync(): void {
  for (const h of handles.values()) h.close();
  handles.clear();
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  booted = false;
}
