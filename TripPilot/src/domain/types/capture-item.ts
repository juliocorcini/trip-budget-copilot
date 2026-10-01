/**
 * Capture Stack (Pilha de Captura): a quick-capture inbox item. The traveler
 * snaps a photo of a receipt/price tag in ONE tap (no review, no friction) and
 * moves on. Later — at the hotel, on the bus — they open the inbox, tap the
 * thumbnail, and the app runs OCR + pre-fills a QuickAdd. DEVICE-LOCAL: never
 * backed up (the photo stays on-device; the expense it becomes IS backed up).
 */
export type CaptureStatus = 'pending' | 'processing' | 'done' | 'error';

export interface CaptureItem {
  id: string;
  tripId: string;
  /** Downscaled, compressed image bytes (already run through the compressor). */
  blob: Blob;
  /** Small JPEG data URL for instant thumbnail rendering in the inbox grid. */
  thumbnailDataUrl: string;
  width: number;
  height: number;
  byteSize: number;
  status: CaptureStatus;
  /** Filled after a successful OCR pass; null while pending or on error. */
  ocrResultJson: string | null;
  /** Human-readable reason when status is 'error'. */
  errorReason: string | null;
  createdAt: string;
}
