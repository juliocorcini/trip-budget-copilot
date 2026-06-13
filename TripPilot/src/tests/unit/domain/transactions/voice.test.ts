import { describe, it, expect } from 'vitest';
import { parseVoiceExpense } from '@/domain/transactions';

describe('parseVoiceExpense (E1 / M11)', () => {
  it('extracts amount and keeps the description', () => {
    const result = parseVoiceExpense('25 mercado');
    expect(result.amountCents).toBe(2_500);
    expect(result.description).toBe('mercado');
  });

  it('drops the leading spend verb (pt-BR)', () => {
    const result = parseVoiceExpense('gastei 12,50 no café');
    expect(result.amountCents).toBe(1_250);
    expect(result.description).toBe('no café');
  });

  it('strips currency words around the number', () => {
    const result = parseVoiceExpense('25 euros mercado');
    expect(result.amountCents).toBe(2_500);
    expect(result.description).toBe('mercado');
  });

  it('handles the dot decimal form (en)', () => {
    const result = parseVoiceExpense('spent 12.50 on lunch');
    expect(result.amountCents).toBe(1_250);
    expect(result.description).toBe('on lunch');
  });

  it('strips the $ / R$ symbols', () => {
    const result = parseVoiceExpense('paguei R$ 30 no táxi');
    expect(result.amountCents).toBe(3_000);
    expect(result.description).toBe('no táxi');
  });

  it('amount only → empty description', () => {
    const result = parseVoiceExpense('15 euros');
    expect(result.amountCents).toBe(1_500);
    expect(result.description).toBe('');
  });

  it('no number → null amount, full text as description', () => {
    const result = parseVoiceExpense('café da manhã');
    expect(result.amountCents).toBeNull();
    expect(result.description).toBe('café da manhã');
  });

  it('empty transcript → empty parse', () => {
    expect(parseVoiceExpense('   ')).toEqual({ amountCents: null, description: '' });
  });

  it('keeps multi-word descriptions intact', () => {
    const result = parseVoiceExpense('café com leite 5');
    expect(result.amountCents).toBe(500);
    expect(result.description).toBe('café com leite');
  });

  it('uses the FIRST number when several are present', () => {
    const result = parseVoiceExpense('3 cervejas 18 reais');
    expect(result.amountCents).toBe(300);
    expect(result.description).toBe('cervejas 18');
  });
});
