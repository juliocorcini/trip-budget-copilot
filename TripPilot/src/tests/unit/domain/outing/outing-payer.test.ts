import { describe, it, expect } from 'vitest';
import { resolveOutingPayerId } from '@/domain/outing';

const tx = (paidByParticipantId: string | null) => ({ paidByParticipantId });

describe('resolveOutingPayerId (C02/DEC-302)', () => {
  it('returns the payer when every item was paid by the same person', () => {
    expect(resolveOutingPayerId([tx('bruno'), tx('bruno'), tx('bruno')])).toBe('bruno');
  });

  it('returns null when payers differ across items (no single honest answer)', () => {
    expect(resolveOutingPayerId([tx('bruno'), tx('ana')])).toBeNull();
  });

  it('returns null when any item has no payer set (ambiguous)', () => {
    expect(resolveOutingPayerId([tx('bruno'), tx(null)])).toBeNull();
  });

  it('returns null when no item has a payer (a plain solo outing)', () => {
    expect(resolveOutingPayerId([tx(null), tx(null)])).toBeNull();
  });

  it('returns null for an empty outing', () => {
    expect(resolveOutingPayerId([])).toBeNull();
  });

  it('treats an empty-string payer as unset', () => {
    expect(resolveOutingPayerId([tx(''), tx('')])).toBeNull();
  });
});
