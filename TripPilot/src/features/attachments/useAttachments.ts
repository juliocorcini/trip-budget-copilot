import { useCallback, useEffect, useState } from 'react';
import { attachmentRepository } from '@/data/repositories';
import { compressImageFile } from '@/utils/image/compress';
import { newAttachment } from './attachment-utils';
import type { Attachment } from '@/domain/types/attachment';

export interface UseAttachmentsTarget {
  transactionId?: string | null;
  sessionId?: string | null;
}

export interface UseAttachmentsResult {
  attachments: Attachment[];
  loading: boolean;
  busy: boolean;
  addFromFile: (file: File) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * DEC-206 (G1): loads and mutates the images of one expense (or one outing).
 * Compression happens here so callers only hand over the picked File. Returns
 * `false` from addFromFile when the encode fails, so the UI can surface a toast.
 */
export function useAttachments(target: UseAttachmentsTarget): UseAttachmentsResult {
  const transactionId = target.transactionId ?? null;
  const sessionId = target.sessionId ?? null;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let list: Attachment[] = [];
    if (transactionId) list = await attachmentRepository.getByTransactionId(transactionId);
    else if (sessionId) list = await attachmentRepository.getBySessionId(sessionId);
    setAttachments(list);
    setLoading(false);
  }, [transactionId, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFromFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!transactionId && !sessionId) return false;
      setBusy(true);
      try {
        const compressed = await compressImageFile(file);
        const attachment = newAttachment(compressed, { transactionId, sessionId });
        await attachmentRepository.add(attachment);
        await load();
        return true;
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [transactionId, sessionId, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await attachmentRepository.delete(id);
      await load();
    },
    [load],
  );

  return { attachments, loading, busy, addFromFile, remove, reload: load };
}
