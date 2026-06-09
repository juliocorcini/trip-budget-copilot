import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { ScenarioPreset, AllocationPriority } from '@/domain/types/common';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface CreateScenarioPlanInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  name: string;
  preset: ScenarioPreset;
}

export function createScenarioPlan(input: CreateScenarioPlanInput): ScenarioPlan {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    name: input.name,
    preset: input.preset,
    isActive: true,
    mode: 'manual',
    notes: null,
  };
}

export interface CreateAllocationItemInput {
  scenarioPlanId: string;
  activityProfileId: string;
  quantity: number;
  estimatedUnitCostCents: number;
  isLocked: boolean;
  priority: AllocationPriority;
}

export function createAllocationItem(input: CreateAllocationItemInput): ScenarioAllocationItem {
  return {
    ...createSyncMetadata(),
    scenarioPlanId: input.scenarioPlanId,
    activityProfileId: input.activityProfileId,
    quantity: input.quantity,
    estimatedUnitCostCents: input.estimatedUnitCostCents,
    isLocked: input.isLocked,
    priority: input.priority,
    notes: null,
  };
}

export function calculateOverAllocationCents(
  allocatedCents: number,
  availableCents: number,
): number {
  return Math.max(0, allocatedCents - availableCents);
}
