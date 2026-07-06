import { uploadImage } from '@/data/sync/media-link';
import { attachmentRepository, shareLinkRepository } from '@/data/repositories';
import { createShareLink } from '@/domain/orchestrators';
import {
  buildShareUrl,
  buildSharePreview,
  type SharePreview,
  type StatementPayload,
  type StatementPayloadLine,
} from '@/domain/sync';
import type { ShareLink } from '@/domain/types/share-link';
import type { ImageRef } from '@/domain/media';
import type { Attachment } from '@/domain/types/attachment';
import { formatMoney } from '@/domain/money';
import { getShareOrigin } from '@/utils/native/public-origin';
import i18n from '@/i18n';
import { logger } from '@/utils/logger';

/**
 * DEC-476 — everything the "charge page" share needs beyond the raw payload:
 * item photos uploaded to R2 (plaintext, DEC-348 model) riding each line, the
 * canonical link URL of a ShareLink, and a get-or-create used by the reminder
 * message so "Lembrar" always carries the actual charge link.
 */

/* ── item photos (attachment → plaintext R2 ref, cached per attachment) ────── */

const STATEMENT_IMAGE_CACHE_KEY = 'statement.share.images';

type ImageCacheMap = Record<string, ImageRef>;

function readImageCache(): ImageCacheMap {
  try {
    const raw = localStorage.getItem(STATEMENT_IMAGE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ImageCacheMap) : {};
  } catch {
    return {};
  }
}

function writeImageCache(map: ImageCacheMap): void {
  try {
    localStorage.setItem(STATEMENT_IMAGE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: uploads just repeat on the next share.
  }
}

/** Upload one attachment (or reuse its cached ref from a previous share). */
async function getOrUploadAttachmentRef(attachment: Attachment): Promise<ImageRef | null> {
  const cache = readImageCache();
  const cached = cache[attachment.id];
  if (cached) return cached;
  const result = await uploadImage(attachment.blob, {
    width: attachment.width,
    height: attachment.height,
    mimeType: attachment.mimeType,
  });
  if (!result.ok) {
    logger.warn('statement_share_image_skipped', {
      module: 'statement-share',
      reason: result.reason,
    });
    return null;
  }
  cache[attachment.id] = result.ref;
  writeImageCache(cache);
  return result.ref;
}

/**
 * DEC-476 — attach each line's item photo (the expense's FIRST attachment) to
 * the payload before it ships to the link. Best-effort per photo: one failed
 * upload skips that photo, never the share. Refs are cached per attachment id,
 * so a refresh re-uploads nothing.
 */
export async function enrichStatementImages(payload: StatementPayload): Promise<StatementPayload> {
  const transactionIds = new Set<string>();
  for (const line of payload.lines) transactionIds.add(line.transactionId);
  for (const group of payload.thirdParty ?? []) {
    for (const line of group.lines) transactionIds.add(line.transactionId);
  }
  if (transactionIds.size === 0) return payload;

  const refByTransaction = new Map<string, ImageRef>();
  for (const transactionId of transactionIds) {
    try {
      const attachments = await attachmentRepository.getByTransactionId(transactionId);
      const first = attachments[0];
      if (!first) continue;
      const ref = await getOrUploadAttachmentRef(first);
      if (ref) refByTransaction.set(transactionId, ref);
    } catch {
      // Missing/broken attachment never blocks the share.
    }
  }
  if (refByTransaction.size === 0) return payload;

  const withImage = (line: StatementPayloadLine): StatementPayloadLine => {
    const ref = refByTransaction.get(line.transactionId);
    return ref ? { ...line, image: ref } : line;
  };
  return {
    ...payload,
    lines: payload.lines.map(withImage),
    ...(payload.thirdParty
      ? {
          thirdParty: payload.thirdParty.map((group) => ({
            ...group,
            lines: group.lines.map(withImage),
          })),
        }
      : {}),
  };
}

/* ── link URL + preview (single source, reused by sheet and reminder) ──────── */

/** The canonical URL of a statement ShareLink (slug, escrowed key, ?v=). */
export function shareLinkUrlOf(link: ShareLink): string {
  return buildShareUrl(
    getShareOrigin(),
    link.slug ?? link.id,
    link.keyOnServer === true ? null : link.key,
    link.statementRevision,
  );
}

/**
 * DEC-445 — summary-only preview for the pasted-link card, composed in the
 * OWNER's language (the worker never translates).
 */
export function composeStatementPreview(statement: StatementPayload): SharePreview {
  return buildSharePreview({
    kind: 'statement',
    title: i18n.t('shareLink.preview_statement_title', { name: statement.owner.name }),
    description: i18n.t('shareLink.preview_statement_desc', {
      amount: formatMoney(Math.abs(statement.netCents), statement.currency),
    }),
    totalCents: Math.abs(statement.netCents),
    currency: statement.currency,
    peopleCount: 2,
  });
}

/**
 * DEC-476 — the charge URL for a participant: reuse their active share link or
 * mint one now (photos + payment methods enriched), so a reminder message can
 * ALWAYS carry the link to the charge page. Returns null only when there is
 * nothing to share (no statement) or the worker is unreachable.
 */
export async function ensureShareLinkUrl(
  participantId: string,
  buildStatement: () => StatementPayload | null,
): Promise<string | null> {
  const existing = await shareLinkRepository.getActiveByParticipantId(participantId);
  if (existing) return shareLinkUrlOf(existing);

  const statement = buildStatement();
  if (!statement) return null;
  try {
    const enriched = await enrichStatementImages(statement);
    const { url } = await createShareLink(
      participantId,
      enriched,
      getShareOrigin(),
      composeStatementPreview(enriched),
    );
    return url;
  } catch {
    return null;
  }
}
