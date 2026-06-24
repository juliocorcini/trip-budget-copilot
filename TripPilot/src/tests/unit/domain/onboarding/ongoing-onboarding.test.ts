import { describe, it, expect } from 'vitest';
import {
  buildOngoingOnboardingInput,
  createOnboardingEntities,
  ONGOING_SEED_PHASE_DAYS,
  type OngoingOnboardingValues,
} from '@/domain/onboarding';
import { addDaysIso } from '@/domain/dates';

function baseValues(overrides: Partial<OngoingOnboardingValues> = {}): OngoingOnboardingValues {
  return {
    spaceName: 'My day-to-day',
    currency: 'EUR',
    today: '2031-03-01',
    monthlyBudgetCents: 90_000,
    ownerName: 'Me',
    ownerEmail: null,
    deviceId: 'dev-1',
    defaultWalletName: 'Card',
    poolName: 'Day-to-day fund',
    reserveName: 'Reserve',
    ...overrides,
  };
}

describe('buildOngoingOnboardingInput (DEC-290 — first-run Dia a dia)', () => {
  it("stamps kind 'ongoing' and seeds a bounded ~1-month phase from today", () => {
    const input = buildOngoingOnboardingInput(baseValues());
    expect(input.kind).toBe('ongoing');
    expect(input.startDate).toBe('2031-03-01');
    expect(input.endDate).toBe(addDaysIso('2031-03-01', ONGOING_SEED_PHASE_DAYS));
    expect(input.phaseName).toBe('My day-to-day');
    // A bare continuous space: no reserve, no cash wallet, no rhythm/peak.
    expect(input.protectedReserveCents).toBe(0);
    expect(input.cashWalletName).toBeNull();
    expect(input.rhythmPreset).toBeNull();
    expect(input.peakDays).toBeNull();
    expect(input.phaseStartDate).toBeNull();
    expect(input.phaseEndDate).toBeNull();
  });

  it('maps the optional monthly cap to the pool total and builds a valid active trip', () => {
    const entities = createOnboardingEntities(
      buildOngoingOnboardingInput(baseValues({ monthlyBudgetCents: 120_000 })),
    );
    expect(entities.trip.kind).toBe('ongoing');
    expect(entities.trip.status).toBe('active');
    expect(entities.pool.totalAmountCents).toBe(120_000);
    expect(entities.phase.name).toBe('My day-to-day');
    // Single default wallet (no cash wallet), owner present.
    expect(entities.owner.isOwner).toBe(true);
    expect(entities.wallets).toHaveLength(1);
  });

  it('a zero budget produces a valid "just track, no limit" space (no reserve)', () => {
    const entities = createOnboardingEntities(
      buildOngoingOnboardingInput(baseValues({ monthlyBudgetCents: 0 })),
    );
    expect(entities.trip.kind).toBe('ongoing');
    expect(entities.pool.totalAmountCents).toBe(0);
    expect(entities.reserve).toBeNull();
  });

  it('threads identity (owner name + optional, trimmed, local-only e-mail)', () => {
    const entities = createOnboardingEntities(
      buildOngoingOnboardingInput(baseValues({ ownerName: 'Julio', ownerEmail: '  julio@trip.app  ' })),
    );
    expect(entities.owner.name).toBe('Julio');
    expect(entities.owner.email).toBe('julio@trip.app');
  });
});
