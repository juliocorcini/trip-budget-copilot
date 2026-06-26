import { describe, it, expect, afterEach, vi } from 'vitest';
import { uploadImage, imageUrl, fetchDecryptedImageUrl } from '@/data/sync/media-link';
import type { ImageRef } from '@/domain/media';

/**
 * G2 / DEC-348 — the image boundary now uploads PLAINTEXT (real content-type) and
 * serves it from a direct URL. `uploadImage` returns a key-less ref; the legacy
 * decrypt shim is a no-op for plaintext refs (only legacy E2E refs carry a key).
 */
const BASE = 'https://trippilot-sync.trippilot.workers.dev';
const plainRef: ImageRef = { r2Id: 'abc123', mime: 'image/jpeg', w: 1, h: 1 };

/** A minimal Blob stub: the env's jsdom Blob lacks `arrayBuffer()` (real canvas
 *  blobs in the browser have it), so we provide just what `uploadImage` reads. */
function blobOf(bytes: number): Blob {
  return { type: 'image/jpeg', arrayBuffer: async () => new ArrayBuffer(bytes) } as unknown as Blob;
}

afterEach(() => vi.unstubAllGlobals());

describe('media-link (DEC-348 plaintext images)', () => {
  it('imageUrl builds the direct /img/:id URL', () => {
    expect(imageUrl(plainRef)).toBe(`${BASE}/img/abc123`);
  });

  it('uploadImage PUTs the real content-type and returns a key-less ref', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const res = await uploadImage(blobOf(4), { width: 800, height: 600, mimeType: 'image/jpeg' });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ref.key).toBeUndefined();
    expect(res.ref).toMatchObject({ mime: 'image/jpeg', w: 800, h: 600 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`${BASE}/img/${res.ref.r2Id}`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg');
  });

  it('uploadImage refuses an empty blob without a network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await uploadImage(blobOf(0), { width: 1, height: 1, mimeType: 'image/jpeg' });
    expect(res).toEqual({ ok: false, reason: 'empty' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetchDecryptedImageUrl is a no-op for a plaintext ref (no key)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const out = await fetchDecryptedImageUrl(plainRef);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
