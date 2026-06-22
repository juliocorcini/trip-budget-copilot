import { v4 as uuidv4 } from 'uuid';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';

export interface OnboardingInput {
  tripName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  currency: string;
  totalAmountCents: number;
  protectedReserveCents: number;
  ownerName: string;
  /** DEC-252: owner e-mail, optional and LOCAL-only (never sent to telemetry). */
  ownerEmail: string | null;
  deviceId: string;
  /** DEC-051: editable default credit card wallet name. */
  defaultWalletName: string;
  /** DEC-051: optional cash wallet name; null skips creation. */
  cashWalletName: string | null;
  /** R5-05: phase dates default to the trip dates when null. */
  phaseStartDate: string | null;
  phaseEndDate: string | null;
  /** R5-05: same semantics as the phase editor — null = uniform. */
  rhythmPreset: Phase['rhythmPreset'];
  peakDays: number[] | null;
  /** PAR-004 (R6-17): generated names come translated from the UI. */
  poolName: string;
  reserveName: string;
}

interface OnboardingResult {
  trip: Trip;
  phase: Phase;
  pool: BudgetPool;
  link: BudgetPoolPhaseLink;
  reserve: Envelope | null;
  owner: Participant;
  wallets: Wallet[];
}

/** E1 (M17): the subset of onboarding fields a trip preset can pre-fill. */
export interface QuickOnboardingPresetDefaults {
  rhythmPreset: Phase['rhythmPreset'];
  peakDays: number[];
  protectedReserveCents: number;
}

export interface QuickOnboardingValues {
  tripName: string;
  currency: string;
  startDate: string;
  endDate: string;
  totalAmountCents: number;
  ownerName: string;
  /** DEC-252: owner e-mail, optional and LOCAL-only (never sent to telemetry). */
  ownerEmail: string | null;
  deviceId: string;
  defaultWalletName: string;
  poolName: string;
  reserveName: string;
  /** Preset suggestions, or null for a bare minimal trip. */
  presetDefaults: QuickOnboardingPresetDefaults | null;
}

/**
 * E1 (M16): builds the full OnboardingInput for the 1-question path. Phase
 * mirrors the trip (single uniform phase), no cash wallet, and the trip preset
 * (if any) supplies rhythm/peak/reserve. Pure — unit-tested in isolation.
 */
export function buildQuickOnboardingInput(values: QuickOnboardingValues): OnboardingInput {
  const preset = values.presetDefaults;
  return {
    tripName: values.tripName,
    phaseName: values.tripName,
    startDate: values.startDate,
    endDate: values.endDate,
    currency: values.currency,
    totalAmountCents: values.totalAmountCents,
    protectedReserveCents: preset?.protectedReserveCents ?? 0,
    ownerName: values.ownerName,
    ownerEmail: values.ownerEmail,
    deviceId: values.deviceId,
    defaultWalletName: values.defaultWalletName,
    cashWalletName: null,
    phaseStartDate: null,
    phaseEndDate: null,
    rhythmPreset: preset?.rhythmPreset ?? null,
    peakDays: preset && preset.peakDays.length > 0 ? preset.peakDays : null,
    poolName: values.poolName,
    reserveName: values.reserveName,
  };
}

export function createOnboardingEntities(input: OnboardingInput): OnboardingResult {
  const now = new Date().toISOString();
  const tripId = uuidv4();
  const phaseId = uuidv4();
  const poolId = uuidv4();
  const m = {
    createdAt: now,
    updatedAt: now,
    deletedAt: null as string | null,
    revision: 1,
    sourceDeviceId: input.deviceId,
  };

  const trip: Trip = {
    ...m, id: tripId,
    name: input.tripName,
    baseCurrency: input.currency,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'active',
    notes: null,
  };

  const phase: Phase = {
    ...m, id: phaseId,
    tripId,
    name: input.phaseName,
    startDate: input.phaseStartDate ?? input.startDate,
    endDate: input.phaseEndDate ?? input.endDate,
    order: 0,
    rhythmPreset: input.rhythmPreset,
    peakDays: input.peakDays,
    notes: null,
  };

  const pool: BudgetPool = {
    ...m, id: poolId,
    tripId,
    name: input.poolName,
    scope: 'linked_phases',
    totalAmountCents: input.totalAmountCents,
    currency: input.currency,
    notes: null,
  };

  const link: BudgetPoolPhaseLink = {
    ...m, id: uuidv4(),
    budgetPoolId: poolId,
    phaseId,
    futureFloorCents: null,
  };

  const reserve: Envelope | null = input.protectedReserveCents > 0 ? {
    ...m, id: uuidv4(),
    budgetPoolId: poolId,
    kind: 'protected_reserve',
    name: input.reserveName,
    amountCents: input.protectedReserveCents,
    notes: null,
  } : null;

  const ownerEmail = input.ownerEmail?.trim();
  const owner: Participant = {
    ...m, id: uuidv4(),
    tripId,
    name: input.ownerName,
    nickname: null,
    isOwner: true,
    email: ownerEmail ? ownerEmail : null,
    linkedUserAccountId: null,
    linkedActorId: null,
  };

  // DEC-051 (GAP-026): every trip starts with a default credit card wallet
  // (editable) plus an optional cash wallet.
  const wallets: Wallet[] = [
    {
      ...m, id: uuidv4(),
      tripId,
      name: input.defaultWalletName,
      walletType: 'credit_card',
      currency: input.currency,
      initialBalanceCents: 0,
      isDefault: true,
      notes: null,
    },
  ];
  if (input.cashWalletName !== null && input.cashWalletName.trim().length > 0) {
    wallets.push({
      ...m, id: uuidv4(),
      tripId,
      name: input.cashWalletName.trim(),
      walletType: 'cash',
      currency: input.currency,
      initialBalanceCents: 0,
      isDefault: false,
      notes: null,
    });
  }

  return { trip, phase, pool, link, reserve, owner, wallets };
}
