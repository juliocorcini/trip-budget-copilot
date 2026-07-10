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
    countFromIso: null,
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

// ── G2 / DEC-491: auto-plan from selected activity profiles ─────────────

export interface BuildAutoPlanInput {
  selectedProfileIds: string[];
  profiles: Array<{ id: string; typicalValueCents: number }>;
  freeToSpendCents: number;
}

export interface AutoPlanAllocation {
  activityProfileId: string;
  quantity: number;
  estimatedUnitCostCents: number;
}

export interface BuildAutoPlanOutput {
  allocations: AutoPlanAllocation[];
  totalAllocatedCents: number;
  remainingFreeCents: number;
}

export function buildAutoPlan(input: BuildAutoPlanInput): BuildAutoPlanOutput {
  const { selectedProfileIds, profiles, freeToSpendCents } = input;

  const selected = selectedProfileIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null && p.typicalValueCents > 0);

  if (selected.length === 0 || freeToSpendCents <= 0) {
    return { allocations: [], totalAllocatedCents: 0, remainingFreeCents: freeToSpendCents };
  }

  const totalTypical = selected.reduce((sum, p) => sum + p.typicalValueCents, 0);

  const allocations: AutoPlanAllocation[] = selected.map((p) => {
    const weight = p.typicalValueCents / totalTypical;
    const budgetShare = freeToSpendCents * weight;
    const quantity = Math.max(1, Math.floor(budgetShare / p.typicalValueCents));
    return {
      activityProfileId: p.id,
      quantity,
      estimatedUnitCostCents: p.typicalValueCents,
    };
  });

  let totalAllocatedCents = allocations.reduce(
    (sum, a) => sum + a.quantity * a.estimatedUnitCostCents,
    0,
  );

  // Trim quantities if over budget (largest cost first).
  const sortedByUnit = [...allocations].sort(
    (a, b) => b.estimatedUnitCostCents - a.estimatedUnitCostCents,
  );
  while (totalAllocatedCents > freeToSpendCents) {
    const trimmed = sortedByUnit.find((a) => a.quantity > 1);
    if (!trimmed) break;
    trimmed.quantity -= 1;
    totalAllocatedCents -= trimmed.estimatedUnitCostCents;
  }

  return {
    allocations,
    totalAllocatedCents,
    remainingFreeCents: freeToSpendCents - totalAllocatedCents,
  };
}

/** R5-06: one entry per category the user ADDED to in this session. */
export interface SessionAddition {
  profileId: string;
  name: string;
  added: number;
}

interface CountState {
  count: number;
  baselineCount: number;
}

/**
 * R5-06: per-category additions (count > baseline only — reductions are not
 * "added"). Previously the UI summed every delta and labeled it with the
 * first category's name ("you added 23 café & padaria").
 */
export function listSessionAdditions(
  profiles: { id: string; name: string }[],
  states: Record<string, CountState | undefined>,
): SessionAddition[] {
  const additions: SessionAddition[] = [];
  for (const profile of profiles) {
    const s = states[profile.id];
    if (!s) continue;
    const added = s.count - s.baselineCount;
    if (added > 0) {
      additions.push({ profileId: profile.id, name: profile.name, added });
    }
  }
  return additions.sort((a, b) => b.added - a.added);
}

/** R5-06: "16 transporte, 5 mercado e 2 café & padaria". */
export function formatAdditionsList(
  additions: SessionAddition[],
  conjunction: string,
): string {
  const parts = additions.map((a) => `${a.added} ${a.name.toLowerCase()}`);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts[parts.length - 1]!}`;
}
