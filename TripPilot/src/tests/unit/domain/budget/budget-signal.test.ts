import { describe, it, expect } from 'vitest';
import { classifyBudgetSignal } from '@/domain/budget';

describe('classifyBudgetSignal (C04/DEC-304 copilot×planner reconciliation)', () => {
  it('on_track when nothing is over', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 0,
      projectedOverCents: 0,
    });
    expect(s.kind).toBe('on_track');
    expect(s.isRealProblem).toBe(false);
  });

  it('real_over is the ONLY red-worthy case (real money already gone)', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 12_000,
      overAllocationCents: 31_800,
      projectedOverCents: 5_000,
    });
    expect(s.kind).toBe('real_over');
    expect(s.isRealProblem).toBe(true);
  });

  it('allocation_over: the planner −318 with real spend fine is NOT a real problem', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 31_800,
      projectedOverCents: 0,
    });
    expect(s.kind).toBe('allocation_over');
    expect(s.isRealProblem).toBe(false);
  });

  it('projection_over: only the forecast runs over (allocation fine)', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 0,
      projectedOverCents: 4_200,
    });
    expect(s.kind).toBe('projection_over');
    expect(s.isRealProblem).toBe(false);
  });

  it('plan_unadjusted: allocation AND projection over, real spend still fine', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 31_800,
      projectedOverCents: 4_200,
    });
    expect(s.kind).toBe('plan_unadjusted');
    expect(s.isRealProblem).toBe(false);
  });

  it('real spend over dominates even when allocation and projection are also over', () => {
    const s = classifyBudgetSignal({
      realSpendOverCents: 1,
      overAllocationCents: 99_999,
      projectedOverCents: 99_999,
    });
    expect(s.kind).toBe('real_over');
    expect(s.isRealProblem).toBe(true);
  });
});
