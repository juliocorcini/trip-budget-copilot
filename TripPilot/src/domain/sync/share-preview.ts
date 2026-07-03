/**
 * DEC-445/446 — public share PREVIEW + readable SLUG (pure domain).
 *
 * The preview is a deliberately-plaintext SUMMARY blob stored NEXT TO the E2E
 * ciphertext so link crawlers (WhatsApp/OG) can render a card. Hard limits
 * (Â-PREVIEW-SUMMARY-ONLY): title/description/total/currency/people count/
 * updatedAt/one image id — NEVER items, per-item names, the AES key or the
 * write token; serialized size ≤ 1 KB. The AES key stays exclusively in the
 * URL fragment (Â-KEY-IN-FRAGMENT) — the slug shortens the PATH only.
 */

export const SHARE_PREVIEW_VERSION = 1 as const;
export const SHARE_PREVIEW_MAX_BYTES = 1024;
export const SHARE_PREVIEW_TITLE_MAX = 80;
export const SHARE_PREVIEW_DESCRIPTION_MAX = 200;
export const SHARE_SLUG_BASE_MAX = 40;

export type SharePreviewKind = 'group' | 'split' | 'statement';

export interface SharePreview {
  v: typeof SHARE_PREVIEW_VERSION;
  kind: SharePreviewKind;
  /** Human title (share/group name) — ≤80 chars. */
  title: string;
  /** Composed, LOCALIZED description (built on the owner's device) — ≤200 chars. */
  description: string;
  /** Integer cents (the share's headline total). */
  totalCents: number;
  currency: string;
  /** People on the share (participants), ≥0. */
  peopleCount: number;
  /** Epoch ms of the publish that produced this preview. */
  updatedAt: number;
  /** Optional R2 image id (plaintext DEC-348 refs only — never an E2E key). */
  imgId?: string;
}

export interface BuildSharePreviewInput {
  kind: SharePreviewKind;
  title: string;
  description: string;
  totalCents: number;
  currency: string;
  peopleCount: number;
  imgId?: string | null;
  /** Injectable clock for tests. */
  now?: number;
}

const IMG_ID_RE = /^[0-9a-fA-F-]{8,64}$/;

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Readable slug from a share/group name: lowercase, accents stripped, only
 * `a-z0-9-`, ≤40 chars. Returns '' when nothing survives (caller falls back to
 * a kind word like 'group'). The slug is a PATH shortcut — never the key.
 */
export function slugifyShareName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, SHARE_SLUG_BASE_MAX).replace(/-+$/, '');
}

/**
 * Compose the summary-only preview blob. Clamps every text field, validates the
 * image id and — because emoji-heavy titles can blow the byte cap even inside
 * the char caps — trims description-then-title until the serialized JSON fits
 * SHARE_PREVIEW_MAX_BYTES. Output carries ONLY the allowlisted fields.
 */
export function buildSharePreview(input: BuildSharePreviewInput): SharePreview {
  const totalCents = Number.isFinite(input.totalCents) ? Math.trunc(input.totalCents) : 0;
  const peopleCount =
    Number.isFinite(input.peopleCount) && input.peopleCount > 0 ? Math.trunc(input.peopleCount) : 0;
  const imgId = input.imgId && IMG_ID_RE.test(input.imgId) ? input.imgId : undefined;

  const preview: SharePreview = {
    v: SHARE_PREVIEW_VERSION,
    kind: input.kind,
    title: input.title.trim().slice(0, SHARE_PREVIEW_TITLE_MAX),
    description: input.description.trim().slice(0, SHARE_PREVIEW_DESCRIPTION_MAX),
    totalCents,
    currency: input.currency.trim().slice(0, 8),
    peopleCount,
    updatedAt: input.now ?? Date.now(),
    ...(imgId ? { imgId } : {}),
  };

  while (utf8Bytes(JSON.stringify(preview)) > SHARE_PREVIEW_MAX_BYTES) {
    if (preview.description.length > 0) {
      preview.description = preview.description.slice(
        0,
        Math.floor(preview.description.length * 0.8),
      );
    } else if (preview.title.length > 8) {
      preview.title = preview.title.slice(0, Math.floor(preview.title.length * 0.8));
    } else {
      break;
    }
  }
  return preview;
}
