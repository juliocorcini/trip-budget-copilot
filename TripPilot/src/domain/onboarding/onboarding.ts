import { v4 as uuidv4 } from 'uuid';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';

interface OnboardingInput {
  tripName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  currency: string;
  totalAmountCents: number;
  protectedReserveCents: number;
  ownerName: string;
  deviceId: string;
}

interface OnboardingResult {
  trip: Trip;
  phase: Phase;
  pool: BudgetPool;
  link: BudgetPoolPhaseLink;
  reserve: Envelope | null;
  owner: Participant;
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
    startDate: input.startDate,
    endDate: input.endDate,
    order: 0,
    notes: null,
  };

  const pool: BudgetPool = {
    ...m, id: poolId,
    tripId,
    name: `Fundo ${input.phaseName}`,
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
    name: 'Reserva protegida',
    amountCents: input.protectedReserveCents,
    notes: null,
  } : null;

  const owner: Participant = {
    ...m, id: uuidv4(),
    tripId,
    name: input.ownerName,
    nickname: null,
    isOwner: true,
    email: null,
    linkedUserAccountId: null,
  };

  return { trip, phase, pool, link, reserve, owner };
}
