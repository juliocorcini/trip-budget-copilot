/**
 * DEC-351 (F16, G5) — every app QR is a URL.
 *
 * A QR that encodes a raw `TPSYNC1:<base64url>` envelope shows gibberish when a
 * phone's DEFAULT camera scans it. So every QR the app renders is instead a real
 * `https://…/<route>#<payload>` URL: a default camera opens a working deep link
 * (the app if installed, otherwise the web route), and the route parses the
 * #fragment and acts. The payload lives in the fragment, which browsers never
 * send to the server — so the static host only ever sees `/<route>` (same
 * client-only secrecy as the existing `/g/`, `/s/`, `/pair` links).
 *
 * Live WebRTC signaling QRs (`session`/`offer`/`answer`) are the explicit
 * carve-out: they are scanned ONLY by the in-app scanner in a guided two-device
 * handshake (a default camera can't act on them), so they stay raw envelopes.
 */

/** The route each QR kind's URL lands on. Group invites already build their own
 * `/g/` URL; these are the two payloads that were still raw (identity, statement). */
export const QR_URL_ROUTES = {
  identity: '/pair',
  statement: '/sync',
} as const;

export type QrUrlKind = keyof typeof QR_URL_ROUTES;

/**
 * Wrap an already-encoded envelope into the shareable/scannable URL for its kind.
 * `origin` is the canonical share origin (never the WebView's `localhost`).
 */
export function buildQrUrl(kind: QrUrlKind, encoded: string, origin: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${QR_URL_ROUTES[kind]}#${encodeURIComponent(encoded)}`;
}

/**
 * Pull the encoded envelope out of scanned/opened QR text — tolerant of BOTH a
 * bare `TPSYNC1:` envelope (legacy QRs, live-signaling QRs, a direct paste) and a
 * full app URL whose #fragment carries it. Returns null only for empty input, so
 * the in-app scanner keeps working through the QR→URL migration.
 */
export function extractQrEnvelope(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex === -1) return trimmed;
  const fragment = trimmed.slice(hashIndex + 1);
  if (fragment.length === 0) return null;
  try {
    return decodeURIComponent(fragment);
  } catch {
    // Malformed percent-encoding — fall back to the raw fragment.
    return fragment;
  }
}
