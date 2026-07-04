/**
 * DEC-458 — branded footer composited onto share-card photos.
 *
 * When a share has a real photo, the WhatsApp/OG card shows THE PHOTO — but
 * Julio wants the brand strip that the no-photo cards carry ("TripPilot ·
 * Divisão em grupo — veja sua parte") to survive. So the client composes a
 * dedicated 1200×630 OG variant: the photo cover-fitted, plus a footer bar
 * with the app icon, the brand name and the per-kind tagline. The variant is
 * uploaded NEXT TO the original photo (the guest page keeps showing the clean
 * original); only the preview `imgId` points at the composed one.
 *
 * Everything here is best-effort: any failure (no canvas, icon missing, encode
 * error) returns null and the caller falls back to the raw photo id — a share
 * never breaks because of branding.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
const FOOTER_HEIGHT = 96;
const ACCENT_BAR_HEIGHT = 4;
const ICON_SIZE = 56;
const PADDING_X = 40;
const JPEG_QUALITY = 0.85;

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
async function drawIcon(ctx: CanvasRenderingContext2D, x: number, y: number): Promise<boolean> {
  try {
    const icon = await loadImage('/icons/icon-192.png');
    ctx.save();
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ICON_SIZE, y, x + ICON_SIZE, y + ICON_SIZE, r);
    ctx.arcTo(x + ICON_SIZE, y + ICON_SIZE, x, y + ICON_SIZE, r);
    ctx.arcTo(x, y + ICON_SIZE, x, y, r);
    ctx.arcTo(x, y, x + ICON_SIZE, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(icon, x, y, ICON_SIZE, ICON_SIZE);
    ctx.restore();
    return true;
  } catch {
    return false;
  }
}

/**
 * Compose the 1200×630 OG variant: photo cover-fit + branded footer with the
 * localized tagline. Returns null on ANY failure (caller falls back).
 */
export async function composeOgImageWithFooter(
  photo: Blob,
  tagline: string,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(photo);
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const crop = computeCoverCrop(srcW, srcH, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
    if (!crop) return null;

    const canvas = document.createElement('canvas');
    canvas.width = OG_IMAGE_WIDTH;
    canvas.height = OG_IMAGE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      img,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      OG_IMAGE_WIDTH,
      OG_IMAGE_HEIGHT,
    );

    const footerTop = OG_IMAGE_HEIGHT - FOOTER_HEIGHT;
    ctx.fillStyle = COLORS.footer;
    ctx.fillRect(0, footerTop, OG_IMAGE_WIDTH, FOOTER_HEIGHT);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, footerTop, OG_IMAGE_WIDTH, ACCENT_BAR_HEIGHT);

    const iconY = footerTop + (FOOTER_HEIGHT - ICON_SIZE + ACCENT_BAR_HEIGHT) / 2;
    const hasIcon = await drawIcon(ctx, PADDING_X, iconY);
    const textX = hasIcon ? PADDING_X + ICON_SIZE + 24 : PADDING_X;
    const textY = footerTop + ACCENT_BAR_HEIGHT + (FOOTER_HEIGHT - ACCENT_BAR_HEIGHT) / 2;

    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.brand;
    ctx.font = `700 32px ${FONT}`;
    const brand = 'TripPilot';
    ctx.fillText(brand, textX, textY);
    const brandWidth = ctx.measureText(brand).width;

    ctx.fillStyle = COLORS.tagline;
    ctx.font = `400 28px ${FONT}`;
    const taglineX = textX + brandWidth + 18;
    const maxTagline = OG_IMAGE_WIDTH - PADDING_X - taglineX;
    if (maxTagline > 40) {
      ctx.fillText(truncateToWidth(ctx, `· ${tagline}`, maxTagline), taglineX, textY);
    }

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
