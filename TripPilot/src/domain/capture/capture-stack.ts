import { v4 as uuidv4 } from 'uuid';
import { db } from '@/data/db/database';
import { compressImageFile, blobToDataUrl } from '@/utils/image/compress';
import { extractReceiptViaCloud } from '@/utils/ai-ocr';
import { logger } from '@/utils/logger';
import type { CaptureItem } from '@/domain/types/capture-item';
import type { ReceiptPlan } from '@/domain/receipt';

/**
 * Quick-capture: compress the file and save it to the capture inbox as
 * 'pending'. Returns the new CaptureItem id. This is the ONE-TAP path —
 * no OCR, no review, just snap and go.
 */
export async function saveCapture(tripId: string, file: File): Promise<string> {
  const compressed = await compressImageFile(file);
  const item: CaptureItem = {
    id: uuidv4(),
    tripId,
    blob: compressed.blob,
    thumbnailDataUrl: compressed.thumbnailDataUrl,
    width: compressed.width,
    height: compressed.height,
    byteSize: compressed.byteSize,
    status: 'pending',
    ocrResultJson: null,
    errorReason: null,
    createdAt: new Date().toISOString(),
  };
  await db.captureInbox.add(item);
  return item.id;
}

/**
 * Process a pending capture: run OCR and update the record in-place.
 * Returns the parsed ReceiptPlan on success, or null on failure.
 */
export async function processCapture(captureId: string): Promise<ReceiptPlan | null> {
  const item = await db.captureInbox.get(captureId);
  if (!item) return null;

  await db.captureInbox.update(captureId, { status: 'processing' });

  try {
    const dataUrl = await blobToDataUrl(item.blob);
    const outcome = await extractReceiptViaCloud(dataUrl);

    if (outcome.ok) {
      await db.captureInbox.update(captureId, {
        status: 'done',
        ocrResultJson: JSON.stringify(outcome.plan),
      });
      return outcome.plan;
    }

    await db.captureInbox.update(captureId, {
      status: 'error',
      errorReason: outcome.error,
    });
    return null;
  } catch (err) {
    logger.error('capture_process_failed', { module: 'capture-stack', captureId }, err);
    await db.captureInbox.update(captureId, {
      status: 'error',
      errorReason: 'failed',
    });
    return null;
  }
}

/** Delete a capture from the inbox. */
export async function deleteCapture(captureId: string): Promise<void> {
  await db.captureInbox.delete(captureId);
}

/** Count pending captures for a trip (used for badge). */
export async function countPendingCaptures(tripId: string): Promise<number> {
  return db.captureInbox.where({ tripId, status: 'pending' }).count();
}

/** Parse a stored OCR result back to a ReceiptPlan. */
export function parseCaptureOcrResult(item: CaptureItem): ReceiptPlan | null {
  if (!item.ocrResultJson) return null;
  try {
    return JSON.parse(item.ocrResultJson) as ReceiptPlan;
  } catch {
    return null;
  }
}
