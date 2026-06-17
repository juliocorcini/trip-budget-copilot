import { isNativeApp } from './platform';

/**
 * Canonical public origin of the deployed app.
 *
 * MUST stay in sync with the App Links host in `deep-link.ts`
 * (`APP_LINK_HOSTS`) and the version-manifest host in `app-update.ts`, so a
 * link generated inside the native shell resolves back to the real site (and is
 * the host Android verifies for App Links).
 */
export const PUBLIC_APP_ORIGIN = 'https://trippilot.pages.dev';

/**
 * Origin to embed in shareable links (`/s/:id`, `/pair`).
 *
 * D-BUG-01: inside the Capacitor WebView `window.location.origin` is
 * `https://localhost` (capacitor.config `androidScheme: 'https'`), which would
 * produce dead links that open nowhere. So the native shell always uses the
 * canonical public origin; the web/PWA keeps its real origin (links must work
 * from wherever the page is actually served — apex, preview, or localhost dev).
 */
export function getShareOrigin(): string {
  if (isNativeApp()) return PUBLIC_APP_ORIGIN;
  return window.location.origin;
}
