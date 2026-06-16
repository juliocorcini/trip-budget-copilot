import { describe, it, expect } from 'vitest';
import { newAttachment } from '@/features/attachments/attachment-utils';
import type { CompressedImage } from '@/utils/image/compress';

function makeCompressed(overrides: Partial<CompressedImage> = {}): CompressedImage {
  return {
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    thumbnailDataUrl: 'data:image/jpeg;base64,AAAA',
    width: 1200,
    height: 800,
    mimeType: 'image/jpeg',
    byteSize: 1234,
    ...overrides,
  };
}

describe('newAttachment', () => {
  it('maps every compressed field onto the attachment and binds it to a transaction', () => {
    const compressed = makeCompressed();
    const att = newAttachment(compressed, { transactionId: 'tx-1' });
    expect(att.transactionId).toBe('tx-1');
    expect(att.sessionId).toBeNull();
    expect(att.mimeType).toBe('image/jpeg');
    expect(att.blob).toBe(compressed.blob);
    expect(att.thumbnailDataUrl).toBe(compressed.thumbnailDataUrl);
    expect(att.width).toBe(1200);
    expect(att.height).toBe(800);
    expect(att.byteSize).toBe(1234);
  });

  it('binds to a session when given a sessionId', () => {
    const att = newAttachment(makeCompressed(), { sessionId: 'sess-9' });
    expect(att.sessionId).toBe('sess-9');
    expect(att.transactionId).toBeNull();
  });

  it('defaults both owners to null when neither is provided', () => {
    const att = newAttachment(makeCompressed(), {});
    expect(att.transactionId).toBeNull();
    expect(att.sessionId).toBeNull();
  });

  it('generates a unique id and a round-trippable ISO createdAt per call', () => {
    const a = newAttachment(makeCompressed(), { transactionId: 'tx' });
    const b = newAttachment(makeCompressed(), { transactionId: 'tx' });
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.createdAt).toBe(new Date(a.createdAt).toISOString());
  });
});
