import { describe, it, expect } from 'vitest';
import { evaluateAmountExpression, parseLocaleNumber } from '@/domain/money';
import { toCents } from '@/domain/money';

describe('parseLocaleNumber', () => {
  it('parses plain integers and decimals', () => {
    expect(parseLocaleNumber('12')).toBe(12);
    expect(parseLocaleNumber('0')).toBe(0);
    expect(parseLocaleNumber('3.50')).toBe(3.5);
  });

  it('treats a single comma as a decimal separator (pt-BR/es)', () => {
    expect(parseLocaleNumber('5,5')).toBe(5.5);
    expect(parseLocaleNumber('3,50')).toBe(3.5);
  });

  it('parses pt-BR thousands + decimal "1.234,56"', () => {
    expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
  });

  it('parses en thousands + decimal "1,234.56"', () => {
    expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
  });

  it('treats repeated dots/commas as thousands grouping', () => {
    expect(parseLocaleNumber('1.234.567')).toBe(1234567);
    expect(parseLocaleNumber('1,234,567')).toBe(1234567);
  });

  it('rejects non-numeric tokens', () => {
    expect(parseLocaleNumber('abc')).toBeNull();
    expect(parseLocaleNumber('')).toBeNull();
    expect(parseLocaleNumber('1.2.3,4')).toBeNull();
  });
});

describe('evaluateAmountExpression', () => {
  it('evaluates addition with a comma decimal: 12+3,50 = 15.50', () => {
    expect(evaluateAmountExpression('12+3,50')).toBe(15.5);
    expect(toCents(evaluateAmountExpression('12+3,50')!)).toBe(1550);
  });

  it('evaluates 12+3,5 = 15.5', () => {
    expect(evaluateAmountExpression('12+3,5')).toBe(15.5);
  });

  it('evaluates multiplication: 10*2 = 20', () => {
    expect(evaluateAmountExpression('10*2')).toBe(20);
  });

  it('evaluates a chain of additions: 5+5+2 = 12', () => {
    expect(evaluateAmountExpression('5+5+2')).toBe(12);
  });

  it('keeps a plain locale number working: 1.234,56', () => {
    expect(evaluateAmountExpression('1.234,56')).toBe(1234.56);
  });

  it('keeps a single comma number working: 5,5', () => {
    expect(evaluateAmountExpression('5,5')).toBe(5.5);
  });

  it('respects operator precedence: 2+3*4 = 14', () => {
    expect(evaluateAmountExpression('2+3*4')).toBe(14);
  });

  it('handles subtraction and division', () => {
    expect(evaluateAmountExpression('20-4,5')).toBe(15.5);
    expect(evaluateAmountExpression('10/4')).toBe(2.5);
  });

  it('tolerates surrounding spaces', () => {
    expect(evaluateAmountExpression(' 12 + 3 ')).toBe(15);
  });

  it('returns null for invalid input (falls back to current parse)', () => {
    expect(evaluateAmountExpression('abc')).toBeNull();
    expect(evaluateAmountExpression('')).toBeNull();
    expect(evaluateAmountExpression('12+')).toBeNull();
    expect(evaluateAmountExpression('+12')).toBeNull();
    expect(evaluateAmountExpression('12++3')).toBeNull();
    expect(evaluateAmountExpression('12 3')).toBeNull();
  });

  it('returns null on division by zero instead of Infinity', () => {
    expect(evaluateAmountExpression('10/0')).toBeNull();
  });

  it('accepts x, X, and × as multiplication aliases', () => {
    expect(evaluateAmountExpression('6x5')).toBe(30);
    expect(evaluateAmountExpression('6X5')).toBe(30);
    expect(evaluateAmountExpression('6×5')).toBe(30);
  });

  it('accepts ÷ as a division alias', () => {
    expect(evaluateAmountExpression('10÷2')).toBe(5);
  });

  it('respects PEMDAS with x aliases: 6x5+5+3x6-3+6+3+6+65x90 = 5915', () => {
    expect(evaluateAmountExpression('6x5+5+3x6-3+6+3+6+65x90')).toBe(5915);
  });
});
