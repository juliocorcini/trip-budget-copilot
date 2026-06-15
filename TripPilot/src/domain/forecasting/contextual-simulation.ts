/**
 * DEC-116 (R-07): Simulator v3 — contextual simulation engine.
 *
 * The simulator asks WHERE the money will be spent and looks in the right
 * place: the category plan, the event reserve, or the phase free margin.
 * Every output is a structured FACT (numbers + names) the UI renders as a
 * full labeled sentence — raw equations are banned (Core Rule 10).
 */

export type SimulationTarget =
  | { kind: 'profile'; profileId: string }
  | { kind: 'event'; occurrenceId: string }
  | { kind: 'planned'; plannedPurchaseId: string }
  | { kind: 'other' };

export interface SimulationProfileContext {
  profileId: string;
  profileName: string;
  /** Planned occasions in the active plan (0 = no plan for this category). */
  plannedQuantity: number;
  /** Occasions already done (DEC-115: sessions, not items). */
  doneQuantity: number;
  /** Occasions still remaining in the plan. */
  remaining: number;
  typicalValueCents: number;
}

export interface SimulationEventContext {
  occurrenceId: string;
  name: string;
  reservedCents: number;
}

/**
 * DEC-175: a named reserve source the simulator can spend against. Planned
 * purchases reuse the event reserve mechanic — their reserve is already
 * deducted from free-to-spend upfront, exactly like event reserves (DEC-072).
 */
export interface SimulationReserveContext {
  id: string;
  name: string;
  reservedCents: number;
}

export interface ContextualSimulationInput {
  amountCents: number;
  target: SimulationTarget;
  freeToSpendCents: number;
  /** Today's allowance from the daily engine (null when unavailable). */
  todayAllowanceCents: number | null;
  profiles: SimulationProfileContext[];
  events: SimulationEventContext[];
  planned: SimulationReserveContext[];
}

/** Every fact carries the numbers ALREADY named — the UI only formats them. */
export type SimulationFact =
  | { kind: 'free_impact'; freeCents: number; amountCents: number; afterCents: number }
  | { kind: 'exceeds_free'; freeCents: number; amountCents: number; missingCents: number }
  | { kind: 'daily_fits'; allowanceCents: number; amountCents: number }
  | { kind: 'daily_days'; allowanceCents: number; amountCents: number; days: number }
  | {
      kind: 'plan_consumption';
      profileName: string;
      /** ≈ occasions this amount is worth (1 decimal). */
      occasions: number;
      remaining: number;
      typicalValueCents: number;
    }
  | { kind: 'plan_over'; profileName: string; planned: number; done: number }
  | { kind: 'event_reserve_covers'; eventName: string; reservedCents: number; leftCents: number }
  | { kind: 'event_reserve_short'; eventName: string; reservedCents: number; missingCents: number }
  | { kind: 'event_no_reserve'; eventName: string };

export type ContextualVerdictTone = 'ok' | 'attention' | 'risk';

/** The verdict ALWAYS carries its concrete reason (DEC-116). */
export type ContextualVerdict =
  | { tone: 'ok'; reason: 'reserve_covers'; eventName: string }
  | { tone: 'ok'; reason: 'fits_plan'; profileName: string; remaining: number }
  | { tone: 'ok'; reason: 'fits_free' }
  | { tone: 'attention'; reason: 'consumes_occasions'; profileName: string; occasions: number }
  | { tone: 'attention' | 'risk'; reason: 'reserve_short'; eventName: string; missingCents: number }
  | { tone: 'attention' | 'risk'; reason: 'many_days'; days: number }
  | { tone: 'attention'; reason: 'large_share'; percent: number }
  | { tone: 'risk'; reason: 'consumes_whole_plan'; profileName: string; remaining: number }
  | { tone: 'risk'; reason: 'over_plan'; profileName: string; planned: number; done: number }
  | { tone: 'risk'; reason: 'exceeds_free'; missingCents: number };

export interface ContextualSimulation {
  facts: SimulationFact[];
  verdict: ContextualVerdict;
}

function roundOccasions(amountCents: number, typicalValueCents: number): number {
  return Math.round((amountCents / typicalValueCents) * 10) / 10;
}

function buildDailyFact(
  amountCents: number,
  todayAllowanceCents: number | null,
): SimulationFact | null {
  if (todayAllowanceCents === null || todayAllowanceCents <= 0) return null;
  if (amountCents <= todayAllowanceCents) {
    return { kind: 'daily_fits', allowanceCents: todayAllowanceCents, amountCents };
  }
  const days = Math.round((amountCents / todayAllowanceCents) * 10) / 10;
  return { kind: 'daily_days', allowanceCents: todayAllowanceCents, amountCents, days };
}

function buildFreeFact(amountCents: number, freeToSpendCents: number): SimulationFact {
  if (amountCents > freeToSpendCents) {
    return {
      kind: 'exceeds_free',
      freeCents: freeToSpendCents,
      amountCents,
      missingCents: amountCents - freeToSpendCents,
    };
  }
  return {
    kind: 'free_impact',
    freeCents: freeToSpendCents,
    amountCents,
    afterCents: freeToSpendCents - amountCents,
  };
}

/** Shared "no plan covers this" path: free margin + daily allowance. */
function simulateAgainstFree(
  amountCents: number,
  freeToSpendCents: number,
  todayAllowanceCents: number | null,
  leadingFacts: SimulationFact[],
): ContextualSimulation {
  const facts = [...leadingFacts, buildFreeFact(amountCents, freeToSpendCents)];
  const dailyFact = buildDailyFact(amountCents, todayAllowanceCents);
  if (dailyFact) facts.push(dailyFact);

  if (amountCents > freeToSpendCents) {
    return {
      facts,
      verdict: {
        tone: 'risk',
        reason: 'exceeds_free',
        missingCents: amountCents - freeToSpendCents,
      },
    };
  }

  if (dailyFact?.kind === 'daily_days') {
    return {
      facts,
      verdict: {
        tone: dailyFact.days > 3 ? 'risk' : 'attention',
        reason: 'many_days',
        days: dailyFact.days,
      },
    };
  }

  const percent =
    freeToSpendCents <= 0 ? 100 : Math.round((amountCents / freeToSpendCents) * 100);
  if (percent > 50) {
    return { facts, verdict: { tone: 'attention', reason: 'large_share', percent } };
  }

  return { facts, verdict: { tone: 'ok', reason: 'fits_free' } };
}

function simulateProfileTarget(
  input: ContextualSimulationInput,
  profile: SimulationProfileContext,
): ContextualSimulation {
  // No plan for this category → honest free-margin analysis.
  if (profile.plannedQuantity <= 0 || profile.typicalValueCents <= 0) {
    return simulateAgainstFree(
      input.amountCents,
      input.freeToSpendCents,
      input.todayAllowanceCents,
      [],
    );
  }

  // Plan already used up → the spend comes out of other categories.
  if (profile.remaining <= 0) {
    const facts: SimulationFact[] = [
      {
        kind: 'plan_over',
        profileName: profile.profileName,
        planned: profile.plannedQuantity,
        done: profile.doneQuantity,
      },
      buildFreeFact(input.amountCents, input.freeToSpendCents),
    ];
    if (input.amountCents > input.freeToSpendCents) {
      return {
        facts,
        verdict: {
          tone: 'risk',
          reason: 'exceeds_free',
          missingCents: input.amountCents - input.freeToSpendCents,
        },
      };
    }
    return {
      facts,
      verdict: {
        tone: 'risk',
        reason: 'over_plan',
        profileName: profile.profileName,
        planned: profile.plannedQuantity,
        done: profile.doneQuantity,
      },
    };
  }

  const occasions = roundOccasions(input.amountCents, profile.typicalValueCents);
  const facts: SimulationFact[] = [
    {
      kind: 'plan_consumption',
      profileName: profile.profileName,
      occasions,
      remaining: profile.remaining,
      typicalValueCents: profile.typicalValueCents,
    },
    buildFreeFact(input.amountCents, input.freeToSpendCents),
  ];

  if (input.amountCents > input.freeToSpendCents) {
    return {
      facts,
      verdict: {
        tone: 'risk',
        reason: 'exceeds_free',
        missingCents: input.amountCents - input.freeToSpendCents,
      },
    };
  }

  // Fits as roughly one planned occasion (20% tolerance) → planned money.
  if (occasions <= 1.2) {
    return {
      facts,
      verdict: {
        tone: 'ok',
        reason: 'fits_plan',
        profileName: profile.profileName,
        remaining: profile.remaining,
      },
    };
  }

  if (occasions >= profile.remaining) {
    return {
      facts,
      verdict: {
        tone: 'risk',
        reason: 'consumes_whole_plan',
        profileName: profile.profileName,
        remaining: profile.remaining,
      },
    };
  }

  return {
    facts,
    verdict: {
      tone: 'attention',
      reason: 'consumes_occasions',
      profileName: profile.profileName,
      occasions,
    },
  };
}

function simulateEventTarget(
  input: ContextualSimulationInput,
  event: { name: string; reservedCents: number },
): ContextualSimulation {
  // Fully covered: the money is already set aside — the free margin is
  // untouched (reserves deduct from freeToSpend upfront, DEC-072).
  if (event.reservedCents >= input.amountCents) {
    return {
      facts: [
        {
          kind: 'event_reserve_covers',
          eventName: event.name,
          reservedCents: event.reservedCents,
          leftCents: event.reservedCents - input.amountCents,
        },
      ],
      verdict: { tone: 'ok', reason: 'reserve_covers', eventName: event.name },
    };
  }

  if (event.reservedCents > 0) {
    const missingCents = input.amountCents - event.reservedCents;
    const facts: SimulationFact[] = [
      {
        kind: 'event_reserve_short',
        eventName: event.name,
        reservedCents: event.reservedCents,
        missingCents,
      },
      buildFreeFact(missingCents, input.freeToSpendCents),
    ];
    if (missingCents > input.freeToSpendCents) {
      return {
        facts,
        verdict: {
          tone: 'risk',
          reason: 'exceeds_free',
          missingCents: missingCents - input.freeToSpendCents,
        },
      };
    }
    return {
      facts,
      verdict: {
        tone: missingCents > event.reservedCents ? 'risk' : 'attention',
        reason: 'reserve_short',
        eventName: event.name,
        missingCents,
      },
    };
  }

  // No reserve at all → it all comes out of the free margin.
  return simulateAgainstFree(
    input.amountCents,
    input.freeToSpendCents,
    input.todayAllowanceCents,
    [{ kind: 'event_no_reserve', eventName: event.name }],
  );
}

export function simulateContextualSpend(
  input: ContextualSimulationInput,
): ContextualSimulation {
  if (input.target.kind === 'profile') {
    const targetId = input.target.profileId;
    const profile = input.profiles.find((p) => p.profileId === targetId);
    if (profile) return simulateProfileTarget(input, profile);
  }
  if (input.target.kind === 'event') {
    const targetId = input.target.occurrenceId;
    const event = input.events.find((e) => e.occurrenceId === targetId);
    if (event) return simulateEventTarget(input, event);
  }
  // DEC-175: planned purchases share the event reserve mechanic and copy.
  if (input.target.kind === 'planned') {
    const targetId = input.target.plannedPurchaseId;
    const planned = input.planned.find((p) => p.id === targetId);
    if (planned) return simulateEventTarget(input, planned);
  }
  return simulateAgainstFree(
    input.amountCents,
    input.freeToSpendCents,
    input.todayAllowanceCents,
    [],
  );
}
