import { describe, it, expect } from 'vitest';
import { ASSISTANT_EXAMPLE_GROUPS } from '@/features/assistant/assistant-examples';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

/**
 * DEC-246 — the "what can I ask?" helper is a contract between the group registry
 * and the localized copy: every declared group MUST resolve to a real title and a
 * non-empty example list in all three languages, or a user sees a raw i18n key.
 */
const LOCALES: Record<string, Record<string, unknown>> = { 'pt-BR': ptBR, en, es };

function resolve(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    locale,
  );
}

describe('assistant examples helper', () => {
  it('has a stable, de-duplicated set of capability groups', () => {
    const ids = ASSISTANT_EXAMPLE_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'quick_expense',
        'someone_paid',
        'i_paid_for',
        'split',
        'multi',
        'income',
        'wallets',
        'debts',
        'plan',
        'open',
      ]),
    );
  });

  it('every group declares a non-empty Material icon', () => {
    for (const group of ASSISTANT_EXAMPLE_GROUPS) {
      expect(typeof group.icon, group.id).toBe('string');
      expect(group.icon.trim().length, group.id).toBeGreaterThan(0);
    }
  });

  it('every group resolves to a title in all 3 languages', () => {
    for (const [lang, locale] of Object.entries(LOCALES)) {
      for (const group of ASSISTANT_EXAMPLE_GROUPS) {
        const title = resolve(locale, `assistant.examples.groups.${group.id}.title`);
        expect(typeof title, `${lang} · ${group.id}`).toBe('string');
        expect((title as string).trim().length, `${lang} · ${group.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('every group has a non-empty list of non-empty example strings in all 3 languages', () => {
    for (const [lang, locale] of Object.entries(LOCALES)) {
      for (const group of ASSISTANT_EXAMPLE_GROUPS) {
        const items = resolve(locale, `assistant.examples.groups.${group.id}.items`);
        expect(Array.isArray(items), `${lang} · ${group.id}`).toBe(true);
        const list = items as unknown[];
        expect(list.length, `${lang} · ${group.id}`).toBeGreaterThanOrEqual(1);
        for (const item of list) {
          expect(typeof item, `${lang} · ${group.id}`).toBe('string');
          expect((item as string).trim().length, `${lang} · ${group.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the cta + subtitle strings exist in all 3 languages', () => {
    for (const [lang, locale] of Object.entries(LOCALES)) {
      for (const key of ['assistant.examples.cta', 'assistant.examples.subtitle']) {
        const value = resolve(locale, key);
        expect(typeof value, `${lang} · ${key}`).toBe('string');
        expect((value as string).trim().length, `${lang} · ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
