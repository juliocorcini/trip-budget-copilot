import { describe, it, expect } from 'vitest';
import { parseAssistantIntents, parseAssistantResponse } from '@/domain/assistant/intent';

/**
 * AI Quick Entry (DEC-246 · multi-action) — the cloud router now returns ONE
 * `AiIntent` per money event wrapped in `{ actions: [...] }`. These tests pin the
 * untrusted-input contract of `parseAssistantIntents`: every accepted shape (new
 * + legacy), liberal coercion, and graceful failure. `parseAssistantResponse`
 * (single-intent back-compat) must keep returning the FIRST event.
 */

describe('parseAssistantIntents — response shapes', () => {
  it('parses the multi-action wrapper { actions: [...] } into N intents in order', () => {
    const raw = {
      actions: [
        { action: 'someone_paid', person: 'Bruno', amount: 2, description: 'sorvete' },
        { action: 'log_expense', amount: 4, description: 'estacionamento' },
      ],
    };
    const result = parseAssistantIntents(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(2);
    expect(result.intents[0]!.action).toBe('someone_paid');
    expect(result.intents[0]!.person).toBe('Bruno');
    expect(result.intents[1]!.action).toBe('log_expense');
    expect(result.intents[1]!.amount).toBe(4);
  });

  it('parses a JSON STRING wrapper (model returns text, not an object)', () => {
    const raw = JSON.stringify({
      actions: [
        { action: 'split_expense', amount: 10, participants: ['Bruno', 'Débora'] },
      ],
    });
    const result = parseAssistantIntents(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]!.participants).toEqual(['Bruno', 'Débora']);
  });

  it('parses a bare array of intents', () => {
    const raw = [
      { action: 'log_expense', amount: 5 },
      { action: 'record_income', amount: 20 },
    ];
    const result = parseAssistantIntents(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents.map((i) => i.action)).toEqual(['log_expense', 'record_income']);
  });

  it('parses the legacy { intent: {...} } single-object wrapper', () => {
    const result = parseAssistantIntents({ intent: { action: 'log_expense', amount: 3 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]!.action).toBe('log_expense');
  });

  it('parses the legacy { intents: [...] } wrapper', () => {
    const result = parseAssistantIntents({ intents: [{ action: 'log_expense', amount: 1 }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(1);
  });

  it('parses a bare single intent object (no wrapper)', () => {
    const result = parseAssistantIntents({ action: 'log_expense', amount: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]!.amount).toBe(7);
  });

  it('drops non-object members but keeps the valid ones', () => {
    const raw = { actions: [null, 'garbage', 42, { action: 'log_expense', amount: 9 }] };
    const result = parseAssistantIntents(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]!.amount).toBe(9);
  });

  it('fails on an empty actions array', () => {
    expect(parseAssistantIntents({ actions: [] })).toEqual({ ok: false, error: 'invalid' });
  });

  it('fails on invalid JSON string', () => {
    expect(parseAssistantIntents('{not json')).toEqual({ ok: false, error: 'invalid' });
  });

  it('fails on null / undefined', () => {
    expect(parseAssistantIntents(null)).toEqual({ ok: false, error: 'invalid' });
    expect(parseAssistantIntents(undefined)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('parseAssistantIntents — liberal field coercion (untrusted model)', () => {
  it('coerces a pt-BR comma amount and a currency symbol', () => {
    const result = parseAssistantIntents({ actions: [{ action: 'log_expense', amount: '12,80', currency: '€' }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents[0]!.amount).toBe(12.8);
    expect(result.intents[0]!.currency).toBe('EUR');
  });

  it('degrades an unknown action to "unknown" instead of failing', () => {
    const result = parseAssistantIntents({ actions: [{ action: 'launch_rocket', amount: 1 }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents[0]!.action).toBe('unknown');
  });

  it('normalizes a single-string participants field into an array', () => {
    const result = parseAssistantIntents({ actions: [{ action: 'split_expense', amount: 10, participants: 'Bruno' }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intents[0]!.participants).toEqual(['Bruno']);
  });
});

describe('parseAssistantResponse — single-intent back-compat', () => {
  it('returns the FIRST event of a multi-action response', () => {
    const raw = {
      actions: [
        { action: 'someone_paid', person: 'Bruno', amount: 2 },
        { action: 'log_expense', amount: 4 },
      ],
    };
    const result = parseAssistantResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.action).toBe('someone_paid');
    expect(result.intent.person).toBe('Bruno');
  });

  it('still parses a legacy single intent', () => {
    const result = parseAssistantResponse({ action: 'log_expense', amount: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.amount).toBe(5);
  });

  it('fails on empty/invalid input', () => {
    expect(parseAssistantResponse({ actions: [] })).toEqual({ ok: false, error: 'invalid' });
  });
});
