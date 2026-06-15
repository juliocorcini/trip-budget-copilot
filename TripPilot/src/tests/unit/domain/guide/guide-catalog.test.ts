import { describe, it, expect } from 'vitest';
import { GUIDE_SECTIONS } from '@/domain/guide';
import { router } from '@/app/router';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

// G7: the catalog is the contract between the guide page and the rest of the
// app — every entry must point to a route that exists and resolve to real copy
// in the three languages, otherwise a "shortcut" would dead-end the user.

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

const ALL_ENTRIES = GUIDE_SECTIONS.flatMap((s) => s.entries);
const ROUTER_PATHS = collectPaths(router.routes as RouteLike[]);

describe('guide catalog', () => {
  it('has sections, each with at least one entry', () => {
    expect(GUIDE_SECTIONS.length).toBeGreaterThanOrEqual(5);
    for (const section of GUIDE_SECTIONS) {
      expect(section.entries.length, section.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('section ids are unique', () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('entry ids are unique across the whole catalog', () => {
    const ids = ALL_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has an icon and an absolute route', () => {
    for (const entry of ALL_ENTRIES) {
      expect(entry.icon.length, entry.id).toBeGreaterThan(0);
      expect(entry.route.startsWith('/'), entry.id).toBe(true);
    }
  });

  it('every entry route is registered in the router', () => {
    for (const entry of ALL_ENTRIES) {
      expect(ROUTER_PATHS.has(entry.route), `${entry.id} → ${entry.route}`).toBe(true);
    }
  });

  it.each([
    ['pt-BR', ptBR],
    ['en', en],
    ['es', es],
  ])('every section title resolves to a string in %s', (_name, locale) => {
    for (const section of GUIDE_SECTIONS) {
      const title = resolve(locale as Record<string, unknown>, section.titleKey);
      expect(typeof title, `${section.id} (${_name})`).toBe('string');
    }
  });

  it.each([
    ['pt-BR', ptBR],
    ['en', en],
    ['es', es],
  ])('every entry title and description resolve to strings in %s', (_name, locale) => {
    for (const entry of ALL_ENTRIES) {
      const title = resolve(locale as Record<string, unknown>, entry.titleKey);
      const desc = resolve(locale as Record<string, unknown>, entry.descKey);
      expect(typeof title, `${entry.id}.title (${_name})`).toBe('string');
      expect(typeof desc, `${entry.id}.desc (${_name})`).toBe('string');
      expect((desc as string).length, `${entry.id}.desc (${_name})`).toBeGreaterThan(10);
    }
  });
});
