import { describe, it, expect, afterEach } from 'vitest';
import {
  setActiveLanguage,
  getActiveLanguage,
  getActiveIntlLocale,
  getActiveDecimalSeparator,
  translateDatePattern,
} from '@/domain/locale';
import { formatDate, formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';

describe('locale bridge (R6-15/16 · PAR-001/002)', () => {
  afterEach(() => {
    setActiveLanguage('pt-BR');
  });

  it('defaults to pt-BR', () => {
    expect(getActiveLanguage()).toBe('pt-BR');
    expect(getActiveIntlLocale()).toBe('pt-BR');
    expect(getActiveDecimalSeparator()).toBe(',');
  });

  it('falls back to pt-BR for unknown languages', () => {
    setActiveLanguage('fr');
    expect(getActiveLanguage()).toBe('pt-BR');
  });

  it('translates pt reference date patterns for EN and keeps them for ES', () => {
    setActiveLanguage('en');
    expect(translateDatePattern("d 'de' MMMM")).toBe('MMMM d');
    expect(translateDatePattern('dd/MM/yyyy')).toBe('MM/dd/yyyy');

    setActiveLanguage('es');
    expect(translateDatePattern("d 'de' MMMM")).toBe("d 'de' MMMM");
  });

  it('formatDate follows the active language', () => {
    const day = '2026-06-15';
    expect(formatDate(day, "d 'de' MMMM")).toBe('15 de junho');

    setActiveLanguage('en');
    expect(formatDate(day, "d 'de' MMMM")).toBe('June 15');
    expect(formatDate(day)).toBe('06/15/2026');
    expect(formatShortDate(day)).toBe('06/15');

    setActiveLanguage('es');
    expect(formatDate(day, "d 'de' MMMM")).toBe('15 de junio');
    expect(formatShortDate(day)).toBe('15/06');
  });

  it('formatMoney follows the active language by default', () => {
    // 123_456.78 — large enough to force grouping in every locale.
    const cents = 12345678;
    expect(formatMoney(cents, 'EUR')).toContain('123.456,78');

    setActiveLanguage('en');
    expect(formatMoney(cents, 'EUR')).toContain('123,456.78');

    setActiveLanguage('es');
    expect(formatMoney(cents, 'EUR')).toContain('123.456,78');
  });
});
