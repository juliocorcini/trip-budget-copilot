/**
 * D-IMP-04: share a link (text + URL) through the OS share sheet when the Web
 * Share API is available, falling back to the clipboard otherwise. This mirrors
 * the proven `SharedExpensesPage` pair-link pattern in one reusable place so the
 * statement-share flow (after a split) behaves the same way.
 *
 * The crucial detail: when the user DISMISSES the native share sheet the browser
 * rejects with an `AbortError` — that is not a failure, so we must NOT silently
 * copy behind their back. Only a genuine share failure falls back to copying, so
 * the link is never lost on platforms where sharing is flaky.
 */
export interface ShareLinkInput {
  /** The canonical URL — always what we copy in the fallback. */
  url: string;
  /** Optional ready-made message (already embeds the URL for chat apps). */
  text?: string;
  /** Optional share-sheet title. */
  title?: string;
}

export type ShareLinkOutcome = 'shared' | 'copied' | 'cancelled' | 'copy_failed';

/** Pure: the `ShareData` payload sent to `navigator.share`. */
export function buildShareLinkPayload(input: ShareLinkInput): ShareData {
  const payload: ShareData = { url: input.url };
  if (input.text) payload.text = input.text;
  if (input.title) payload.title = input.title;
  return payload;
}

function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

async function copyLink(url: string): Promise<ShareLinkOutcome> {
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'copy_failed';
  }
}

/**
 * Try the OS share sheet, then fall back to copying. Returns which path ran so
 * the caller can show the right toast (and stay silent on a user cancel).
 */
export async function shareOrCopyLink(input: ShareLinkInput): Promise<ShareLinkOutcome> {
  if (canUseWebShare()) {
    try {
      await navigator.share(buildShareLinkPayload(input));
      return 'shared';
    } catch (err) {
      // User dismissed the sheet — do nothing (never copy behind their back).
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other failure: fall through to the clipboard so the link survives.
    }
  }
  return copyLink(input.url);
}

/**
 * DL-5 (G2/G3): share a plain TEXT message — a debt reminder, NOT a link —
 * through the OS share sheet, falling back to copying the TEXT itself (so the
 * message is never lost). Mirrors `shareOrCopyLink`, but there is no URL: the
 * fallback preserves the reminder text so the user can paste it into any chat.
 */
export async function shareOrCopyText(text: string, title?: string): Promise<ShareLinkOutcome> {
  if (canUseWebShare()) {
    try {
      const payload: ShareData = { text };
      if (title) payload.title = title;
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'copy_failed';
  }
}
