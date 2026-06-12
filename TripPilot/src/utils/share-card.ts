/**
 * DEC-133: canvas renderer + OS share sheet for the trip summary card.
 * 1080×1350 (4:5) PNG drawn with the design-system palette. All strings
 * arrive pre-localized — this module only paints and hands off to the OS.
 */

export interface ShareCardRenderInput {
  tripName: string;
  spentDisplay: string;
  subtitle: string;
  dayLine: string;
  topCategoryLine: string | null;
  /** Budget bar fill, 0..100+ (clamped visually at 100). */
  percentUsed: number;
  /** Trip progress marker position, 0..100. */
  dayPercent: number;
}

const W = 1080;
const H = 1350;

const COLORS = {
  background: '#0F1419',
  surface: '#1A2128',
  primary: '#C75B39',
  text: '#F2EDE6',
  textDim: '#9BA3AB',
  barTrack: '#2A3138',
};

const FONT = 'system-ui, -apple-system, sans-serif';

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export async function renderShareCard(input: ShareCardRenderInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const margin = 80;
  const contentWidth = W - margin * 2;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, W, H);

  // Brand mark
  ctx.fillStyle = COLORS.primary;
  ctx.font = `800 38px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText('T R I P P I L O T', margin, 110);

  // Trip name
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText(truncateToWidth(ctx, input.tripName, contentWidth), margin, 190);

  // Spent panel
  const panelY = 360;
  const panelH = 560;
  ctx.fillStyle = COLORS.surface;
  roundedRect(ctx, margin, panelY, contentWidth, panelH, 48);
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = `800 170px ${FONT}`;
  ctx.fillText(
    truncateToWidth(ctx, input.spentDisplay, contentWidth - 120),
    margin + 60,
    panelY + 90,
  );

  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(
    truncateToWidth(ctx, input.subtitle, contentWidth - 120),
    margin + 60,
    panelY + 300,
  );

  // Budget bar + day-pace marker
  const barY = panelY + 410;
  const barW = contentWidth - 120;
  const barH = 26;
  ctx.fillStyle = COLORS.barTrack;
  roundedRect(ctx, margin + 60, barY, barW, barH, 13);
  ctx.fill();

  const fillW = Math.round((Math.min(100, Math.max(0, input.percentUsed)) / 100) * barW);
  if (fillW > 0) {
    ctx.fillStyle = COLORS.primary;
    roundedRect(ctx, margin + 60, barY, Math.max(fillW, barH), barH, 13);
    ctx.fill();
  }

  const markerX = margin + 60 + Math.round((Math.min(100, input.dayPercent) / 100) * barW);
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(markerX - 3, barY - 14, 6, barH + 28);

  // Footer lines
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(truncateToWidth(ctx, input.dayLine, contentWidth), margin, 1030);

  if (input.topCategoryLine) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 42px ${FONT}`;
    ctx.fillText(truncateToWidth(ctx, input.topCategoryLine, contentWidth), margin, 1110);
  }

  ctx.strokeStyle = COLORS.barTrack;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, 1230);
  ctx.lineTo(W - margin, 1230);
  ctx.stroke();

  ctx.fillStyle = COLORS.primary;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('trippilot.pages.dev', margin, 1262);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export type ShareCardOutcome = 'shared' | 'downloaded' | 'aborted' | 'failed';

/** Share via the OS sheet when possible; otherwise download the PNG. */
export async function deliverShareCard(blob: Blob, filename: string): Promise<ShareCardOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'aborted';
      // Fall through to download — some browsers expose canShare but fail.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
