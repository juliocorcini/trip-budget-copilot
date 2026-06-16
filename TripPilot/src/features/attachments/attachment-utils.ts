import { v4 as uuidv4 } from 'uuid';
import type { CompressedImage } from '@/utils/image/compress';
import type { Attachment } from '@/domain/types/attachment';

/**
 * DEC-206 (G1): build an Attachment record from a compressed image and its owner
 * (an expense OR an outing). Shared by the live `useAttachments` hook and the
 * buffered capture in QuickAdd (where the transaction id only exists after save).
 */
export function newAttachment(
  compressed: CompressedImage,
  target: { transactionId?: string | null; sessionId?: string | null },
): Attachment {
  return {
    id: uuidv4(),
    transactionId: target.transactionId ?? null,
    sessionId: target.sessionId ?? null,
    mimeType: compressed.mimeType,
    blob: compressed.blob,
    thumbnailDataUrl: compressed.thumbnailDataUrl,
    width: compressed.width,
    height: compressed.height,
    byteSize: compressed.byteSize,
    createdAt: new Date().toISOString(),
  };
}
