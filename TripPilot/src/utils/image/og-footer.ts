/**
 * DEC-458 — branded footer composited onto share-card photos.
 *
 * When a share has a real photo, the WhatsApp/OG card shows THE PHOTO — but
 * Julio wants the brand strip that the no-photo cards carry ("TripPilot ·
 * Divisão em grupo — veja sua parte") to survive. So the client composes a
 * branded OG variant: the photo fitted to OG_IMAGE_WIDTH preserving its
 * original aspect ratio, plus a footer bar with the app icon, the brand name
 * and the per-kind tagline. The variant is uploaded NEXT TO the original photo
 * (the guest page keeps showing the clean original); only the preview `imgId`
 * points at the composed one.
 *
 * Everything here is best-effort: any failure (no canvas, icon missing, encode
 * error) returns null and the caller falls back to the raw photo id — a share
 * never breaks because of branding.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
const MAX_PHOTO_HEIGHT = 2133;
const BASE_FOOTER_HEIGHT = 110;
const ACCENT_BAR_HEIGHT = 4;
const JPEG_QUALITY = 0.85;

function resolveFooterMetrics(photoHeight: number) {
  const footerHeight = Math.max(BASE_FOOTER_HEIGHT, Math.round(photoHeight * 0.065));
  const scale = footerHeight / BASE_FOOTER_HEIGHT;
  return {
    footerHeight,
    iconSize: Math.round(64 * scale),
    paddingX: Math.round(44 * scale),
    iconRadius: Math.round(16 * scale),
    brandFontSize: Math.round(36 * scale),
    taglineFontSize: Math.round(30 * scale),
    textGap: Math.round(24 * scale),
    taglineGap: Math.round(18 * scale),
  };
}

const COLORS = {
  footer: 'rgba(15, 20, 25, 0.94)',
  accent: '#C75B39',
  brand: '#EDE8E0',
  tagline: '#A8B0B9',
};

const FONT = 'system-ui, -apple-system, sans-serif';

export interface CoverCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Source rectangle that cover-fits (fill + center-crop) a `srcW×srcH` image
 * into a `dstW×dstH` canvas. Pure — unit-tested.
 */
export function computeCoverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverCrop | null {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return null;
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return {
    sx: (srcW - sw) / 2,
    sy: (srcH - sh) / 2,
    sw,
    sh,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/** Draw the app icon rounded; a load failure just skips it (text shifts left). */
async function drawIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  iconSize: number,
  iconRadius: number,
): Promise<boolean> {
  try {
    const icon = await loadImage('/icons/icon-192.png');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + iconRadius, y);
    ctx.arcTo(x + iconSize, y, x + iconSize, y + iconSize, iconRadius);
    ctx.arcTo(x + iconSize, y + iconSize, x, y + iconSize, iconRadius);
    ctx.arcTo(x, y + iconSize, x, y, iconRadius);
    ctx.arcTo(x, y, x + iconSize, y, iconRadius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(icon, x, y, iconSize, iconSize);
    ctx.restore();
    return true;
  } catch {
    return false;
  }
}

export interface OgComposeResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Compose the branded OG variant: photo fitted to 1200px wide preserving its
 * original aspect ratio, plus a branded footer strip. Returns the blob AND the
 * actual canvas dimensions (height varies per photo). Returns null on ANY
 * failure (caller falls back to the raw photo).
 */
export async function composeOgImageWithFooter(
  photo: Blob,
  tagline: string,
): Promise<OgComposeResult | null> {
  if (typeof document === 'undefined') return null;
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(photo);
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (srcW <= 0 || srcH <= 0) return null;

    const photoHeight = Math.min(
      Math.round(OG_IMAGE_WIDTH * (srcH / srcW)),
      MAX_PHOTO_HEIGHT,
    );
    const fm = resolveFooterMetrics(photoHeight);
    const canvasHeight = photoHeight + fm.footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = OG_IMAGE_WIDTH;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (photoHeight < Math.round(OG_IMAGE_WIDTH * (srcH / srcW))) {
      const crop = computeCoverCrop(srcW, srcH, OG_IMAGE_WIDTH, photoHeight);
      if (!crop) return null;
      ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, OG_IMAGE_WIDTH, photoHeight);
    } else {
      ctx.drawImage(img, 0, 0, OG_IMAGE_WIDTH, photoHeight);
    }

    const footerTop = photoHeight;
    ctx.fillStyle = COLORS.footer;
    ctx.fillRect(0, footerTop, OG_IMAGE_WIDTH, fm.footerHeight);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, footerTop, OG_IMAGE_WIDTH, ACCENT_BAR_HEIGHT);

    const iconY = footerTop + (fm.footerHeight - fm.iconSize + ACCENT_BAR_HEIGHT) / 2;
    const hasIcon = await drawIcon(ctx, fm.paddingX, iconY, fm.iconSize, fm.iconRadius);
    const textX = hasIcon ? fm.paddingX + fm.iconSize + fm.textGap : fm.paddingX;
    const textY = footerTop + ACCENT_BAR_HEIGHT + (fm.footerHeight - ACCENT_BAR_HEIGHT) / 2;

    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.brand;
    ctx.font = `700 ${fm.brandFontSize}px ${FONT}`;
    const brand = 'TripPilot';
    ctx.fillText(brand, textX, textY);
    const brandWidth = ctx.measureText(brand).width;

    ctx.fillStyle = COLORS.tagline;
    ctx.font = `400 ${fm.taglineFontSize}px ${FONT}`;
    const taglineX = textX + brandWidth + fm.taglineGap;
    const maxTagline = OG_IMAGE_WIDTH - fm.paddingX - taglineX;
    if (maxTagline > 40) {
      ctx.fillText(truncateToWidth(ctx, `· ${tagline}`, maxTagline), taglineX, textY);
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) return null;
    return { blob, width: OG_IMAGE_WIDTH, height: canvasHeight };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
