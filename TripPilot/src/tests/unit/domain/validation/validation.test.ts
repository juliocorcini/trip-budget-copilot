import { describe, it, expect } from 'vitest';
import { createTripInputSchema, createExpenseInputSchema, createWalletInputSchema } from '@/domain/validation';

describe('createTripInputSchema', () => {
  it('validates correct input', () => {
    const input = {
      name: 'Eurotrip 2026',
      baseCurrency: 'EUR',
      startDate: '2026-07-01',
      endDate: '2026-08-15',
    };
    expect(createTripInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects empty name', () => {
    const input = {
      name: '',
      baseCurrency: 'EUR',
      startDate: '2026-07-01',
      endDate: '2026-08-15',
    };
    expect(createTripInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid currency code', () => {
    const input = {
      name: 'Test',
      baseCurrency: 'EURO',
      startDate: '2026-07-01',
      endDate: '2026-08-15',
    };
    expect(createTripInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const input = {
      name: 'Test',
      baseCurrency: 'EUR',
      startDate: '01/07/2026',
      endDate: '2026-08-15',
    };
    expect(createTripInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('createExpenseInputSchema', () => {
  it('validates correct expense', () => {
    const input = {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      phaseId: '550e8400-e29b-41d4-a716-446655440001',
      budgetPoolId: '550e8400-e29b-41d4-a716-446655440002',
      walletId: null,
      amountCents: 1500,
      currency: 'EUR',
      category: 'bar',
      description: 'Cervejas',
    };
    expect(createExpenseInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects zero amount', () => {
    const input = {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      phaseId: '550e8400-e29b-41d4-a716-446655440001',
      budgetPoolId: '550e8400-e29b-41d4-a716-446655440002',
      walletId: null,
      amountCents: 0,
      currency: 'EUR',
      category: 'bar',
      description: 'Test',
    };
    expect(createExpenseInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('createWalletInputSchema', () => {
  it('validates correct wallet', () => {
    const input = {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Wise',
      walletType: 'digital' as const,
      currency: 'EUR',
      initialBalanceCents: 100000,
      isDefault: true,
    };
    expect(createWalletInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects invalid wallet type', () => {
    const input = {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      walletType: 'bitcoin',
      currency: 'EUR',
      initialBalanceCents: 0,
      isDefault: false,
    };
    expect(createWalletInputSchema.safeParse(input).success).toBe(false);
  });
});
