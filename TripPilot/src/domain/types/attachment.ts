/**
 * DEC-206 (G1): an image attached to an expense or an outing (receipt, proof,
 * label). Device-local by design — like LocalSnapshot it is NOT a SyncMetadata
 * entity and never participates in BackupData (images do not travel in a backup
 * or across a restore). Exactly one of `transactionId` / `sessionId` is set; the
 * other stays null. The full bytes live in `blob` (already downscaled), with a
 * tiny inline `thumbnailDataUrl` for instant list rendering.
 */
export interface Attachment {
  id: string;
  /** The expense this image belongs to, or null when attached to an outing. */
  transactionId: string | null;
  /** The outing/session this image belongs to, or null for a plain expense. */
  sessionId: string | null;
  mimeType: string;
  /** Downscaled, compressed image bytes (the source of the full-size viewer). */
  blob: Blob;
  /** Small JPEG data URL for thumbnails — avoids object-URL churn in lists. */
  thumbnailDataUrl: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
}
