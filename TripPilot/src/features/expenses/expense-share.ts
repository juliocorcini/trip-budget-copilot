import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
} from '@/data/sync/crypto';
import {
  createShare,
  getShareStatement,
  putShareStatement,
  type SharePublishExtras,
} from '@/data/sync/share-client';
import { uploadImage } from '@/data/sync/media-link';
import { attachmentRepository } from '@/data/repositories';
import {
  buildExpenseShareUrl,
  buildSharePreview,
  slugifyShareName,
  buildExpenseSharePayload,
  parseExpenseSharePayload,
  EXPENSE_SHARE_MAX_IMAGES,
  type SharePreview,
  type ExpenseSharePayload,
  type ExpenseShareImage,
} from '@/domain/sync';
import { formatMoney } from '@/domain/money';
import { formatDate, localDayOf } from '@/domain/dates';
import i18n from '@/i18n';
import { getShareOrigin } from '@/utils/native/public-origin';
import { isSharePreviewEnabled } from '@/features/group-split/group-link';
import { logger } from '@/utils/logger';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-457 — share ONE expense (with photos) as a `/x/:id` link. The client
 * orchestration that wires the pure payload (expense-share-payload) to the
 * SAME encrypted share channel every other share uses. Photos are uploaded as
 * plaintext R2 objects (DEC-348 model) so the guest page and the OG card can
 * render them directly; the payload itself stays an E2E blob.
 *
 * Capability model (DEC-207 + DEC-455): the link is the read capability; the
 * AES key is escrowed on the worker so the outgoing URL has no `#k=` tail.
 * Re-sharing the same expense reuses the SAME link (creds persisted per
 * transaction id) — the publish just refreshes content and bumps `?v=`.
 */

export interface ExpenseShareCreds {
  shareId: string;
  slug?: string;
  key: string;
  /** DEC-455 — worker holds the key too, so the built link drops `#k=`. */
  keyOnServer?: boolean;
  writeToken: string;
  revision: number;
}

/* ── creds persistence (per transaction, survive reopen → same link) ──────── */

const EXPENSE_SHARE_KEY = 'expense.share.creds';

type CredsMap = Record<string, ExpenseShareCreds>;

function isCreds(c: Partial<ExpenseShareCreds> | undefined): c is ExpenseShareCreds {
  return (
    !!c &&
    typeof c.shareId === 'string' &&
    typeof c.key === 'string' &&
    typeof c.writeToken === 'string' &&
    typeof c.revision === 'number'
  );
}

function readCredsMap(): CredsMap {
  try {
    const raw = localStorage.getItem(EXPENSE_SHARE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as CredsMap;
    return {};
  } catch {
    return {};
  }
}

export function loadExpenseShare(transactionId: string): ExpenseShareCreds | null {
  const creds = readCredsMap()[transactionId];
  return isCreds(creds) ? creds : null;
}

function saveExpenseShare(transactionId: string, creds: ExpenseShareCreds): void {
  try {
    const map = readCredsMap();
    map[transactionId] = creds;
    localStorage.setItem(EXPENSE_SHARE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: the link still works for this session.
  }
}

/* ── preview (Â-PREVIEW-SUMMARY-ONLY) ─────────────────────────────────────── */

/** Summary-only preview, composed in the OWNER's language. */
function composeExpensePreview(tx: Transaction, imgId: string | null): SharePreview {
  const title = tx.description.trim() || i18n.t('expenseShare.preview_fallback_title');
  return buildSharePreview({
    kind: 'expense',
    title,
    description: i18n.t('expenseShare.preview_desc', {
      amount: formatMoney(tx.amountCents, tx.currency),
      date: formatDate(localDayOf(tx.date)),
    }),
    totalCents: tx.amountCents,
    currency: tx.currency,
    peopleCount: 0,
    imgId,
  });
}

/* ── owner side ───────────────────────────────────────────────────────────── */

/**
 * Upload the expense's attachments (≤4, oldest first) as plaintext R2 images.
 * Best-effort per photo: one failed upload drops that photo, never the share.
 */
async function uploadExpenseImages(transactionId: string): Promise<ExpenseShareImage[]> {
  const attachments = await attachmentRepository.getByTransactionId(transactionId);
  const images: ExpenseShareImage[] = [];
  for (const att of attachments.slice(0, EXPENSE_SHARE_MAX_IMAGES)) {
    const result = await uploadImage(att.blob, {
      width: att.width,
      height: att.height,
      mimeType: att.mimeType,
    });
    if (result.ok) {
      images.push({
        r2Id: result.ref.r2Id,
        mime: result.ref.mime,
        w: result.ref.w,
        h: result.ref.h,
      });
    } else {
      logger.warn('expense_share_image_skipped', {
        module: 'expense-share',
        reason: result.reason,
      });
    }
  }
  return images;
}

async function expensePublishExtras(
  tx: Transaction,
  imgId: string | null,
  key: string,
): Promise<SharePublishExtras> {
  const previewOn = await isSharePreviewEnabled();
  return {
    ...(previewOn
      ? {
          preview: composeExpensePreview(tx, imgId),
          slugBase: slugifyShareName(tx.description) || 'expense',
        }
      : {}),
    linkKey: key,
  };
}

export interface PublishExpenseShareResult {
  url: string;
  creds: ExpenseShareCreds;
}

/**
 * Publish (or refresh) the share link of one expense. First call mints the
 * link; later calls reuse it — re-uploading current photos, re-encrypting the
 * payload and bumping the revision so chat apps re-scrape the card (DEC-454).
 */
export async function publishExpenseShare(
  tx: Transaction,
  ownerName: string,
): Promise<PublishExpenseShareResult> {
  const images = await uploadExpenseImages(tx.id);
  const imgId = images[0]?.r2Id ?? null;
  const existing = loadExpenseShare(tx.id);

  const payload = buildExpenseSharePayload({ ownerName, transaction: tx, images });

  if (existing) {
    const nextRevision = existing.revision + 1;
    const cryptoKey = await importSessionKey(existing.key);
    const blob = await encryptText(cryptoKey, JSON.stringify(payload));
    const extras = await expensePublishExtras(tx, imgId, existing.key);
    const result = await putShareStatement(
      existing.shareId,
      existing.writeToken,
      blob,
      nextRevision,
      extras,
    );
    const creds: ExpenseShareCreds = {
      ...existing,
      revision: nextRevision,
      ...(result.keyHeld ? { keyOnServer: true } : {}),
    };
    saveExpenseShare(tx.id, creds);
    return { url: buildExpenseShareLinkUrl(creds), creds };
  }

  const key = await generateSessionKey();
  const cryptoKey = await importSessionKey(key);
  const blob = await encryptText(cryptoKey, JSON.stringify(payload));
  const created = await createShare(blob, 1, await expensePublishExtras(tx, imgId, key));
  const creds: ExpenseShareCreds = {
    shareId: created.id,
    ...(created.slug ? { slug: created.slug } : {}),
    key,
    ...(created.keyHeld ? { keyOnServer: true } : {}),
    writeToken: created.writeToken,
    revision: 1,
  };
  saveExpenseShare(tx.id, creds);
  return { url: buildExpenseShareLinkUrl(creds), creds };
}

export function buildExpenseShareLinkUrl(creds: ExpenseShareCreds): string {
  const fragmentKey = creds.keyOnServer ? null : creds.key;
  return buildExpenseShareUrl(
    getShareOrigin(),
    creds.slug ?? creds.shareId,
    fragmentKey,
    creds.revision,
  );
}

/* ── guest side ───────────────────────────────────────────────────────────── */

export type FetchExpenseStatus = 'revoked' | 'not_found' | 'bad_key' | 'error';

export type FetchExpenseResult =
  | { status: 'ok'; payload: ExpenseSharePayload }
  | { status: FetchExpenseStatus };

/**
 * Fetch + decrypt + validate a shared expense for a guest. DEC-455: `key` may
 * be null (fragment-less short link) — the escrowed key from the statement GET
 * is used instead; a fragment key, when present, always wins.
 */
export async function fetchSharedExpense(
  shareId: string,
  key: string | null,
): Promise<FetchExpenseResult> {
  const res = await getShareStatement(shareId);
  if (res.status === 'revoked') return { status: 'revoked' };
  if (res.status === 'not_found') return { status: 'not_found' };
  if (res.status === 'error') return { status: 'error' };

  const effectiveKey = key ?? res.key ?? null;
  if (!effectiveKey) return { status: 'bad_key' };
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await importSessionKey(effectiveKey);
  } catch {
    return { status: 'bad_key' };
  }
  const text = await decryptText(cryptoKey, res.blob);
  if (text === null) return { status: 'bad_key' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'error' };
  }
  const payload = parseExpenseSharePayload(json);
  if (!payload) return { status: 'error' };
  return { status: 'ok', payload };
}
