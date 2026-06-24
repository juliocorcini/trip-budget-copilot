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
