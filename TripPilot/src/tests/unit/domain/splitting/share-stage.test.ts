import { describe, it, expect } from 'vitest';
import { resolveShareStage } from '@/domain/splitting';

describe('resolveShareStage (C11/DEC-304 share lifecycle)', () => {
  it('rejected wins regardless of isPaid', () => {
    expect(resolveShareStage({ confirmationStatus: 'rejected', isPaid: false })).toBe('rejected');
    expect(resolveShareStage({ confirmationStatus: 'rejected', isPaid: true })).toBe('rejected');
  });

  it('pending = waiting to be accepted (even if flagged paid early)', () => {
    expect(resolveShareStage({ confirmationStatus: 'pending', isPaid: false })).toBe('pending');
    expect(resolveShareStage({ confirmationStatus: 'pending', isPaid: true })).toBe('pending');
  });

  it('confirmed but not paid = accepted, awaiting payment', () => {
    expect(resolveShareStage({ confirmationStatus: 'confirmed', isPaid: false })).toBe('confirmed');
  });

  it('confirmed AND paid = the only "done" stage', () => {
    expect(resolveShareStage({ confirmationStatus: 'confirmed', isPaid: true })).toBe('paid');
  });
});
