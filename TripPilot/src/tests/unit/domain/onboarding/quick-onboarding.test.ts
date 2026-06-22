import { describe, it, expect } from 'vitest';
import {
  buildQuickOnboardingInput,
  createOnboardingEntities,
  type QuickOnboardingValues,
} from '@/domain/onboarding';
import { applyTripPreset, findTripPreset } from '@/domain/profiles';

function baseValues(overrides: Partial<QuickOnboardingValues> = {}): QuickOnboardingValues {
  return {
    tripName: 'My trip',
    currency: 'EUR',
    startDate: '2031-07-01',
    endDate: '2031-07-10',
    totalAmountCents: 100_000,
    ownerName: 'Me',
    ownerEmail: null,
    deviceId: 'dev-1',
    defaultWalletName: 'Card',
    poolName: 'My trip fund',
    reserveName: 'Reserve',
    presetDefaults: null,
    ...overrides,
  };
}

describe('buildQuickOnboardingInput (E1 / M16)', () => {
  it('mirrors the phase to the trip and defaults the optional fields', () => {
    const input = buildQuickOnboardingInput(baseValues());
    expect(input.phaseName).toBe('My trip');
    expect(input.phaseStartDate).toBeNull();
    expect(input.phaseEndDate).toBeNull();
    expect(input.cashWalletName).toBeNull();
    expect(input.protectedReserveCents).toBe(0);
    expect(input.rhythmPreset).toBeNull();
    expect(input.peakDays).toBeNull();
  });

  it('applies the preset defaults (rhythm, peak days, reserve)', () => {
    const preset = findTripPreset('urban')!;
    const input = buildQuickOnboardingInput(
      baseValues({ presetDefaults: applyTripPreset(preset, 100_000) }),
    );
    expect(input.rhythmPreset).toBe('moderate');
    expect(input.peakDays).toEqual([5, 6]);
    expect(input.protectedReserveCents).toBe(10_000); // 10% of €1.000
  });

  it('produces entities that create a protected reserve when the preset has one', () => {
    const preset = findTripPreset('family')!;
    const input = buildQuickOnboardingInput(
      baseValues({ totalAmountCents: 200_000, presetDefaults: applyTripPreset(preset, 200_000) }),
    );
    const entities = createOnboardingEntities(input);
    expect(entities.trip.name).toBe('My trip');
    expect(entities.phase.name).toBe('My trip');
    expect(entities.pool.totalAmountCents).toBe(200_000);
    // 15% of €2.000 = €300 protected reserve.
    expect(entities.reserve?.amountCents).toBe(30_000);
    // Quick path: a single default wallet, no cash wallet.
    expect(entities.wallets).toHaveLength(1);
  });

  it('creates no reserve envelope without a preset', () => {
    const entities = createOnboardingEntities(buildQuickOnboardingInput(baseValues()));
    expect(entities.reserve).toBeNull();
  });

  it('DEC-252: threads the optional owner e-mail into the owner participant', () => {
    const entities = createOnboardingEntities(
      buildQuickOnboardingInput(baseValues({ ownerName: 'Julio', ownerEmail: '  julio@trip.app  ' })),
    );
    expect(entities.owner.name).toBe('Julio');
    // Trimmed, stored locally on the owner participant.
    expect(entities.owner.email).toBe('julio@trip.app');
  });

  it('DEC-252: a blank e-mail folds to null (never an empty string)', () => {
    const entities = createOnboardingEntities(
      buildQuickOnboardingInput(baseValues({ ownerEmail: '   ' })),
    );
    expect(entities.owner.email).toBeNull();
  });
});
