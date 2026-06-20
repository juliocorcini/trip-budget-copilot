import { describe, it, expect } from 'vitest';
import {
  createPaymentMethod,
  enabledPaymentMethods,
  resolvePaymentLabel,
  paymentMethodLine,
  buildPaymentInstructions,
  addPaymentMethod,
  removePaymentMethod,
  togglePaymentMethod,
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
