import { uploadImage } from '@/data/sync/media-link';
import { composeOgImageWithFooter } from '@/utils/image/og-footer';
import { getSyncWorkerUrl } from '@/data/sync/config';
import i18n from '@/i18n';
import { logger } from '@/utils/logger';

/**
 * DEC-458 — the boundary seam that turns a share photo into the BRANDED OG
 * variant (photo + TripPilot footer strip) and uploads it to R2. The preview
 * `imgId` points at the variant; the original photo stays untouched for the
 * guest page.
 *
 * Composition is deterministic per source image, so variants are cached
 * locally (source r2Id / attachment id → variant r2Id) — republish reuses the
 * same variant instead of re-composing and re-uploading. Everything is
 * best-effort: any failure falls back to the RAW photo id, never blocking a
 * publish (the card then shows the clean photo, exactly the pre-DEC-458
 * behavior).
 */

const CACHE_KEY = 'og.branded.v1';

/** Per-kind footer tagline, localized in the OWNER's language. */
export function ogFooterTagline(kind: 'group' | 'split' | 'statement' | 'expense'): string {
  return i18n.t(`ogFooter.${kind}`);
}

type BrandedCache = Record<string, string>;

function readCache(): BrandedCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as BrandedCache) : {};
  } catch {
    return {};
  }
}

function writeCache(sourceId: string, variantId: string): void {
  try {
    const map = readCache();
    map[sourceId] = variantId;
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // No storage: we just re-compose next time.
  }
}

/**
 * Compose + upload the branded variant of a LOCAL photo blob. Returns the
 * variant r2Id, or null on any failure (caller falls back to the raw photo).
 */
export async function uploadBrandedOgVariant(
  sourceId: string,
  photo: Blob,
  tagline: string,
): Promise<string | null> {
  const cached = readCache()[sourceId];
  if (cached) return cached;
  const composed = await composeOgImageWithFooter(photo, tagline);
  if (!composed) return null;
  const result = await uploadImage(composed.blob, {
    width: composed.width,
    height: composed.height,
    mimeType: 'image/jpeg',
  });
  if (!result.ok) {
    logger.warn('og_branded_upload_failed', { module: 'og-branded', reason: result.reason });
    return null;
  }
  writeCache(sourceId, result.ref.r2Id);
  return result.ref.r2Id;
}

/**
 * Branded variant of a photo that ALREADY lives on R2 (group expenses hold
 * refs, not blobs): fetch the plaintext bytes, compose, upload. Cached the
 * same way; null on any failure.
 */
export async function brandRemotePhotoForOg(
  sourceR2Id: string,
  tagline: string,
): Promise<string | null> {
  const cached = readCache()[sourceR2Id];
  if (cached) return cached;
  try {
    const res = await fetch(`${getSyncWorkerUrl()}/img/${sourceR2Id}`);
    if (!res.ok) return null;
    const photo = await res.blob();
    return await uploadBrandedOgVariant(sourceR2Id, photo, tagline);
  } catch {
    return null;
  }
}
