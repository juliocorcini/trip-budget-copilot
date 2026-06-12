import { describe, it, expect } from 'vitest';
import {
  HELP_CONTENT,
  getHelpTopics,
  getHelpTopicTitleKey,
  getHelpTopicBodyKey,
} from '@/domain/help';
import type { HelpScreenId } from '@/domain/help';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

// DEC-121 (R-12): the registry is the contract between screens and copy —
// every declared topic must resolve to real i18n strings in the 3 languages.

const SCREEN_IDS = Object.keys(HELP_CONTENT) as HelpScreenId[];

function resolve(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    locale,
  );
}

describe('help content registry', () => {
  it('covers the six mandatory V1 screens', () => {
    expect(SCREEN_IDS).toEqual(
      expect.arrayContaining(['funds', 'planner', 'wallets', 'phase_edit', 'outing', 'backup']),
    );
  });

  it('every screen starts with an intro topic and has at least 4 topics', () => {
    for (const screenId of SCREEN_IDS) {
      const topics = getHelpTopics(screenId);
      expect(topics.length, screenId).toBeGreaterThanOrEqual(4);
      expect(topics[0]!.id, screenId).toBe('what');
    }
  });

  it('topic ids are unique within each screen', () => {
    for (const screenId of SCREEN_IDS) {
      const ids = getHelpTopics(screenId).map((t) => t.id);
      expect(new Set(ids).size, screenId).toBe(ids.length);
    }
  });

  it.each([
    ['pt-BR', ptBR],
    ['en', en],
    ['es', es],
  ])('every topic resolves to title and body strings in %s', (_name, locale) => {
    for (const screenId of SCREEN_IDS) {
      for (const topic of getHelpTopics(screenId)) {
        const title = resolve(locale as Record<string, unknown>, getHelpTopicTitleKey(screenId, topic.id));
        const body = resolve(locale as Record<string, unknown>, getHelpTopicBodyKey(screenId, topic.id));
        expect(typeof title, `${screenId}.${topic.id}_title`).toBe('string');
        expect(typeof body, `${screenId}.${topic.id}_body`).toBe('string');
        expect((body as string).length, `${screenId}.${topic.id}_body`).toBeGreaterThan(40);
      }
    }
  });

  it('bodies carry concrete examples, not abstract definitions', () => {
    // Spot-check the report's flagship screen: every Funds body brings a
    // concrete amount (€) or an explicit example ("ex.:" / quoted scenario).
    for (const topic of getHelpTopics('funds')) {
      const body = resolve(ptBR as unknown as Record<string, unknown>, getHelpTopicBodyKey('funds', topic.id));
      expect(body, `funds.${topic.id}_body`).toMatch(/€|[Ee]x\.|[Ee]xemplo/);
    }
  });
});
