import { describe, it, expect } from 'vitest';
import {
  createPaymentMethod,
  enabledPaymentMethods,
  resolvePaymentLabel,
  paymentMethodLine,
  buildPaymentInstructions,
  buildPaymentInstructionsForCurrency,
  paymentMethodAppliesTo,
  paymentMethodsForCurrencies,
  sharedPaymentMethodsForCurrencies,
  toSharedPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  togglePaymentMethod,
  togglePaymentMethodCurrency,
  updatePaymentMethod,
  movePaymentMethod,
  type PaymentMethod,
  type PaymentMethodKind,
} from '@/domain/payment';

const kindLabels: Record<PaymentMethodKind, string> = {
  pix: 'Pix',
  wise: 'Wise',
  bank: 'Bank account',
  other: 'Other',
};

function method(overrides: Partial<PaymentMethod>): PaymentMethod {
  return { id: 'm1', kind: 'pix', label: '', value: 'key-1', enabled: true, ...overrides };
}

describe('createPaymentMethod', () => {
  it('trims label and value, enables by default, assigns an id', () => {
    const m = createPaymentMethod('pix', '  CPF  ', '  123.456.789-00  ');
    expect(m.kind).toBe('pix');
    expect(m.label).toBe('CPF');
    expect(m.value).toBe('123.456.789-00');
    expect(m.enabled).toBe(true);
    expect(m.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('gives each created method a distinct id', () => {
    const a = createPaymentMethod('wise', '', '@tag');
    const b = createPaymentMethod('wise', '', '@tag');
    expect(a.id).not.toBe(b.id);
  });
});

describe('enabledPaymentMethods', () => {
  it('keeps only enabled methods that carry a non-empty value', () => {
    const list = [
      method({ id: 'a', enabled: true, value: 'x' }),
      method({ id: 'b', enabled: false, value: 'y' }),
      method({ id: 'c', enabled: true, value: '   ' }),
    ];
    expect(enabledPaymentMethods(list).map((m) => m.id)).toEqual(['a']);
  });
});

describe('resolvePaymentLabel', () => {
  it('uses the method label when present', () => {
    expect(resolvePaymentLabel(method({ label: 'My CPF' }), kindLabels)).toBe('My CPF');
  });
  it('falls back to the kind label when blank', () => {
    expect(resolvePaymentLabel(method({ kind: 'wise', label: '   ' }), kindLabels)).toBe('Wise');
  });
});

describe('paymentMethodLine', () => {
  it('formats "label: value" with the resolved label', () => {
    expect(paymentMethodLine(method({ kind: 'pix', label: '', value: 'a@b.com' }), kindLabels)).toBe(
      'Pix: a@b.com',
    );
  });
});

describe('buildPaymentInstructions', () => {
  it('returns null when there are no usable methods (zero regression)', () => {
    expect(buildPaymentInstructions([], { header: 'Pay via:', kindLabels })).toBeNull();
    const allOff = [method({ enabled: false }), method({ id: 'x', value: '' })];
    expect(buildPaymentInstructions(allOff, { header: 'Pay via:', kindLabels })).toBeNull();
  });

  it('lists enabled methods in order, header first, with bullets', () => {
    const list = [
      method({ id: 'a', kind: 'pix', label: 'CPF', value: '111' }),
      method({ id: 'b', kind: 'wise', label: '', value: '@me', enabled: false }),
      method({ id: 'c', kind: 'bank', label: 'NuConta', value: '0001/55' }),
    ];
    expect(buildPaymentInstructions(list, { header: 'Pode pagar por:', kindLabels })).toBe(
      'Pode pagar por:\n• CPF: 111\n• NuConta: 0001/55',
    );
  });

  it('uses the kind fallback label for methods without their own label', () => {
    const list = [method({ kind: 'wise', label: '', value: '@traveler' })];
    expect(buildPaymentInstructions(list, { header: 'Pay via:', kindLabels })).toBe(
      'Pay via:\n• Wise: @traveler',
    );
  });
});

describe('mutation helpers (pure)', () => {
  it('addPaymentMethod appends a new method without mutating the input', () => {
    const list: PaymentMethod[] = [];
    const next = addPaymentMethod(list, 'pix', 'CPF', '999');
    expect(list).toHaveLength(0);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: 'pix', label: 'CPF', value: '999', enabled: true });
  });

  it('removePaymentMethod drops the matching id', () => {
    const list = [method({ id: 'a' }), method({ id: 'b' })];
    expect(removePaymentMethod(list, 'a').map((m) => m.id)).toEqual(['b']);
  });

  it('togglePaymentMethod flips only the target', () => {
    const list = [method({ id: 'a', enabled: true }), method({ id: 'b', enabled: true })];
    const next = togglePaymentMethod(list, 'a');
    expect(next.find((m) => m.id === 'a')?.enabled).toBe(false);
    expect(next.find((m) => m.id === 'b')?.enabled).toBe(true);
  });

  it('updatePaymentMethod patches only the provided fields', () => {
    const list = [method({ id: 'a', label: 'old', value: 'v', kind: 'pix' })];
    const next = updatePaymentMethod(list, 'a', { label: 'new' });
    expect(next[0]).toMatchObject({ label: 'new', value: 'v', kind: 'pix' });
  });

  it('movePaymentMethod reorders within bounds and is a no-op at the edges', () => {
    const list = [method({ id: 'a' }), method({ id: 'b' }), method({ id: 'c' })];
    expect(movePaymentMethod(list, 'a', 'down').map((m) => m.id)).toEqual(['b', 'a', 'c']);
    expect(movePaymentMethod(list, 'c', 'up').map((m) => m.id)).toEqual(['a', 'c', 'b']);
    expect(movePaymentMethod(list, 'a', 'up').map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(movePaymentMethod(list, 'c', 'down').map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

// DEC-476 — currency scoping: a Pix key only takes BRL, an IBAN only EUR; a
// method with NO scope keeps working for every currency (back-compat).
describe('currency scoping (DEC-476)', () => {
  const pixBRL = method({ id: 'pix', kind: 'pix', label: 'Pix', value: 'cpf', currencies: ['BRL'] });
  const ibanEUR = method({ id: 'iban', kind: 'bank', label: 'IBAN', value: 'DE89…', currencies: ['EUR'] });
  const wiseAll = method({ id: 'wise', kind: 'wise', label: '', value: '@me' }); // unscoped

  it('paymentMethodAppliesTo: unscoped matches everything; scoped matches only its list', () => {
    expect(paymentMethodAppliesTo(wiseAll, 'BRL')).toBe(true);
    expect(paymentMethodAppliesTo(wiseAll, 'JPY')).toBe(true);
    expect(paymentMethodAppliesTo(pixBRL, 'BRL')).toBe(true);
    expect(paymentMethodAppliesTo(pixBRL, 'EUR')).toBe(false);
    expect(paymentMethodAppliesTo(method({ currencies: [] }), 'EUR')).toBe(true); // empty = all
  });

  it('paymentMethodsForCurrencies: a BRL charge gets Pix + Wise, never the EUR-only IBAN', () => {
    const forBRL = paymentMethodsForCurrencies([pixBRL, ibanEUR, wiseAll], ['BRL']);
    expect(forBRL.map((m) => m.id)).toEqual(['pix', 'wise']);
  });

  it('paymentMethodsForCurrencies: multi-currency debt unions the applicable methods', () => {
    const forBoth = paymentMethodsForCurrencies([pixBRL, ibanEUR, wiseAll], ['BRL', 'EUR']);
    expect(forBoth.map((m) => m.id)).toEqual(['pix', 'iban', 'wise']);
  });

  it('paymentMethodsForCurrencies: empty filter = all usable methods (legacy paths)', () => {
    expect(paymentMethodsForCurrencies([pixBRL, ibanEUR, wiseAll], []).map((m) => m.id)).toEqual([
      'pix',
      'iban',
      'wise',
    ]);
  });

  it('buildPaymentInstructionsForCurrency drops non-matching methods and tags scoped ones', () => {
    const text = buildPaymentInstructionsForCurrency([pixBRL, ibanEUR, wiseAll], 'BRL', {
      header: 'Pode pagar por:',
      kindLabels,
    });
    expect(text).toBe('Pode pagar por:\n• Pix (BRL): cpf\n• Wise: @me');
  });

  it('buildPaymentInstructionsForCurrency returns null when nothing can receive it', () => {
    expect(
      buildPaymentInstructionsForCurrency([pixBRL], 'EUR', { header: 'h', kindLabels }),
    ).toBeNull();
  });

  it('togglePaymentMethodCurrency adds, removes, and returns to "all" when emptied', () => {
    const list = [method({ id: 'a' })];
    const scoped = togglePaymentMethodCurrency(list, 'a', 'BRL');
    expect(scoped[0]!.currencies).toEqual(['BRL']);
    const both = togglePaymentMethodCurrency(scoped, 'a', 'EUR');
    expect(both[0]!.currencies).toEqual(['BRL', 'EUR']);
    const back = togglePaymentMethodCurrency(togglePaymentMethodCurrency(both, 'a', 'BRL'), 'a', 'EUR');
    expect(back[0]!.currencies).toEqual([]); // empty = all currencies again
  });

  it('toSharedPaymentMethods redacts ids/disabled and keeps the currency scope', () => {
    const shared = toSharedPaymentMethods([
      pixBRL,
      method({ id: 'off', enabled: false, value: 'x' }),
      wiseAll,
    ]);
    expect(shared).toEqual([
      { kind: 'pix', label: 'Pix', value: 'cpf', currencies: ['BRL'] },
      { kind: 'wise', label: '', value: '@me' },
    ]);
  });

  it('sharedPaymentMethodsForCurrencies filters the guest view by owed currencies', () => {
    const shared = toSharedPaymentMethods([pixBRL, ibanEUR, wiseAll]);
    expect(sharedPaymentMethodsForCurrencies(shared, ['EUR']).map((m) => m.kind)).toEqual([
      'bank',
      'wise',
    ]);
    expect(sharedPaymentMethodsForCurrencies(shared, []).map((m) => m.kind)).toEqual([
      'pix',
      'bank',
      'wise',
    ]);
  });
});
