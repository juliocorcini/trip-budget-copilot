/**
 * DEC-206 (G1): client-side image downscale + compression. Receipt/proof photos
 * arrive as multi-MB files; we store a downscaled JPEG (a few hundred KB) plus a
 * tiny inline thumbnail, so IndexedDB stays light. The dimension math is pure and
 * unit-tested; the canvas encode runs only in the browser.
 */

export interface CompressedImage {
  blob: Blob;
  /** Small JPEG data URL for instant thumbnail rendering. */
  thumbnailDataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
}

const FULL_MAX_DIMENSION = 1600;
const FULL_QUALITY = 0.82;
const THUMB_MAX_DIMENSION = 240;
const THUMB_QUALITY = 0.6;
const OUTPUT_MIME = 'image/jpeg';

/**
 * Scale (width, height) down so the longest side fits `maxDimension`, preserving
 * aspect ratio. Never upscales. Pure — the unit-tested core of the compressor.
 */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxDimension <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

function renderToCanvas(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  const { width, height } = computeScaledDimensions(sourceWidth, sourceHeight, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, height);
  }
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas_to_blob_failed'))),
      OUTPUT_MIME,
      quality,
    );
  });
}

/**
 * Downscale + re-encode a picked image to a storable JPEG plus an inline
 * thumbnail. Compatible with mobile Safari (uses HTMLImageElement, not
 * createImageBitmap). Revokes the temporary object URL once decoded.
 */
export async function compressImageFile(file: File): Promise<CompressedImage> {
  const img = await loadImageElement(file);
  try {
    const fullCanvas = renderToCanvas(img, FULL_MAX_DIMENSION);
    const blob = await canvasToBlob(fullCanvas, FULL_QUALITY);
    const thumbCanvas = renderToCanvas(img, THUMB_MAX_DIMENSION);
    const thumbnailDataUrl = thumbCanvas.toDataURL(OUTPUT_MIME, THUMB_QUALITY);
    return {
      blob,
      thumbnailDataUrl,
      width: fullCanvas.width,
      height: fullCanvas.height,
      mimeType: OUTPUT_MIME,
      byteSize: blob.size,
    };
  } finally {
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  }
}
