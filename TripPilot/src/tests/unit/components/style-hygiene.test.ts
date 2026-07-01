import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * G1 foundations — CSS regression guards (UI/UX pass 2026-06-24).
 *  - M01/DEC-285: a global :focus-visible ring exists and is keyboard-only.
 *  - M02/DEC-286: faint/CTA/error contrast tokens are tuned for AA.
 *  - M12: the AI accent lives in tokens (var(--ai*)), never hard-coded hex.
 *  - M19: no `transition-all` utility leaks back into the source.
 * They read the real CSS/source (cwd = project root under vitest), so they stay
 * honest if someone reverts a token later.
 */

const SRC = resolve(process.cwd(), 'src');

/** Recursively collect source files under a dir, skipping the tests folder. */
function collectSourceFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSourceFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
const GLOBALS = resolve(SRC, 'styles/globals.css');
const TOKENS = resolve(SRC, 'styles/tokens.css');

describe('M01 / DEC-285 — global keyboard focus ring', () => {
  const css = readFileSync(GLOBALS, 'utf8');

  it('defines a :focus-visible rule', () => {
    expect(css).toMatch(/:focus-visible\s*\{/);
  });

  it('the focus ring is theme-aware (uses --primary, not a hard-coded color)', () => {
    const block = css.slice(css.indexOf(':focus-visible'));
    expect(block).toContain('var(--primary)');
  });

  it('does not draw the ring on plain :focus (touch/mouse) — only :focus-visible', () => {
    expect(css).toMatch(/:focus:not\(:focus-visible\)\s*\{[^}]*outline:\s*none/);
  });
});

describe('M02 / DEC-286 — AA contrast tokens', () => {
  const tokens = readFileSync(TOKENS, 'utf8');
  const css = readFileSync(GLOBALS, 'utf8');

  it('raises --on-surface-faint above the old 70 alpha in both themes', () => {
    const faints = [
      ...tokens.matchAll(/--on-surface-faint:\s*#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})/g),
    ].map((m) => parseInt(m[1] ?? '', 16));
    expect(faints.length).toBe(2); // dark (:root) + light
    for (const alpha of faints) expect(alpha).toBeGreaterThan(0x70);
  });

  it('the primary CTA renders white text (white-on-terracotta passes AA)', () => {
    // a single non-layered rule so it wins over Tailwind's text utilities.
    expect(css).toMatch(/button\.bg-primary[\s\S]*?color:\s*#fff/i);
  });
});

describe('M12 — AI accent is tokenized, not hard-coded', () => {
  const tokens = readFileSync(TOKENS, 'utf8');

  const AI_TOKENS = [
    '--ai',
    '--ai-2',
    '--ai-strong',
    '--ai-bg-soft',
    '--ai-bg',
    '--ai-border',
    '--ai-glow',
    '--ai-gradient',
  ];

  // The 9 components that previously hard-coded the indigo/violet AI accent.
  const TOKENIZED_FILES = [
    'components/FAB.tsx',
    'components/ActiveSplitBar.tsx',
    'features/assistant/AssistantSheet.tsx',
    'features/comparator/ComparatorPage.tsx',
    'features/expenses/QuickAddPage.tsx',
    'features/expenses/ExpenseListPage.tsx',
    'features/split/ActiveSplitHomeCard.tsx',
    'features/split/SplitResumeSheet.tsx',
    'features/split/SplitHistorySheet.tsx',
  ];

  it('defines every AI token in both themes (dark :root + light)', () => {
    for (const name of AI_TOKENS) {
      const count = [...tokens.matchAll(new RegExp(`${name}:`, 'g'))].length;
      expect(count, `${name} should be defined twice`).toBeGreaterThanOrEqual(2);
    }
  });

  it('no AI hex literal (#6366F1 / #818CF8 / #8B5CF6) leaks into components', () => {
    const offenders: string[] = [];
    for (const rel of TOKENIZED_FILES) {
      const body = readFileSync(resolve(SRC, rel), 'utf8');
      if (/#(6366F1|818CF8|8B5CF6)/i.test(body)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe('M19 — no `transition-all` anti-pattern in source', () => {
  it('every animated element transitions specific properties', () => {
    const files = collectSourceFiles(SRC, ['.tsx', '.ts', '.css']);
    const offenders = files.filter((f) => /transition-all/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(SRC, 'src'))).toEqual([]);
  });
});

describe('C25 / DEC-305 (rev.) — input focus ring removed (field feedback)', () => {
  const css = readFileSync(GLOBALS, 'utf8');

  /** The dedicated input/textarea/select focus rule (selectors + body). */
  function inputFocusBlock(): string {
    const start = css.indexOf('input:focus-visible');
    expect(start, 'an input:focus-visible rule must exist').toBeGreaterThan(-1);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(start, close + 1);
  }

  it('covers text-entry controls (textarea/select/contenteditable too)', () => {
    const block = inputFocusBlock();
    expect(block).toContain('textarea:focus-visible');
    expect(block).toContain('select:focus-visible');
    expect(block).toContain('contenteditable');
  });

  it('does NOT use the terracotta --primary on input focus (no alert-looking ring)', () => {
    expect(inputFocusBlock()).not.toContain('var(--primary)');
  });

  it('drops the glow halo on input focus (box-shadow: none, no --glow)', () => {
    const block = inputFocusBlock();
    expect(block).toMatch(/box-shadow:\s*none/);
    expect(block).not.toContain('var(--glow)');
  });

  // Product Lead decision (Julio, field feedback) — SUPERSEDES DEC-305's neutral
  // ring: travelers disliked ANY border on inputs, even a neutral one. The focus
  // ring is dropped (outline: none). Trade-off acknowledged: keyboard focus on
  // text fields leans on the caret + the browser's native text-field affordance
  // (WCAG 2.4.7) rather than a drawn outline; this is a mobile-first app where
  // input focus is reached by touch, not Tab.
  it('removes the input focus ring entirely (no drawn outline)', () => {
    expect(inputFocusBlock()).toMatch(/outline:\s*none/);
  });
});

describe('C03 / E11 (DEC-331) — scrollbars stay hidden app-wide (permanent lock)', () => {
  const css = readFileSync(GLOBALS, 'utf8');

  it('hides the WebKit scrollbar globally with !important', () => {
    expect(css).toMatch(/\*::-webkit-scrollbar\s*\{[^}]*display:\s*none\s*!important/);
  });

  it('sets scrollbar-width: none !important on every element (the Firefox/Chrome `*` fix)', () => {
    // E11: the !important is the lock — no later utility/inline rule may re-expose a bar.
    expect(css).toMatch(/html,\s*body,\s*\*\s*\{[\s\S]*?scrollbar-width:\s*none\s*!important/);
  });

  it('targets the root document scrollbar explicitly (html/body pseudo — the "bar came back on every screen" fix)', () => {
    // The universal `*` pseudo does not reliably match the viewport scrollbar
    // across Chrome / Android WebView versions; html+body must be named.
    const webkitRule = css.slice(
      css.indexOf('html::-webkit-scrollbar'),
      css.indexOf('}', css.indexOf('html::-webkit-scrollbar')) + 1,
    );
    expect(webkitRule).toContain('html::-webkit-scrollbar');
    expect(webkitRule).toContain('body::-webkit-scrollbar');
    expect(webkitRule).toMatch(/display:\s*none\s*!important/);
  });

  it('hardens the zoomed native viewport (html.cap-native scrollbar — the old-APK WebView vector, Item B)', () => {
    // On an aged Android System WebView the ZOOMED native viewport re-paints the
    // document bar in the zoom coordinate space; the global html/body pseudo is
    // not reliably matched across that boundary, so the native viewport must be
    // named explicitly. This lock prevents the regression from leaking back.
    const idx = css.indexOf('html.cap-native::-webkit-scrollbar');
    expect(idx, 'a html.cap-native viewport scrollbar rule must exist').toBeGreaterThan(-1);
    const rule = css.slice(idx, css.indexOf('}', idx) + 1);
    expect(rule).toContain('html.cap-native::-webkit-scrollbar');
    expect(rule).toContain('html.cap-native body::-webkit-scrollbar');
    expect(rule).toMatch(/display:\s*none\s*!important/);
  });

  it('no source file reintroduces a visible scrollbar (gutter / auto / thin / color / always-on scroll)', () => {
    // Also ban `overflow*: scroll` and the Tailwind `overflow-scroll` utilities —
    // they force an always-on track on some engines, the usual regression vector.
    const files = collectSourceFiles(SRC, ['.tsx', '.ts', '.css']);
    const offenders = files.filter((f) => {
      const body = readFileSync(f, 'utf8');
      return /scrollbar-gutter|scrollbar-width:\s*(auto|thin)|scrollbar-color:|overflow(-[xy])?:\s*scroll|(?:^|[\s"'`])overflow(-[xy])?-scroll(?:[\s"'`]|$)/m.test(
        body,
      );
    });
    expect(offenders.map((f) => f.replace(SRC, 'src'))).toEqual([]);
  });
});

describe('DEC-425 (G1) — Leaflet map surface keeps the scrollbar hidden', () => {
  const css = readFileSync(GLOBALS, 'utf8');

  it('re-asserts scrollbar-width:none on the Leaflet container and its descendants (named, not only the universal `*`)', () => {
    // Leaflet builds its panes/controls at runtime; on some WebView versions the
    // universal pseudo is not reliably matched inside that subtree, so it must be
    // named explicitly (the same reason html/body and html.cap-native #root are).
    expect(css).toMatch(
      /\.leaflet-container,\s*\.leaflet-container \*\s*\{[\s\S]*?scrollbar-width:\s*none\s*!important/,
    );
  });

  it('hides the WebKit scrollbar on the Leaflet container/panes with display:none !important (kills the phantom track)', () => {
    const idx = css.indexOf('.leaflet-container::-webkit-scrollbar');
    expect(idx, 'a .leaflet-container::-webkit-scrollbar rule must exist').toBeGreaterThan(-1);
    const rule = css.slice(idx, css.indexOf('}', idx) + 1);
    expect(rule).toContain('.leaflet-container *::-webkit-scrollbar');
    expect(rule).toContain('.leaflet-pane::-webkit-scrollbar');
    expect(rule).toMatch(/display:\s*none\s*!important/);
  });
});
