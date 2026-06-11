import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Transaction } from '@/domain/types/transaction';
import type { ScenarioAllocationItem } from '@/domain/types/scenario';
import type { ConfidenceLevel } from '@/domain/types/common';
import { sumCents } from '@/domain/money';

export interface ProfileLearningUpdate {
  typicalValueCents: number;
  safeValueCents: number;
  confidence: ConfidenceLevel;
  dataPointCount: number;
}

/**
 * PAR-003a (R6-22): the preset estimate acts as a prior worth this many
 * virtual data points, so the first real observation refines the estimate
 * instead of replacing it outright (1500 + first datum 9000 → 3375, not 9000).
 */
const ESTIMATE_PRIOR_WEIGHT = 3;

export function updateProfileFromTransaction(
  profile: ActivityProfile,
  newAmountCents: number,
  isSpecialOccasion: boolean,
): ProfileLearningUpdate {
  if (isSpecialOccasion) {
    return {
      typicalValueCents: profile.typicalValueCents,
      safeValueCents: profile.safeValueCents,
      confidence: profile.confidence,
      dataPointCount: profile.dataPointCount,
    };
  }

  const newCount = profile.dataPointCount + 1;
  const weight = 1 / (newCount + ESTIMATE_PRIOR_WEIGHT);
  const typicalValueCents = Math.round(
    profile.typicalValueCents * (1 - weight) + newAmountCents * weight,
  );

  const safeValueCents = Math.round(typicalValueCents * 1.3);

  const confidence: ConfidenceLevel =
    newCount >= 10 ? 'high' : newCount >= 5 ? 'medium' : 'low';

  return { typicalValueCents, safeValueCents, confidence, dataPointCount: newCount };
}

export interface OccasionForecast {
  profileId: string;
  profileName: string;
  remaining: number;
  totalPlanned: number;
  spent: number;
  estimatedRemainingCostCents: number;
}

// GAP-R2-006: forecasts are phase-scoped — allocations come from the phase's
// active plan and transactions are filtered by phase, so counters never mix phases.
export function calculateOccasionForecasts(
  profiles: ActivityProfile[],
  allocations: ScenarioAllocationItem[],
  transactions: Transaction[],
  phaseId: string,
): OccasionForecast[] {
  return profiles
    .filter((p) => p.deletedAt === null)
    .map((profile) => {
      const allocation = allocations.find(
        (a) => a.activityProfileId === profile.id && a.deletedAt === null,
      );
      const totalPlanned = allocation?.quantity ?? 0;

      const spent = transactions.filter(
        (t) =>
          t.activityProfileId === profile.id &&
          t.phaseId === phaseId &&
          t.type === 'expense' &&
          t.deletedAt === null,
      ).length;

      const remaining = Math.max(0, totalPlanned - spent);
      const estimatedRemainingCostCents = remaining * profile.safeValueCents;

      return {
        profileId: profile.id,
        profileName: profile.name,
        remaining,
        totalPlanned,
        spent,
        estimatedRemainingCostCents,
      };
    })
    // DEC-076: profiles with usage appear even without a plan allocation.
    .filter((f) => f.totalPlanned > 0 || f.spent > 0);
}

/**
 * DEC-076 (FIELD-06): carousel ordering — profiles with spending in the
 * phase first (desc by usage), then planned-but-unused ones in plan order.
 * With no usage at all, the most planned come first (previous behavior).
 */
export function orderForecastsByUsage(forecasts: OccasionForecast[]): OccasionForecast[] {
  const used = forecasts.filter((f) => f.spent > 0).sort((a, b) => b.spent - a.spent);
  if (used.length === 0) {
    return [...forecasts].sort((a, b) => b.totalPlanned - a.totalPlanned);
  }
  const unused = forecasts.filter((f) => f.spent === 0);
  return [...used, ...unused];
}

export type SimulatorRisk = 'low' | 'medium' | 'high' | 'critical';

export interface SimulatorResult {
  canSpend: boolean;
  risk: SimulatorRisk;
  freeAfterCents: number;
  percentOfRemaining: number;
  message: string;
}

export function simulateSpend(
  freeToSpendCents: number,
  spendAmountCents: number,
): SimulatorResult {
  const freeAfterCents = freeToSpendCents - spendAmountCents;
  const percentOfRemaining =
    freeToSpendCents === 0
      ? 100
      : Math.round((spendAmountCents / freeToSpendCents) * 100);

  let risk: SimulatorRisk;
  let canSpend: boolean;
  let message: string;

  if (freeAfterCents < 0) {
    risk = 'critical';
    canSpend = false;
    message = 'budget_exceeded';
  } else if (percentOfRemaining > 50) {
    risk = 'high';
    canSpend = true;
    message = 'high_impact';
  } else if (percentOfRemaining > 25) {
    risk = 'medium';
    canSpend = true;
    message = 'moderate_impact';
  } else {
    risk = 'low';
    canSpend = true;
    message = 'comfortable';
  }

  return { canSpend, risk, freeAfterCents, percentOfRemaining, message };
}

/* ──────────── DEC-094 (R-12): multi-metric simulation ──────────── */

export type SimulatorVerdict = 'ok' | 'attention' | 'risk';

export interface PlanImpact {
  profileId: string;
  profileName: string;
  /** Planned occasions this spend is equivalent to ("≈ 2 bar nights"). */
  occasionsLost: number;
}

export interface MultiMetricSimulation {
  /** Perspective 1 — of the total available (existing math). */
  total: SimulatorResult;
  /** Perspective 2 — equivalence in days of the daily allowance. */
  allowanceDays: number | null;
  dailyAllowanceCents: number | null;
  /** Perspective 3 — which planned occasions shrink. */
  planImpacts: PlanImpact[];
  /** The WORST of the three perspectives sets the tone. */
  verdict: SimulatorVerdict;
}

const VERDICT_RANK: Record<SimulatorVerdict, number> = { ok: 0, attention: 1, risk: 2 };

function totalVerdict(result: SimulatorResult): SimulatorVerdict {
  if (result.risk === 'low') return 'ok';
  if (result.risk === 'medium') return 'attention';
  return 'risk';
}

function allowanceVerdict(days: number | null): SimulatorVerdict {
  if (days === null || days <= 1) return 'ok';
  if (days <= 3) return 'attention';
  return 'risk';
}

function planVerdict(impacts: PlanImpact[]): SimulatorVerdict {
  const lost = impacts.reduce((sum, i) => sum + i.occasionsLost, 0);
  if (lost === 0) return 'ok';
  if (lost === 1) return 'attention';
  return 'risk';
}

export interface SimulateMultiMetricInput {
  amountCents: number;
  freeToSpendCents: number;
  /** Today's allowance from the R-06 engine (null when unavailable). */
  todayAllowanceCents: number | null;
  /** Planned occasions still remaining, with their typical cost. */
  remainingOccasions: Array<{
    profileId: string;
    profileName: string;
    remaining: number;
    typicalValueCents: number;
  }>;
}

/**
 * "'Posso gastar?' é diferente de 'tenho dinheiro?'" — €20 with a €5/day
 * allowance is 4 days of budget even when it is only 4% of the total.
 */
export function simulateSpendMultiMetric(
  input: SimulateMultiMetricInput,
): MultiMetricSimulation {
  const total = simulateSpend(input.freeToSpendCents, input.amountCents);

  const allowanceDays =
    input.todayAllowanceCents !== null && input.todayAllowanceCents > 0
      ? Math.round((input.amountCents / input.todayAllowanceCents) * 10) / 10
      : null;

  const planImpacts: PlanImpact[] = input.remainingOccasions
    .filter((o) => o.remaining > 0 && o.typicalValueCents > 0)
    .map((o) => ({
      profileId: o.profileId,
      profileName: o.profileName,
      occasionsLost: Math.min(o.remaining, Math.floor(input.amountCents / o.typicalValueCents)),
    }))
    .filter((i) => i.occasionsLost > 0)
    .sort((a, b) => b.occasionsLost - a.occasionsLost)
    .slice(0, 2);

  const verdicts: SimulatorVerdict[] = [
    totalVerdict(total),
    allowanceVerdict(allowanceDays),
    planVerdict(planImpacts),
  ];
  const verdict = verdicts.reduce((worst, v) =>
    VERDICT_RANK[v] > VERDICT_RANK[worst] ? v : worst,
  );

  return {
    total,
    allowanceDays,
    dailyAllowanceCents: input.todayAllowanceCents,
    planImpacts,
    verdict,
  };
}

export function calculateScenarioCost(items: ScenarioAllocationItem[]): number {
  return sumCents(
    items
      .filter((i) => i.deletedAt === null)
      .map((i) => i.quantity * i.estimatedUnitCostCents),
  );
}
