/**
 * DEC-445/446 (G5) — OG injection helpers used by the Pages Function.
 *
 * The module under test lives in `functions/og.ts` (pure, no workers-types)
 * so the same code that decorates crawler HTML is exercised here, including
 * the paranoid guarantees: escaped output, no AES key anywhere, fallback
 * injection when the markers vanish.
 */
import { describe, it, expect } from 'vitest';
import {
  parseShareRoute,
  buildOgTags,
  injectOgTags,
  composeShareOgTags,
} from '../../../../functions/og';

const SHELL = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>TripPilot</title>
    <!-- og:begin -->
    <meta property="og:title" content="TripPilot" />
    <meta property="og:image" content="https://trippilot.pages.dev/og/default.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- og:end -->
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('parseShareRoute', () => {
  it('maps the three share prefixes to their kinds', () => {
    expect(parseShareRoute('/g/churras-do-bruno-x7f2')).toEqual({
      kind: 'group',
      address: 'churras-do-bruno-x7f2',
    });
    expect(parseShareRoute('/t/50624147-e4b4-49f5-a7be-8bc22128ba46')).toEqual({
      kind: 'split',
      address: '50624147-e4b4-49f5-a7be-8bc22128ba46',
    });
    expect(parseShareRoute('/s/abc123')).toEqual({ kind: 'statement', address: 'abc123' });
  });

  it('rejects everything else (other routes, deep paths, junk addresses)', () => {
    expect(parseShareRoute('/')).toBeNull();
    expect(parseShareRoute('/settings')).toBeNull();
    expect(parseShareRoute('/g/a/b')).toBeNull();
    expect(parseShareRoute('/x/abc')).toBeNull();
    expect(parseShareRoute('/g/' + 'a'.repeat(65))).toBeNull();
    expect(parseShareRoute('/g/has%20space')).toBeNull();
    expect(parseShareRoute('/g/%ZZ')).toBeNull(); // malformed percent-encoding
  });
});

describe('escapeHtml / buildOgTags', () => {
  it('escapes user content so titles cannot break out of the meta tag', () => {
    const tags = buildOgTags({
      title: `"><script>alert(1)</script>`,
      description: `Tom & Jerry's <trip>`,
      imageUrl: 'https://x/img.png',
      pageUrl: 'https://x/g/slug',
    });
    expect(tags).not.toContain('<script>');
    expect(tags).toContain('&quot;&gt;&lt;script&gt;');
    expect(tags).toContain('Tom &amp; Jerry&#39;s &lt;trip&gt;');
  });
});

describe('injectOgTags', () => {
  it('swaps the marked static block for the per-share tags', () => {
    const out = injectOgTags(SHELL, '<meta property="og:title" content="Churras" />');
    expect(out).toContain('content="Churras"');
    expect(out).not.toContain('og:begin');
    expect(out).not.toContain('og/default.png');
    expect(out).toContain('<div id="root"></div>'); // shell intact
  });

  it('falls back to stripping loose metas + injecting before </head> when markers are gone', () => {
    const noMarkers = SHELL.replace('<!-- og:begin -->', '').replace('<!-- og:end -->', '');
    const out = injectOgTags(noMarkers, '<meta property="og:title" content="Churras" />');
    expect(out).toContain('content="Churras"');
    expect(out).not.toContain('og/default.png');
    expect(out.indexOf('Churras')).toBeLessThan(out.indexOf('</head>'));
  });
});

describe('composeShareOgTags', () => {
  const route = { kind: 'group' as const, address: 'churras-x7f2' };
  const origin = 'https://trippilot.pages.dev';
  const workerOrigin = 'https://trippilot-sync.trippilot.workers.dev';

  it('uses preview title/description and the share photo when imgId is present', () => {
    const tags = composeShareOgTags({
      route,
      preview: {
        title: 'Churras do Bruno',
        description: 'Total R$ 620,00 · 5 pessoas',
        imgId: 'AbCd1234_efGh5678',
      },
      origin,
      workerOrigin,
    });
    expect(tags).toContain('content="Churras do Bruno"');
    expect(tags).toContain('Total R$ 620,00 · 5 pessoas');
    expect(tags).toContain(`${workerOrigin}/img/AbCd1234_efGh5678`);
    expect(tags).toContain(`content="${origin}/g/churras-x7f2"`);
  });

  it('falls back to the branded per-kind card and neutral copy on a sparse preview', () => {
    const tags = composeShareOgTags({ route, preview: {}, origin, workerOrigin });
    expect(tags).toContain(`${origin}/og/group.png`);
    expect(tags).toContain('content="TripPilot"');
  });

  it('rejects junk imgId shapes instead of building a broken image URL', () => {
    const tags = composeShareOgTags({
      route,
      preview: { title: 'x', description: 'y', imgId: '../../etc/passwd' },
      origin,
      workerOrigin,
    });
    expect(tags).toContain(`${origin}/og/group.png`);
    expect(tags).not.toContain('passwd');
  });

  it('never emits a key fragment — the injected HTML has no #k= anywhere', () => {
    const tags = composeShareOgTags({
      route,
      preview: { title: 'T', description: 'D' },
      origin,
      workerOrigin,
    });
    const html = injectOgTags(SHELL, tags);
    expect(html).not.toContain('#k=');
    expect(html).not.toContain('writeToken');
  });
});
