import { compressJson, decompressJson, bytesToBase64Url, base64UrlToBytes } from './encoding';
import type { MailboxEnvelope, MailboxPayloadKind } from '@/domain/types/mailbox';

/**
 * FIELD item 8: the plaintext that goes INSIDE the sealed mailbox blob. We
 * deflate-compress the envelope (keeps backups under the worker's per-message
 * cap) and base64url it so it can be handed straight to `seal()`.
 */

const VALID_KINDS: ReadonlySet<MailboxPayloadKind> = new Set([
  'statement',
  'backup',
  'connect',
  'debt',
  'payment',
  'group_invite',
  'debt_move',
]);

export function buildMailboxEnvelope(input: {
  kind: MailboxPayloadKind;
  fromActorId: string;
  fromName: string;
  data: unknown;
}): MailboxEnvelope {
  return {
    v: 1,
    kind: input.kind,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60),
    sentAt: new Date().toISOString(),
    data: input.data,
  };
}

export function packEnvelope(envelope: MailboxEnvelope): string {
  return bytesToBase64Url(compressJson(envelope));
}

export function unpackEnvelope(packed: string): MailboxEnvelope | null {
  try {
    const value = decompressJson(base64UrlToBytes(packed)) as Partial<MailboxEnvelope> | null;
    if (
      value &&
      value.v === 1 &&
      typeof value.kind === 'string' &&
      VALID_KINDS.has(value.kind as MailboxPayloadKind) &&
      typeof value.fromActorId === 'string' &&
      typeof value.fromName === 'string' &&
      'data' in value
    ) {
      return value as MailboxEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}
