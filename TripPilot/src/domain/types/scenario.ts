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
  /**
   * DEC-463 (field 2026-07-04): "planejar a partir de agora" — when set
   * (YYYY-MM-DD), occasions BEFORE this local day do not consume the plan.
   * Julio's case: 15 bar nights already done, then plans 4 MORE — the counter
   * must read "4 restantes", not "0 de 4". null/undefined (existing plans, no
   * migration — non-indexed) keeps the whole-phase count.
   */
  countFromIso?: string | null;
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
