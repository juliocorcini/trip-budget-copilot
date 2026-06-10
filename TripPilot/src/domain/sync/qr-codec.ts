import { z } from 'zod';
import { bytesToBase64Url, base64UrlToBytes, compressJson, decompressJson } from './encoding';
import { identityQrSchema } from './identity';
import { statementPayloadSchema } from './statement-payload';

/**
 * DEC-103: every TripPilot QR carries a deflated + base64url JSON envelope
 * with a discriminated `kind`. One scanner understands them all.
 */

const QR_PREFIX = 'TPSYNC1:';

/** Conservative single-QR budget (byte mode tops out at 2953; dense QRs scan poorly). */
export const SINGLE_QR_LIMIT_CHARS = 1600;

export const sessionQrSchema = z.object({
  v: z.literal(1),
  kind: z.literal('session'),
  code: z.string().min(4).max(12),
  key: z.string().min(16),
  purpose: z.enum(['migration', 'statement']),
});

const offerQrSchema = z.object({
  v: z.literal(1),
  kind: z.literal('offer'),
  sdp: z.string().min(1),
});

const answerQrSchema = z.object({
  v: z.literal(1),
  kind: z.literal('answer'),
  sdp: z.string().min(1),
});

const statementQrSchema = z.object({
  v: z.literal(1),
  kind: z.literal('statement'),
  data: statementPayloadSchema,
});

const qrEnvelopeSchema = z.discriminatedUnion('kind', [
  identityQrSchema,
  sessionQrSchema,
  offerQrSchema,
  answerQrSchema,
  statementQrSchema,
]);

export type SessionQrPayload = z.infer<typeof sessionQrSchema>;
export type OfferQrPayload = z.infer<typeof offerQrSchema>;
export type AnswerQrPayload = z.infer<typeof answerQrSchema>;
export type StatementQrPayload = z.infer<typeof statementQrSchema>;
export type QrEnvelope = z.infer<typeof qrEnvelopeSchema>;

export function encodeQrPayload(payload: QrEnvelope): string {
  return QR_PREFIX + bytesToBase64Url(compressJson(payload));
}

export function decodeQrPayload(text: string): QrEnvelope | null {
  if (!text.startsWith(QR_PREFIX)) return null;
  let raw: unknown;
  try {
    raw = decompressJson(base64UrlToBytes(text.slice(QR_PREFIX.length)));
  } catch {
    return null;
  }
  const result = qrEnvelopeSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function fitsInSingleQr(encoded: string): boolean {
  return encoded.length <= SINGLE_QR_LIMIT_CHARS;
}
