import { describe, it, expect } from 'vitest';
import {
  preparePayload,
  assemblePayload,
  parseSyncMessage,
  encodeSyncMessage,
  SyncProtocolError,
  SYNC_CHUNK_SIZE_BYTES,
} from '@/domain/sync';
import type { ChunkMessage, SyncMessage } from '@/domain/sync';

function buildLargePayload(): Record<string, unknown> {
  // ~200 KB of JSON before compression, with enough entropy to span chunks.
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    id: `row-${i}`,
    amountCents: i * 137,
    description: `expense ${i} ${Math.sin(i).toString(36)}`,
    date: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
  }));
  return { kind: 'fixture', rows };
}

describe('sync protocol — chunking', () => {
  it('round-trips a ~200KB payload through manifest + chunks with matching checksum', () => {
    const payload = buildLargePayload();
    const { manifest, chunks } = preparePayload('backup', payload);

    expect(manifest.t).toBe('manifest');
    expect(manifest.kind).toBe('backup');
    expect(manifest.totalChunks).toBe(chunks.length);
    expect(manifest.totalChunks).toBeGreaterThan(1);
    expect(manifest.totalBytes).toBeGreaterThan(0);
    expect(manifest.checksum).toMatch(/^[0-9a-f]{8}$/);

    const result = assemblePayload(manifest, chunks);
    expect(result).toEqual(payload);
  });

  it('keeps every chunk within the transport budget', () => {
    const { chunks } = preparePayload('backup', buildLargePayload());
    for (const chunk of chunks) {
      // base64 expands 4/3 over the 12KB binary slice.
      expect(chunk.data.length).toBeLessThanOrEqual(Math.ceil(SYNC_CHUNK_SIZE_BYTES / 3) * 4);
    }
  });

  it('assembles chunks regardless of arrival order', () => {
    const payload = buildLargePayload();
    const { manifest, chunks } = preparePayload('statement', payload);
    const shuffled = [...chunks].reverse();
    expect(assemblePayload(manifest, shuffled)).toEqual(payload);
  });

  it('detects a corrupted chunk via checksum', () => {
    const { manifest, chunks } = preparePayload('backup', buildLargePayload());
    const corrupted: ChunkMessage[] = chunks.map((c, idx) =>
      idx === 1 ? { ...c, data: c.data.slice(0, -4) + 'AAAA' } : c,
    );
    expect(() => assemblePayload(manifest, corrupted)).toThrow(SyncProtocolError);
  });

  it('detects a missing chunk', () => {
    const { manifest, chunks } = preparePayload('backup', buildLargePayload());
    const incomplete = chunks.filter((c) => c.i !== 0);
    try {
      assemblePayload(manifest, incomplete);
      expect.unreachable();
    } catch (e) {
      expect((e as SyncProtocolError).code).toBe('missing_chunk');
    }
  });
});

describe('sync protocol — messages', () => {
  it('round-trips every message type', () => {
    const messages: SyncMessage[] = [
      {
        t: 'hello',
        actorId: '4f9c8a52-1234-4abc-9def-0123456789ab',
        name: 'Julio',
        purpose: 'migration',
        appVersion: '0.5.0',
      },
      { t: 'manifest', kind: 'backup', totalChunks: 3, totalBytes: 100, checksum: 'deadbeef' },
      { t: 'chunk', i: 0, data: 'QUJD' },
      { t: 'done' },
      { t: 'ack', ok: true, error: null },
      {
        t: 'responses',
        items: [{ shareId: '4f9c8a52-1234-4abc-9def-0123456789ab', status: 'confirmed' }],
      },
      { t: 'bye' },
    ];
    for (const message of messages) {
      expect(parseSyncMessage(encodeSyncMessage(message))).toEqual(message);
    }
  });

  it('rejects malformed messages without throwing', () => {
    expect(parseSyncMessage('not json')).toBeNull();
    expect(parseSyncMessage('{"t":"unknown"}')).toBeNull();
    expect(parseSyncMessage('{"t":"chunk","i":-1,"data":"x"}')).toBeNull();
    expect(parseSyncMessage('{"t":"hello","actorId":"not-uuid","name":"x","purpose":"migration","appVersion":"1"}')).toBeNull();
  });
});
