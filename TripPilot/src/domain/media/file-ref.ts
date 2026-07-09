import { z } from 'zod';

/**
 * A reference to a shared file (PDF, document, spreadsheet, etc.) stored on R2
 * as access-controlled plaintext. Reuses the same R2 infrastructure as ImageRef
 * (DEC-348) but carries metadata relevant for non-visual files: a human-facing
 * name, an optional description, and the byte size (for download UX).
 *
 * The `r2Id` is the unguessable read capability (same as ImageRef). The Worker
 * serves the blob with the declared `mime` content-type, enabling direct
 * download from both the owner's detail page and the `/g/` guest board.
 */
export type FileVisibility = 'public' | 'after_payment';

export interface FileRef {
  r2Id: string;
  mime: string;
  /** Original file name (e.g. "hotel-reservation.pdf"). */
  name: string;
  /** Optional description set by the uploader (e.g. "Reserva Hotel Marriott Lisboa"). */
  description?: string;
  /** File size in bytes — used for display ("1.2 MB") and cap validation. */
  byteSize: number;
  /** Who can download: everyone immediately, or only after confirming payment. Default: public. */
  visibility?: FileVisibility;
}

/** 10 MB cap for general file uploads (PDFs typically 1–3 MB). */
export const FILE_MAX_BYTES = 10_000_000;

export type FileCapVerdict = { ok: true } | { ok: false; reason: 'empty' | 'too_large' };

export function checkFileBytes(byteLength: number): FileCapVerdict {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return { ok: false, reason: 'empty' };
  if (byteLength > FILE_MAX_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

export const fileRefSchema = z.object({
  r2Id: z.string(),
  mime: z.string(),
  name: z.string(),
  description: z.string().optional(),
  byteSize: z.number().int().nonnegative(),
  visibility: z.enum(['public', 'after_payment']).optional(),
});

/** Format byte size for display (e.g. "1.2 MB", "340 KB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
