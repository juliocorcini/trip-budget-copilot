import { describe, it, expect } from 'vitest';
import {
  createScenarioPlan,
  createAllocationItem,
  calculateOverAllocationCents,
} from '@/domain/planning';

describe('createScenarioPlan', () => {
  it('creates an active manual plan', () => {
    const plan = createScenarioPlan({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Burgos',
      preset: 'equilibrado',
    });
    expect(plan.tripId).toBe('trip-1');
    expect(plan.phaseId).toBe('phase-1');
    expect(plan.budgetPoolId).toBe('pool-1');
    expect(plan.preset).toBe('equilibrado');
    expect(plan.isActive).toBe(true);
    expect(plan.mode).toBe('manual');
  });
});

describe('createAllocationItem', () => {
  it('creates an allocation item with quantity and unit cost', () => {
    const item = createAllocationItem({
      scenarioPlanId: 'plan-1',
      activityProfileId: 'prof-1',
      quantity: 4,
      estimatedUnitCostCents: 2500,
      isLocked: false,
      priority: 'optional',
    });
    expect(item.scenarioPlanId).toBe('plan-1');
    expect(item.activityProfileId).toBe('prof-1');
    expect(item.quantity).toBe(4);
    expect(item.estimatedUnitCostCents).toBe(2500);
    expect(item.isLocked).toBe(false);
    expect(item.priority).toBe('optional');
  });
});

describe('calculateOverAllocationCents', () => {
  it('returns 0 when allocation fits the available margin', () => {
    expect(calculateOverAllocationCents(50000, 70000)).toBe(0);
  });

  it('returns 0 when allocation matches exactly', () => {
    expect(calculateOverAllocationCents(70000, 70000)).toBe(0);
  });

  it('returns the exceeded amount when over budget', () => {
    // allocated €800, available €717.50 → over by €82.50
    expect(calculateOverAllocationCents(80000, 71750)).toBe(8250);
  });
});
