import type { SyncMetadata, ScenarioPreset, ScenarioMode, AllocationPriority } from './common';

export interface ScenarioPlan extends SyncMetadata {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  name: string;
  preset: ScenarioPreset;
  isActive: boolean;
  mode: ScenarioMode;
  notes: string | null;
}

export interface ScenarioAllocationItem extends SyncMetadata {
  scenarioPlanId: string;
  activityProfileId: string;
  quantity: number;
  estimatedUnitCostCents: number;
  isLocked: boolean;
  priority: AllocationPriority;
  notes: string | null;
}
