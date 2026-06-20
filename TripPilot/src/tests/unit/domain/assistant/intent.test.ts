import { describe, it, expect } from 'vitest';
import { parseAssistantResponse, isExecuteAction } from '@/domain/assistant/intent';

describe('parseAssistantResponse', () => {
  it('normalizes a well-formed object', () => {
    const result = parseAssistantResponse({
      action: 'someone_paid',
      amount: 2,
      currency: 'EUR',
      person: 'Bruno',
      category: 'cerveja',
      confidence: 0.9,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.action).toBe('someone_paid');
    expect(result.intent.amount).toBe(2);
    expect(result.intent.currency).toBe('EUR');
    expect(result.intent.person).toBe('Bruno');
    expect(result.intent.participants).toEqual([]);
    expect(result.intent.confidence).toBe(0.9);
  });

  it('parses a JSON string payload', () => {
    const result = parseAssistantResponse('{"action":"log_expense","amount":"12,50"}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.action).toBe('log_expense');
    // "12,50" → 12.5 (comma decimal tolerated)
    expect(result.intent.amount).toBe(12.5);
  });

  it('coerces numeric strings and currency symbols', () => {
    const result = parseAssistantResponse({ action: 'log_expense', amount: '7', currency: '€' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.amount).toBe(7);
    expect(result.intent.currency).toBe('EUR');
  });

  it('drops unknown currency words to null (device defaults to base)', () => {
    const result = parseAssistantResponse({ action: 'log_expense', amount: 5, currency: 'euros' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.currency).toBeNull();
  });

  it('maps an unrecognized action to "unknown"', () => {
    const result = parseAssistantResponse({ action: 'teleport', amount: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.action).toBe('unknown');
  });

  it('coerces a single participant string into an array and filters blanks', () => {
    const single = parseAssistantResponse({ action: 'split_expense', participants: 'Ana' });
    const many = parseAssistantResponse({ action: 'split_expense', participants: ['Ana', '', '  '] });
    expect(single.ok && single.intent.participants).toEqual(['Ana']);
    expect(many.ok && many.intent.participants).toEqual(['Ana']);
  });

  it('nulls invalid enum fields and clamps confidence', () => {
    const result = parseAssistantResponse({ action: 'split_expense', payer: 'them', confidence: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.payer).toBeNull();
    expect(result.intent.confidence).toBe(1);
  });

  it('unwraps a { intent: {...} } envelope', () => {
    const result = parseAssistantResponse({ intent: { action: 'record_income', amount: 100 } });
    expect(result.ok && result.intent.action).toBe('record_income');
  });

  it('rejects non-object payloads', () => {
    expect(parseAssistantResponse('not json').ok).toBe(false);
    expect(parseAssistantResponse(42).ok).toBe(false);
    expect(parseAssistantResponse(null).ok).toBe(false);
  });
});

describe('parseAssistantResponse — amount locales', () => {
  const amount = (raw: unknown): number | null => {
    const r = parseAssistantResponse({ action: 'log_expense', amount: raw });
    return r.ok ? r.intent.amount : null;
  };

  it('keeps a plain number', () => {
    expect(amount(12.8)).toBe(12.8);
    expect(amount(1250)).toBe(1250);
  });

  it('reads a comma as the decimal separator (pt-BR/EU)', () => {
    expect(amount('12,80')).toBe(12.8);
    expect(amount('3,50')).toBe(3.5);
  });

  it('reads a dot as a decimal separator when it is the only one (en)', () => {
    expect(amount('12.80')).toBe(12.8);
  });

  it('handles a dot thousands + comma decimal ("1.250,00" → 1250)', () => {
    expect(amount('1.250,00')).toBe(1250);
    expect(amount('2.499,90')).toBe(2499.9);
  });

  it('handles a comma thousands + dot decimal ("1,250.00" → 1250)', () => {
    expect(amount('1,250.00')).toBe(1250);
  });

  it('strips currency symbols and spaces before parsing', () => {
    expect(amount('R$ 1.250,00')).toBe(1250);
    expect(amount('€12,80')).toBe(12.8);
  });

  it('returns null for non-numeric junk', () => {
    expect(amount('abc')).toBeNull();
    expect(amount('')).toBeNull();
  });
});

describe('isExecuteAction', () => {
  it('separates execute actions from navigation/unknown', () => {
    expect(isExecuteAction('someone_paid')).toBe(true);
    expect(isExecuteAction('settle_debt')).toBe(true);
    expect(isExecuteAction('open_scan_receipt')).toBe(false);
    expect(isExecuteAction('open_screen')).toBe(false);
    expect(isExecuteAction('unknown')).toBe(false);
  });
});
