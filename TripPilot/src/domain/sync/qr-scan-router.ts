import { decodeQrPayload, type QrEnvelope } from './qr-codec';
import { extractQrEnvelope } from './qr-url';

/**
 * DEC-373 (G7) — the universal in-app scan router.
 *
 * The field bug: the in-app scanner only acted on the *identity* (connect)
 * payload, so scanning ANY other app QR (an extrato `/sync`, a group `/g/`, a
 * shared link `/s/`, a live split `/t/`) silently did nothing. This pure
 * classifier turns any scanned text into a semantic, routable result so the UI
 * can either act inline (connect), navigate in-app to the matching screen, or
 * fall back to a clear "open the right screen and scan again" message — instead
 * of a dead end.
 *
 * It is the read-side counterpart of `buildQrUrl` (the write side): every QR the
 * app renders is a URL or a `TPSYNC1:` envelope, and this maps both back to an
 * action. Pure — no `window`/router — so the routing rules are unit-testable.
 */

/** The owned host(s) whose scanned URLs the app will route in-app. */
const APP_QR_HOSTS = new Set(['trippilot.pages.dev']);

/**
 * Route prefixes the in-app scanner owns. Deliberately BROADER than
 * `parseDeepLink`'s native-App-Links set (`/pair`, `/s/`): a *scan* should also
 * open `/sync` (extrato), `/g/` (group), and `/t/` (live split). Kept separate
 * so widening the scanner never changes which intents the native shell claims.
 */
const APP_QR_ROUTE_PREFIXES = ['/pair', '/sync', '/s/', '/t/', '/g/', '/x/'] as const;

export type ScannedQr =
  /** A connect/identity payload — the app pairs inline (no navigation). */
  | { kind: 'identity'; payload: Extract<QrEnvelope, { kind: 'identity' }> }
  /** A statement/extrato envelope — routed to the `/sync` receive screen. */
  | { kind: 'statement'; encoded: string }
  /** A live WebRTC handshake QR (session/offer/answer) — only the migration
   *  scanner can act on it; a connect scanner guides the user elsewhere. */
  | { kind: 'live_signal'; envelope: Extract<QrEnvelope, { kind: 'session' | 'offer' | 'answer' }> }
  /** An owned app URL with no inline payload — navigate in-app to this path
   *  (path + search + hash preserved, e.g. `/g/abc`, `/s/abc#k=…`). */
  | { kind: 'app_route'; route: string }
  /** Not a TripPilot QR (or an unreadable one). */
  | { kind: 'unknown' };

/**
 * Pull the in-app route (path + search + hash) out of an owned app URL, or null
 * when the text is not an owned `https://<app-host>/<owned-route>` URL.
 */
function appRouteFromUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!APP_QR_HOSTS.has(url.hostname)) return null;
  const owned = APP_QR_ROUTE_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix),
  );
  if (!owned) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Classify any scanned/pasted text into a routable app action. Order matters:
 * an embedded `TPSYNC1:` envelope (raw, or inside a `/pair#…`/`/sync#…` URL
 * fragment) is resolved first so identity pairs inline; otherwise an owned app
 * URL becomes an in-app navigation; everything else is `unknown`.
 */
export function classifyScannedQr(text: string | null | undefined): ScannedQr {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return { kind: 'unknown' };

  const envelope = extractQrEnvelope(trimmed);
  const decoded = envelope ? decodeQrPayload(envelope) : null;
  if (decoded) {
    if (decoded.kind === 'identity') return { kind: 'identity', payload: decoded };
    if (decoded.kind === 'statement') return { kind: 'statement', encoded: envelope as string };
    return { kind: 'live_signal', envelope: decoded };
  }

  const route = appRouteFromUrl(trimmed);
  if (route) return { kind: 'app_route', route };

  return { kind: 'unknown' };
}
