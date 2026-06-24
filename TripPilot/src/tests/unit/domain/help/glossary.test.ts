import { describe, it, expect } from 'vitest';
import {
  GLOSSARY,
  GLOSSARY_ENTRIES,
  getGlossaryEntry,
  glossaryTermKey,
  glossaryGlossKey,
  glossaryHelpRoute,
  HELP_ARTICLES,
  type GlossaryTermId,
} from '@/domain/help';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

// DEC-289 (M05): the glossary is the single source for money vocabulary. Each
// term must point at a REAL help article (no orphan) and resolve to a term +
// gloss in all three languages, so an InfoDot never shows a blank or dead-ends.
function resolve(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    locale,
  );
}

const LOCALES: [string, Record<string, unknown>][] = [
  ['pt-BR', ptBR as unknown as Record<string, unknown>],
  ['en', en as unknown as Record<string, unknown>],
  ['es', es as unknown as Record<string, unknown>],
];

const TERM_IDS = Object.keys(GLOSSARY) as GlossaryTermId[];

describe('glossary registry — structure (DEC-289)', () => {
  it('exposes a non-empty registry whose ids match their entry id', () => {
    expect(GLOSSARY_ENTRIES.length).toBeGreaterThanOrEqual(3);
    for (const id of TERM_IDS) {
      expect(GLOSSARY[id].id).toBe(id);
      expect(getGlossaryEntry(id)).toBe(GLOSSARY[id]);
    }
  });

  it('has NO orphan: every term maps to a real help article', () => {
    const articleIds = new Set(HELP_ARTICLES.map((article) => article.id));
    for (const id of TERM_IDS) {
      expect(articleIds.has(GLOSSARY[id].articleId), `${id} → ${GLOSSARY[id].articleId}`).toBe(true);
    }
  });

  it('deep-links each term to its article via /help?a=<id>', () => {
    for (const id of TERM_IDS) {
      expect(glossaryHelpRoute(id)).toBe(`/help?a=${GLOSSARY[id].articleId}`);
    }
  });
});

describe('glossary registry — i18n integrity (3 languages)', () => {
  it.each(LOCALES)('every term and gloss resolves to real copy in %s', (_name, locale) => {
    for (const id of TERM_IDS) {
      const term = resolve(locale, glossaryTermKey(id));
      const gloss = resolve(locale, glossaryGlossKey(id));
      expect(typeof term, `${id}.term (${_name})`).toBe('string');
      expect((term as string).length, `${id}.term (${_name})`).toBeGreaterThan(2);
      expect(typeof gloss, `${id}.gloss (${_name})`).toBe('string');
      // A gloss must be a real one-liner, not a stub.
      expect((gloss as string).length, `${id}.gloss (${_name})`).toBeGreaterThan(30);
    }
  });
});
