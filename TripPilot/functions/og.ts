/**
 * DEC-445/446 (G5) — pure helpers for per-share Open Graph injection.
 *
 * Deliberately free of workers-types so the app test suite can import and
 * exercise this module directly (`src/tests/unit/functions/og-inject.test.ts`).
 * The Pages Function (`[[path]].ts`) is the only I/O layer.
 *
 * Â-KEY-IN-FRAGMENT: nothing here ever sees the AES key — fragments never
 * reach the server, and every injected value is HTML-escaped.
 */

export type ShareRouteKind = 'group' | 'split' | 'statement';

export interface ShareRoute {
  kind: ShareRouteKind;
  /** Slug or raw share id, exactly as it appears in the path segment. */
  address: string;
}

/** Summary blob served by the sync worker's `GET /preview/:idOrSlug`. */
export interface SharePreviewPayload {
  title?: unknown;
  description?: unknown;
  imgId?: unknown;
}

const PREFIX_TO_KIND: Record<string, ShareRouteKind> = {
  g: 'group',
  t: 'split',
  s: 'statement',
};

/** Slugs (`a-z0-9-`), canonical UUIDs and legacy hex/base64url ids all fit. */
const ADDRESS_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `/g/:x`, `/t/:x`, `/s/:x` (single segment) → share route; anything else
 * (deep paths, bad chars) → null so the caller falls through untouched.
 */
export function parseShareRoute(pathname: string): ShareRoute | null {
  const match = pathname.match(/^\/([gts])\/([^/]+)$/);
  if (!match) return null;
  let address: string;
  try {
    address = decodeURIComponent(match[2]!);
  } catch {
    return null;
  }
  if (!ADDRESS_RE.test(address)) return null;
  return { kind: PREFIX_TO_KIND[match[1]!]!, address };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface OgTagsInput {
  title: string;
  description: string;
  /** Absolute image URL (share photo or branded per-kind fallback). */
  imageUrl: string;
  /** Canonical page URL — path only, never a fragment (the key stays client-side). */
  pageUrl: string;
}

/** Composes the replacement `<meta>` block. Every value is escaped. */
export function buildOgTags(input: OgTagsInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const image = escapeHtml(input.imageUrl);
  const pageUrl = escapeHtml(input.pageUrl);
  return [
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="TripPilot" />',
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n    ');
}

const OG_BLOCK_RE = /<!-- og:begin -->[\s\S]*?<!-- og:end -->/;
const OG_META_RE = /[ \t]*<meta[^>]+(?:property="og:|name="twitter:)[^>]*>\s*\n?/g;

/**
 * Swaps the marked static OG block for the per-share tags. If the markers are
 * missing (defensive — e.g. an HTML pipeline change), strips loose og/twitter
 * metas and injects before `</head>` instead. Never throws.
 */
export function injectOgTags(html: string, tags: string): string {
  if (OG_BLOCK_RE.test(html)) return html.replace(OG_BLOCK_RE, tags);
  const cleaned = html.replace(OG_META_RE, '');
  const headEnd = cleaned.indexOf('</head>');
  if (headEnd === -1) return cleaned;
  return `${cleaned.slice(0, headEnd)}${tags}\n  ${cleaned.slice(headEnd)}`;
}

const IMG_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export interface ComposeOgInput {
  route: ShareRoute;
  preview: SharePreviewPayload;
  /** Pages origin, e.g. `https://trippilot.pages.dev` (per-request). */
  origin: string;
  /** Sync worker origin serving `GET /img/:id`. */
  workerOrigin: string;
}

/**
 * Preview payload → OG tag block. Untrusted fields are type-checked and
 * clamped here again even though the worker already sanitized them (defense
 * in depth — this HTML goes straight to crawlers).
 */
export function composeShareOgTags(input: ComposeOgInput): string {
  const { route, preview, origin, workerOrigin } = input;
  const title =
    typeof preview.title === 'string' && preview.title.length > 0
      ? preview.title.slice(0, 120)
      : 'TripPilot';
  const description =
    typeof preview.description === 'string' && preview.description.length > 0
      ? preview.description.slice(0, 300)
      : 'Divisão de contas no TripPilot';
  const imageUrl =
    typeof preview.imgId === 'string' && IMG_ID_RE.test(preview.imgId)
      ? `${workerOrigin}/img/${encodeURIComponent(preview.imgId)}`
      : `${origin}/og/${route.kind}.png`;
  const prefix = route.kind === 'group' ? 'g' : route.kind === 'split' ? 't' : 's';
  const pageUrl = `${origin}/${prefix}/${encodeURIComponent(route.address)}`;
  return buildOgTags({ title, description, imageUrl, pageUrl });
}
