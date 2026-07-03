/**
 * DEC-445/446 (G5) — Pages Function injecting per-share Open Graph tags.
 *
 * Scope: `_routes.json` limits invocation to `/g/*`, `/t/*`, `/s/*` — every
 * other route stays on the free static pipeline (`_redirects` SPA fallback +
 * `_headers`). For a share route this Function:
 *
 *   1. fetches the worker's public `GET /preview/:idOrSlug` (short timeout);
 *   2. on success, serves the SPA shell with the static OG block swapped for
 *      per-share tags (title/description/photo composed by the OWNER's app —
 *      summary only, never items or keys: Â-PREVIEW-SUMMARY-ONLY);
 *   3. on ANY failure (no preview, timeout, error) serves the shell untouched
 *      — the link must always open (Â-OLD-LINKS-LIVE).
 *
 * `_headers` does not apply to Function responses, so the DEC-436 security
 * headers are replicated here — the guest pages keep clickjacking protection.
 * No UA sniffing: crawlers and humans get the same HTML (cacheable, simple).
 */
import { parseShareRoute, composeShareOgTags, injectOgTags } from './og';

interface Env {
  ASSETS: Fetcher;
}

const SYNC_WORKER_ORIGIN = 'https://trippilot-sync.trippilot.workers.dev';
const PREVIEW_TIMEOUT_MS = 1500;

/** DEC-436 parity — `public/_headers` values, applied to Function responses. */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), microphone=(self), camera=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return env.ASSETS.fetch(request);
  }

  const url = new URL(request.url);
  const route = parseShareRoute(url.pathname);
  if (!route) return env.ASSETS.fetch(request);

  try {
    const [shellHtml, preview] = await Promise.all([
      fetchSpaShell(env, url.origin),
      fetchPreview(route.address),
    ]);
    if (!shellHtml) return env.ASSETS.fetch(request);

    const html = preview
      ? injectOgTags(
          shellHtml,
          composeShareOgTags({
            route,
            preview,
            origin: url.origin,
            workerOrigin: SYNC_WORKER_ORIGIN,
          }),
        )
      : shellHtml;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Crawlers re-fetch on paste; 60s keeps cards fresh without hammering.
        'Cache-Control': 'public, max-age=60',
        ...SECURITY_HEADERS,
      },
    });
  } catch {
    // Never let OG decoration break the link itself.
    return env.ASSETS.fetch(request);
  }
};

/** SPA shell via the static pipeline (`/` serves index.html directly). */
async function fetchSpaShell(env: Env, origin: string): Promise<string | null> {
  const res = await env.ASSETS.fetch(new Request(`${origin}/`));
  if (!res.ok) return null;
  return res.text();
}

/** Worker preview blob, or null on 404/timeout/error (→ untouched HTML). */
async function fetchPreview(address: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${SYNC_WORKER_ORIGIN}/preview/${encodeURIComponent(address)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
