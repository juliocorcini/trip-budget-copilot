import { describe, it, expect } from 'vitest';
import { composePreview } from '@/features/assistant/assistant-preview-text';
import ptBR from '@/i18n/locales/pt-BR.json';
import type { AssistantPreview } from '@/domain/assistant';

/**
 * Device-test 2026-06-20 regression lock: a 3-way €12 expense someone ELSE paid
 * must read "you owe MY share (€4)", never the full €12. We render through the
 * REAL pt-BR templates (key selection + interpolation) so the test fails if
 * either the branch logic or the copy regresses.
 */

// Minimal i18next-style interpolation over the real pt-BR resource tree.
function translate(key: string, opts?: Record<string, unknown>): string {
  const template = key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }, ptBR as unknown);
  if (typeof template !== 'string') return key;
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    opts && name in opts ? String(opts[name]) : '',
  );
}

const money = (cents?: number): string => `€${((cents ?? 0) / 100).toFixed(2)}`;
const compose = (p: AssistantPreview): string => composePreview(p, translate, money);

const expenseBase: AssistantPreview = {
  op: 'expense',
  amountCents: 1200,
  currency: 'EUR',
  categoryKey: 'other',
};

describe('composePreview — split debt direction (the field bug)', () => {
  it('shows MY per-person share, not the full amount, when someone else paid a split', () => {
    // "Bruno pagou 12 na tortilha, eu ele e a Débora dividimos" → 3-way, Bruno paid.
    const preview: AssistantPreview = {
      ...expenseBase,
      debtDirection: 'i_owe',
      personName: 'Bruno',
      participantNames: ['Você', 'Bruno', 'Débora'],
      perPersonCents: 400,
    };
    const headline = compose(preview);
    expect(headline).toContain('€4.00'); // my share
    expect(headline).toContain('Bruno');
    expect(headline).toBe('Você vai dever €4.00 para Bruno (sua parte de €12.00 ÷ 3)');
    // The exact pre-fix bug string must NEVER appear.
    expect(headline).not.toBe('Você vai dever €12.00 para Bruno');
  });

  it('still shows the FULL amount for a pure "someone paid" (no split)', () => {
    const preview: AssistantPreview = {
      ...expenseBase,
      amountCents: 200,
      debtDirection: 'i_owe',
      personName: 'Bruno',
    };
    expect(compose(preview)).toBe('Você vai dever €2.00 para Bruno');
  });

  it('shows each share when I paid for several who split among themselves (no undefined)', () => {
    const preview: AssistantPreview = {
      ...expenseBase,
      debtDirection: 'owes_me',
      participantNames: ['Ana', 'Bruno'],
      perPersonCents: 600,
    };
    const headline = compose(preview);
    expect(headline).not.toContain('undefined');
    expect(headline).toContain('€6.00');
    expect(headline).toBe('2 pessoas te devem €6.00 cada — €12.00 no total');
  });

  it('shows the full amount when I paid for ONE person (no split)', () => {
    const preview: AssistantPreview = {
      ...expenseBase,
      amountCents: 2000,
      debtDirection: 'owes_me',
      personName: 'Ana',
    };
    expect(compose(preview)).toBe('Ana vai te dever €20.00');
  });
});

describe('composePreview — non-debt expense variants', () => {
  it('splits N ways when I paid and I am a sharer', () => {
    const preview: AssistantPreview = {
      ...expenseBase,
      amountCents: 3500,
      participantNames: ['Você', 'Ana'],
      perPersonCents: 1750,
    };
    expect(compose(preview)).toBe('Dividir €35.00 entre 2 — €17.50 cada');
  });

  it('logs a plain expense', () => {
    expect(compose({ ...expenseBase, amountCents: 1500 })).toBe('Registrar gasto de €15.00');
  });
});

describe('composePreview — other ops', () => {
  it('income', () => {
    expect(compose({ op: 'income', amountCents: 5000, currency: 'EUR' })).toBe(
      'Registrar entrada de €50.00',
    );
  });

  it('navigate uses the nav key', () => {
    expect(compose({ op: 'navigate', navKey: 'scan_receipt' })).toBe(
      translate('assistant.nav.scan_receipt'),
    );
  });

  it('settle with explicit amount (i owe)', () => {
    const out = compose({
      op: 'settle',
      amountCents: 1000,
      currency: 'EUR',
      personName: 'Bruno',
      debtDirection: 'i_owe',
    });
    expect(out).toContain('Bruno');
    expect(out).toContain('€10.00');
  });
});
