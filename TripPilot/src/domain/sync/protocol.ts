import { z } from 'zod';
import {
  bytesToBase64,
  base64ToBytes,
  compressJson,
  decompressJson,
  crc32Hex,
} from './encoding';

/**
 * DEC-103: wire protocol for the device-to-device channel. Every frame is a
 * small JSON envelope; large payloads travel deflated + base64 in fixed-size
 * chunks so any transport (DataChannel or encrypted relay) can carry them.
 */

export type SyncPurpose = 'migration' | 'statement';
export type SyncPayloadKind = 'backup' | 'statement';

/** 12 KB keeps frames comfortably below the 16 KB DataChannel guidance. */
export const SYNC_CHUNK_SIZE_BYTES = 12 * 1024;

const helloSchema = z.object({
  t: z.literal('hello'),
  actorId: z.string().uuid(),
  name: z.string().min(1).max(60),
  purpose: z.enum(['migration', 'statement']),
  appVersion: z.string(),
});

const manifestSchema = z.object({
  t: z.literal('manifest'),
  kind: z.enum(['backup', 'statement']),
  totalChunks: z.number().int().positive(),
  totalBytes: z.number().int().positive(),
  checksum: z.string().length(8),
});

const chunkSchema = z.object({
  t: z.literal('chunk'),
  i: z.number().int().min(0),
  data: z.string().min(1),
});

const doneSchema = z.object({ t: z.literal('done') });

const ackSchema = z.object({
  t: z.literal('ack'),
  ok: z.boolean(),
  error: z.string().nullable(),
});

const responsesSchema = z.object({
  t: z.literal('responses'),
  items: z.array(
    z.object({
      shareId: z.string().uuid(),
      status: z.enum(['confirmed', 'rejected']),
    }),
  ),
});

const byeSchema = z.object({ t: z.literal('bye') });

const syncMessageSchema = z.discriminatedUnion('t', [
  helloSchema,
  manifestSchema,
  chunkSchema,
  doneSchema,
  ackSchema,
  responsesSchema,
  byeSchema,
]);

export type HelloMessage = z.infer<typeof helloSchema>;
export type ManifestMessage = z.infer<typeof manifestSchema>;
export type ChunkMessage = z.infer<typeof chunkSchema>;
export type AckMessage = z.infer<typeof ackSchema>;
export type ResponsesMessage = z.infer<typeof responsesSchema>;
export type SyncMessage = z.infer<typeof syncMessageSchema>;

export function encodeSyncMessage(message: SyncMessage): string {
  return JSON.stringify(message);
}

export function parseSyncMessage(raw: string): SyncMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = syncMessageSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export class SyncProtocolError extends Error {
  constructor(public readonly code: 'missing_chunk' | 'checksum_mismatch' | 'invalid_payload') {
    super(code);
    this.name = 'SyncProtocolError';
  }
}

export interface PreparedPayload {
  manifest: ManifestMessage;
  chunks: ChunkMessage[];
}

/** Deflates + slices a payload object into transport-ready frames. */
export function preparePayload(kind: SyncPayloadKind, payload: unknown): PreparedPayload {
  const compressed = compressJson(payload);
  const chunks: ChunkMessage[] = [];
  for (let offset = 0, i = 0; offset < compressed.length; offset += SYNC_CHUNK_SIZE_BYTES, i++) {
    chunks.push({
      t: 'chunk',
      i,
      data: bytesToBase64(compressed.subarray(offset, offset + SYNC_CHUNK_SIZE_BYTES)),
    });
  }
  return {
    manifest: {
      t: 'manifest',
      kind,
      totalChunks: chunks.length,
      totalBytes: compressed.length,
      checksum: crc32Hex(compressed),
    },
    chunks,
  };
}

/** Reassembles and verifies chunks; throws SyncProtocolError on any gap. */
export function assemblePayload(manifest: ManifestMessage, chunks: ChunkMessage[]): unknown {
  const byIndex = new Map(chunks.map((c) => [c.i, c]));
  const parts: Uint8Array[] = [];
  let totalLength = 0;
  for (let i = 0; i < manifest.totalChunks; i++) {
    const chunk = byIndex.get(i);
    if (!chunk) throw new SyncProtocolError('missing_chunk');
    const bytes = base64ToBytes(chunk.data);
    parts.push(bytes);
    totalLength += bytes.length;
  }

  const compressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    compressed.set(part, offset);
    offset += part.length;
  }

  if (compressed.length !== manifest.totalBytes || crc32Hex(compressed) !== manifest.checksum) {
    throw new SyncProtocolError('checksum_mismatch');
  }

  try {
    return decompressJson(compressed);
  } catch {
    throw new SyncProtocolError('invalid_payload');
  }
}
