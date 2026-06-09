import { describe, it, expect } from 'vitest';
import {
  calculateSessionTotal,
  getSessionPercentUsed,
  getProgressiveAlerts,
  calculateNextDrinkImpact,
  endSession,
} from '@/domain/outing';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkTx = (id: string, amount: number): Transaction => ({
  ...meta, id,
  tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1',
  walletId: null, sessionId: 'sess-1', type: 'expense',
  amountCents: amount, personalCostCents: amount, currency: 'EUR',
  baseCurrencyAmountCents: amount, exchangeRate: null,
  category: 'bar', description: 'drink', date: '2026-07-01T22:00:00.000Z',
  isShared: false, paidByParticipantId: null, activityProfileId: null,
  isSpecialOccasion: false, excludeFromLearning: false,
  sourceWalletId: null, targetWalletId: null, settlementId: null,
  adjustmentReason: null, notes: null,
});

const session: Session = {
  ...meta, id: 'sess-1',
  tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1',
  activityProfileId: 'prof-1', status: 'active', name: 'Bar night',
  targetCents: 1500, ceilingCents: 2500, maxCents: 3500,
  startedAt: '2026-07-01T21:00:00.000Z', endedAt: null,
  quickAddValuesCents: [300, 500, 700], avgDrinkPriceCents: 500,
  firedAlertPercents: [], overMaxConfirmedAt: null,
  notes: null,
};

describe('calculateSessionTotal', () => {
  it('sums session expenses', () => {
    expect(calculateSessionTotal([mkTx('t1', 500), mkTx('t2', 700)])).toBe(1200);
  });

  it('ignores deleted', () => {
    const txs = [mkTx('t1', 500), { ...mkTx('t2', 700), deletedAt: '2026-01-01T00:00:00.000Z' }];
    expect(calculateSessionTotal(txs)).toBe(500);
  });
});

describe('getSessionPercentUsed', () => {
  it('calculates percentage', () => {
    expect(getSessionPercentUsed(1250, 2500)).toBe(50);
  });

  it('returns 0 for null limit', () => {
    expect(getSessionPercentUsed(1000, null)).toBe(0);
  });
});

describe('getProgressiveAlerts', () => {
  it('returns alerts at thresholds', () => {
    const alerts = getProgressiveAlerts(2300, session);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.some((a) => a.type === 'danger')).toBe(true);
  });

  it('returns no alerts below 50%', () => {
    const alerts = getProgressiveAlerts(500, session);
    expect(alerts).toHaveLength(0);
  });

  it('returns critical at 100%', () => {
    const alerts = getProgressiveAlerts(2500, session);
    expect(alerts.some((a) => a.type === 'critical')).toBe(true);
  });
});

describe('calculateNextDrinkImpact', () => {
  it('calculates impact correctly', () => {
    const result = calculateNextDrinkImpact(2000, 500, 2500);
    expect(result.afterCents).toBe(2500);
    expect(result.percentAfter).toBe(100);
    expect(result.exceedsCeiling).toBe(false);
  });

  it('detects ceiling breach', () => {
    const result = calculateNextDrinkImpact(2200, 500, 2500);
    expect(result.exceedsCeiling).toBe(true);
  });
});

describe('endSession', () => {
  it('sets status to completed', () => {
    const ended = endSession(session);
    expect(ended.status).toBe('completed');
    expect(ended.endedAt).toBeTruthy();
  });
});
