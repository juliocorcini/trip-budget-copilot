import { describe, it, expect } from 'vitest';
import {
  calculateTrueFree,
  isPhaseFullyPlanned,
  buildFreeToSpendBreakdown,
  type FreeToSpendResult,
} from '@/domain/budget';

// FIELD-18: the home hero must show what is TRULY free — the phase free-to-spend
// minus the scenario plan still reserved ahead, with no double counting of spend
// already realized on the planned profiles.
describe('calculateTrueFree (FIELD-18 home hero)', () => {
  it('matches the planner margin at phase start (Julio: 988 − 414 = 574)', () => {
    // Cents: phase free 988.00, allocated 414.00, nothing spent on the plan yet.
    const result = calculateTrueFree(98800, 41400, 0);
    expect(result.planReservedCents).toBe(41400);
    expect(result.trueFreeCents).toBe(57400);
    // The three numbers reconcile: phaseFree = trueFree + planReserved.
    expect(result.trueFreeCents + result.planReservedCents).toBe(result.phaseFreeCents);
  });

  it('does NOT double-count spend already made on planned profiles', () => {
    // Plan = 10 bar nights × €10 = €100. Four already done → €40 real spend.
    // phaseFree (96000) ALREADY removed that €40, so only the €60 still ahead
    // may be reserved again — trueFree = 96000 − 6000 = 90000.
    const result = calculateTrueFree(96000, 10000, 4000);
    expect(result.planReservedCents).toBe(6000);
    expect(result.trueFreeCents).toBe(90000);
    expect(result.trueFreeCents + result.planReservedCents).toBe(96000);
  });

  it('reserves nothing more once the plan is overspent', () => {
    const result = calculateTrueFree(50000, 10000, 12000);
    expect(result.planReservedCents).toBe(0);
    expect(result.trueFreeCents).toBe(50000);
  });

  it('equals the phase free when there is no plan', () => {
    const result = calculateTrueFree(73000, 0, 0);
    expect(result.planReservedCents).toBe(0);
    expect(result.trueFreeCents).toBe(73000);
  });

  it('never goes negative (a plan larger than the free amount clamps to 0)', () => {
    const result = calculateTrueFree(5000, 9000, 0);
    expect(result.planReservedCents).toBe(9000);
    expect(result.trueFreeCents).toBe(0);
  });
});

// M06: a hero €0 means "spent out" OR "all earmarked" — only the second is
// reassuring. isPhaseFullyPlanned must tell them apart so the UI can swap the
// raw €0 for a calm line ONLY when the zero comes from the plan.
describe('isPhaseFullyPlanned (M06 reassuring phase-zero)', () => {
  it('is true when the whole phase free amount is claimed by the plan (€0 free)', () => {
    // phaseFree 800.00 fully reserved by an 800.00 plan → trueFree 0.
    const result = calculateTrueFree(80000, 80000, 0);
    expect(result.trueFreeCents).toBe(0);
    expect(isPhaseFullyPlanned(result)).toBe(true);
  });

  it('is true when the plan exceeds the free amount (clamped to €0)', () => {
    const result = calculateTrueFree(80000, 90000, 0);
    expect(result.trueFreeCents).toBe(0);
    expect(isPhaseFullyPlanned(result)).toBe(true);
  });

  it('is false when there is still truly-free money left', () => {
    const result = calculateTrueFree(80000, 30000, 0);
    expect(result.trueFreeCents).toBe(50000);
    expect(isPhaseFullyPlanned(result)).toBe(false);
  });

  it('is false when the phase has no free money at all (spent out, not planned)', () => {
    // No phase money and no plan → €0 that genuinely means "nothing left".
    const result = calculateTrueFree(0, 0, 0);
    expect(result.trueFreeCents).toBe(0);
    expect(isPhaseFullyPlanned(result)).toBe(false);
  });
});

describe('buildFreeToSpendBreakdown with the plan line (FIELD-18)', () => {
  const fts: FreeToSpendResult = {
    freeToSpendCents: 98800,
    freeToSpendRawCents: 98800,
    totalBudgetCents: 100000,
    totalIncomeCents: 0,
    totalSpentCents: 1200,
    protectedReserveCents: 0,
    futureFloorCents: 0,
    eventReservesCents: 0,
    plannedPurchasesCents: 0,
    allocationsCents: 0,
  };

  it('adds a plan subtraction and reconciles the total to the truly-free amount', () => {
    const lines = buildFreeToSpendBreakdown(fts, 41400);
    const plan = lines.find((l) => l.key === 'plan');
    const total = lines.find((l) => l.kind === 'total');
    expect(plan).toEqual({ key: 'plan', cents: 41400, kind: 'subtract' });
    // 100000 − 1200 − 41400 = 57400.
    expect(total?.cents).toBe(57400);
  });

  it('omits the plan line when nothing is reserved (back-compat default)', () => {
    const lines = buildFreeToSpendBreakdown(fts);
    expect(lines.some((l) => l.key === 'plan')).toBe(false);
    const total = lines.find((l) => l.kind === 'total');
    expect(total?.cents).toBe(98800);
  });
});
