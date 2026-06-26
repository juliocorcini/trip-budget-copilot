/**
 * F19 (Device pairing link): pure helpers for the `/pair` URL.
 *
 * The link is `${origin}/pair#${encoded}` where `encoded` is the SAME compact
 * identity envelope the pairing QR carries (`TPSYNC1:<base64url>`). The payload
 * lives in the URL fragment, which browsers never send to the server, so the
 * static host only ever sees `/pair`. Opening the link lets the recipient (an
 * owner with a trip) pair the sender's device — after an explicit confirmation,
 * exactly like scanning the QR, just shareable through any channel.
 */
import { encodeQrPayload, decodeQrPayload } from './qr-codec';
import { buildIdentityQrPayload, type ActorIdentity, type IdentityQrPayload } from './identity';
import { buildQrUrl, QR_URL_ROUTES } from './qr-url';

export const PAIR_PATH = QR_URL_ROUTES.identity;

/** Wrap an already-encoded identity envelope into a shareable pairing URL.
 * DEC-351: delegates to the single `buildQrUrl` helper so every QR URL is built
 * in one place. */
export function pairLinkFromEncoded(origin: string, encoded: string): string {
  return buildQrUrl('identity', encoded, origin);
}

/** Build the full pairing URL for a device identity (+ optional public key). */
export function buildPairLink(
  origin: string,
  identity: ActorIdentity,
  publicKey?: string | null,
): string {
  return pairLinkFromEncoded(origin, encodeQrPayload(buildIdentityQrPayload(identity, publicKey)));
}

/**
 * Decode the identity payload carried in a `/pair` link hash. Tolerates a
 * leading `#` and percent-encoding; returns null for anything that is not a
 * valid identity envelope so the page can show "broken link".
 */
export function parsePairIdentityFromHash(hash: string): IdentityQrPayload | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length === 0) return null;
  let decodedText: string;
  try {
    decodedText = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding — fall back to the raw fragment.
    decodedText = raw;
  }
  const envelope = decodeQrPayload(decodedText);
  return envelope && envelope.kind === 'identity' ? envelope : null;
}
