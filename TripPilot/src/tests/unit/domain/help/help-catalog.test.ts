import { describe, it, expect } from 'vitest';
import {
  HELP_ARTICLES,
  HELP_SECTION_IDS,
  groupHelpArticlesBySection,
  searchHelp,
  relatedHelpArticles,
  normalizeHelpText,
  helpQuestionKey,
  helpAnswerKey,
  helpStepsKey,
  helpSectionTitleKey,
} from '@/domain/help';
import { GUIDE_SECTIONS } from '@/domain/guide';
import { router } from '@/app/router';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

// FB-28 V1 (DEC-278): the help catalog is the contract between the help center
// and the rest of the app — every article must deep-link to a route that exists,
// resolve to real copy (q + answer + steps) in the three languages, and the set
// of routes must cover every first-class feature (the guide). Search is local,
// so it is fully deterministic and unit-tested here (no AI in V1).

function resolve(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    locale,
  );
}

interface RouteLike {
  path?: string;
  children?: RouteLike[];
}

function collectPaths(routes: RouteLike[], acc: Set<string> = new Set()): Set<string> {
  for (const route of routes) {
    if (route.path) acc.add(route.path.startsWith('/') ? route.path : `/${route.path}`);
    if (route.children) collectPaths(route.children, acc);
  }
  return acc;
}

const ROUTER_PATHS = collectPaths(router.routes as RouteLike[]);
const LOCALES: [string, Record<string, unknown>][] = [
  ['pt-BR', ptBR as unknown as Record<string, unknown>],
  ['en', en as unknown as Record<string, unknown>],
  ['es', es as unknown as Record<string, unknown>],
];

describe('help catalog — structure', () => {
  it('has the eight themed sections and a healthy article count', () => {
    expect(HELP_SECTION_IDS.length).toBe(8);
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(25);
  });

  it('article ids are unique across the whole catalog', () => {
    const ids = HELP_ARTICLES.map((article) => article.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every article has an icon, an absolute route and keywords', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.icon.length, article.id).toBeGreaterThan(0);
      expect(article.route.startsWith('/'), article.id).toBe(true);
      expect(article.keywords.length, article.id).toBeGreaterThan(0);
      expect(HELP_SECTION_IDS.includes(article.section), article.id).toBe(true);
    }
  });

  it('every article route is registered in the router', () => {
    for (const article of HELP_ARTICLES) {
      expect(ROUTER_PATHS.has(article.route), `${article.id} → ${article.route}`).toBe(true);
    }
  });

  it('grouping by section keeps every article exactly once, in section order', () => {
    const groups = groupHelpArticlesBySection();
    const grouped = groups.flatMap((group) => group.articles);
    expect(grouped.length).toBe(HELP_ARTICLES.length);
    expect(new Set(grouped.map((a) => a.id)).size).toBe(HELP_ARTICLES.length);
    const order = groups.map((group) => group.id);
    const expected = HELP_SECTION_IDS.filter((id) => order.includes(id));
    expect(order).toEqual(expected);
  });
});

describe('help catalog — first-class coverage (AC: every feature has an entry)', () => {
  it('covers every route in the feature guide with at least one help article', () => {
    const helpRoutes = new Set(HELP_ARTICLES.map((article) => article.route));
    const guideRoutes = GUIDE_SECTIONS.flatMap((section) => section.entries.map((e) => e.route));
    for (const route of guideRoutes) {
      expect(helpRoutes.has(route), `guide route ${route} has no help article`).toBe(true);
    }
  });
});

describe('help catalog — i18n integrity (3 languages)', () => {
  it.each(LOCALES)('every section title resolves to a string in %s', (_name, locale) => {
    for (const sectionId of HELP_SECTION_IDS) {
      const title = resolve(locale, helpSectionTitleKey(sectionId));
      expect(typeof title, `${sectionId} (${_name})`).toBe('string');
    }
  });

  it.each(LOCALES)('every article resolves to question, answer and steps in %s', (_name, locale) => {
    for (const article of HELP_ARTICLES) {
      const question = resolve(locale, helpQuestionKey(article.id));
      const answer = resolve(locale, helpAnswerKey(article.id));
      const steps = resolve(locale, helpStepsKey(article.id));

      expect(typeof question, `${article.id}.q (${_name})`).toBe('string');
      expect((question as string).length, `${article.id}.q (${_name})`).toBeGreaterThan(10);

      expect(typeof answer, `${article.id}.a (${_name})`).toBe('string');
      expect((answer as string).length, `${article.id}.a (${_name})`).toBeGreaterThan(40);

      expect(Array.isArray(steps), `${article.id}.steps (${_name})`).toBe(true);
      const stepList = steps as unknown[];
      expect(stepList.length, `${article.id}.steps (${_name})`).toBeGreaterThanOrEqual(2);
      for (const step of stepList) {
        expect(typeof step, `${article.id}.step (${_name})`).toBe('string');
        expect((step as string).length, `${article.id}.step (${_name})`).toBeGreaterThan(0);
      }
    }
  });
});

describe('help catalog — local search (0 token)', () => {
  it('normalizes accents and case so "câmbio" === "cambio"', () => {
    expect(normalizeHelpText('Câmbio')).toBe('cambio');
    expect(normalizeHelpText('  Acerto  de   Contas ')).toBe('acerto de contas');
  });

  it('returns nothing for an empty or single-letter query', () => {
    expect(searchHelp('')).toEqual([]);
    expect(searchHelp('   ')).toEqual([]);
    expect(searchHelp('a')).toEqual([]);
  });

  it('ranks the right article first for natural-language doubts', () => {
    expect(searchHelp('dividir conta')[0]?.id).toBe('split');
    expect(searchHelp('câmbio')[0]?.id).toBe('converter');
    expect(searchHelp('exchange currency')[0]?.id).toBe('converter');
    expect(searchHelp('reembolso')[0]?.id).toBe('reimbursement');
    expect(searchHelp('backup')[0]?.id).toBe('backup');
  });

  it('matches across the three languages via keywords', () => {
    expect(searchHelp('split bill').map((a) => a.id)).toContain('split');
    expect(searchHelp('alcancía ahorro').map((a) => a.id)).toContain('piggy');
    expect(searchHelp('localizacao privacidade').map((a) => a.id)).toContain('privacy_location');
  });

  it('only returns articles that actually match a token', () => {
    const results = searchHelp('xyzzy-nonexistent-term');
    expect(results).toEqual([]);
  });
});

describe('help catalog — related questions rail', () => {
  it('returns same-section siblings, never the article itself, capped by limit', () => {
    const related = relatedHelpArticles('split', 3);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.every((article) => article.id !== 'split')).toBe(true);
    const splitSection = HELP_ARTICLES.find((a) => a.id === 'split')!.section;
    expect(related.every((article) => article.section === splitSection)).toBe(true);
  });

  it('returns an empty list for an unknown id', () => {
    expect(relatedHelpArticles('does-not-exist')).toEqual([]);
  });
});
