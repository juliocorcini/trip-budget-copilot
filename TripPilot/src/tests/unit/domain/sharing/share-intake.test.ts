import { describe, it, expect } from 'vitest';
import { parseSharedExpense } from '@/domain/sharing';

// E6 (M21): Web Share Target only PRE-FILLS quick-add (never auto-saves). The
// parser pulls a money value + description out of the shared title/text/url.
describe('Web Share Target intake parser (E6 M21)', () => {
  it('pulls a plain decimal amount out of shared text', () => {
    const result = parseSharedExpense({ text: 'Lunch 12.50 at the cafe' });
    expect(result.amount).toBe(12.5);
    expect(result.description).toBe('Lunch 12.50 at the cafe');
  });

  it('parses a comma decimal and prefers the title for the description', () => {
    const result = parseSharedExpense({ title: 'Café', text: '3,50' });
    expect(result.amount).toBe(3.5);
    expect(result.description).toBe('Café');
  });

  it('parses grouped thousands in both conventions', () => {
    expect(parseSharedExpense({ text: '1.234,56' }).amount).toBe(1234.56);
    expect(parseSharedExpense({ text: '1,234.56' }).amount).toBe(1234.56);
  });

  it('takes the first money-like token from title + text', () => {
    const result = parseSharedExpense({ title: 'Receipt', text: 'Total 25 EUR, tip 3' });
    expect(result.amount).toBe(25);
  });

  it('returns a null amount when no money-like token exists', () => {
    const result = parseSharedExpense({ text: 'hello world' });
    expect(result.amount).toBeNull();
    expect(result.description).toBe('hello world');
  });

  it('ignores zero as a positive amount', () => {
    expect(parseSharedExpense({ text: '0' }).amount).toBeNull();
  });

  it('falls back to the URL for the description and never reads money from it', () => {
    const result = parseSharedExpense({ url: 'https://shop.example/item/42' });
    expect(result.amount).toBeNull();
    expect(result.description).toBe('https://shop.example/item/42');
  });

  it('returns an empty intake with no inputs', () => {
    const result = parseSharedExpense({});
    expect(result.amount).toBeNull();
    expect(result.description).toBe('');
  });
});
