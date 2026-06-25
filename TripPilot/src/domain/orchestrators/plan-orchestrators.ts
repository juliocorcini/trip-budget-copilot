import { db } from '@/data/db/database';
import { createBudgetPool, createBudgetPoolPhaseLink } from '@/domain/budget';
import { createPlannedOccurrence, createPlannedPurchase } from '@/domain/planning';
import {
  routePlannedExpense,
  outcomeCreatesEvent,
  outcomeCreatesNewPot,
  outcomeCreatesPhasePot,
  outcomeCreatesPurchase,
  outcomeFundedByPhase,
  type PlanFundingSource,
  type PlannedExpenseOutcome,
  type PotScope,
} from '@/domain/planning/plan-routing';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';

export interface CreatePlannedExpenseInput {
  tripId: string;
  currency: string;
  /** P1 — "acontece numa data específica?" */
  hasDate: boolean;
  /** P2 — "de onde vem o dinheiro?" */
  funding: PlanFundingSource;
  /** E01 (DEC-321): for a Pote/Fundo, which part of the trip it belongs to. Default 'trip'. */
  potScope?: PotScope;
  name: string;
  estimatedCostCents: number;
  /** QuickAdd category key — prefills the Compra planejada "Comprei" form. */
  category: string;
  /** D7/D15: optional savings goal — only meaningful for a standalone Pote. */
  goalCents?: number | null;
  /** Dated outcomes: the event interval (inclusive YYYY-MM-DD). */
  startDate: string | null;
  endDate: string | null;
  /**
   * The trecho the item belongs to + its dedicated pool (phase funding / event
   * anchor). For a phase-scoped Pote/Fundo (`pot_phase`), `phaseId` is the phase the
   * new `linked_phases` pool is linked to.
   */
  phaseId: string | null;
  phasePoolId: string | null;
  /** funding === 'existing_pot': the chosen Pote's pool id. */
  existingPotId: string | null;
}

export interface CreatePlannedExpenseResult {
  outcome: PlannedExpenseOutcome;
  /** Set when the door created a new Pote (a standalone one or to fund the event). */
  createdPotId: string | null;
  occurrenceId: string | null;
  purchaseId: string | null;
}

/**
 * GATE 4 (M4.1/M4.3, master §3.3 + D6): the single planning door. Given the two
 * answers it routes to one canonical outcome and creates the matching backend
 * entity (Event / Pote / Compra) — plus, for "à parte só pra isso", the new Pote
 * — in ONE atomic transaction. Funding wiring is the heart:
 *
 * - "do dia a dia" (phase): the Event/Compra is charged to the trecho pool with a
 *   reserve, so it SUBTRACTS from that trecho's free-to-spend (master example:
 *   €35 off the Eurotrip's 678).
 * - "à parte" (new/existing Pote): the item is charged to a `global` Pote with NO
 *   reserve, so the trecho is untouched; only the real spend later debits the Pote
 *   (Tomorrowland = Event + €200 Pote, Burgos intact).
 */
export async function createPlannedExpense(
  input: CreatePlannedExpenseInput,
): Promise<CreatePlannedExpenseResult> {
  const outcome = routePlannedExpense(input.hasDate, input.funding, input.potScope ?? 'trip');
  const fundedByPhase = outcomeFundedByPhase(outcome);

  // A new Pote is born first so the Event/Compra can point at it. Its date mirrors
  // the event's (so the Pote follows the same D8 Home visibility); a standalone
  // Pote ("pot") has no date. A phase-scoped Pote/Fundo ("pot_phase", E01/DEC-321)
  // is a `linked_phases` pool tied to one phase (the `/funds` model) — no date, no
  // Event, off the current Home, yet selectable when logging a spend (E02).
  let newPot: BudgetPool | null = null;
  let phaseLink: BudgetPoolPhaseLink | null = null;
  if (outcomeCreatesNewPot(outcome)) {
    const phaseScoped = outcomeCreatesPhasePot(outcome);
    newPot = createBudgetPool({
      tripId: input.tripId,
      name: input.name.trim(),
      scope: phaseScoped ? 'linked_phases' : 'global',
      totalAmountCents: input.estimatedCostCents,
      currency: input.currency,
      dateStart: outcome === 'event_new_pot' ? input.startDate : null,
      dateEnd: outcome === 'event_new_pot' ? input.endDate : null,
      // A goal only makes sense for a Pote/Fundo the user saves toward (standalone or
      // phase-scoped), never for an event's funding pot.
      goalCents: outcome === 'pot' || outcome === 'pot_phase' ? (input.goalCents ?? null) : null,
    });
    if (phaseScoped) {
      if (input.phaseId === null) {
        throw new Error('createPlannedExpense: a phase Pote/Fundo requires a phaseId');
      }
      phaseLink = createBudgetPoolPhaseLink(newPot.id, input.phaseId);
    }
  }

  // The pool that funds the Event/Compra (when one is created).
  const fundingPoolId = fundedByPhase
    ? input.phasePoolId
    : newPot !== null
      ? newPot.id
      : input.existingPotId;

  let occurrence: PlannedOccurrence | null = null;
  if (outcomeCreatesEvent(outcome)) {
    if (input.phaseId === null) throw new Error('createPlannedExpense: event requires a phaseId');
    if (input.startDate === null) throw new Error('createPlannedExpense: event requires a startDate');
    if (!fundingPoolId) throw new Error('createPlannedExpense: event requires a funding pool');
    occurrence = createPlannedOccurrence({
      tripId: input.tripId,
      phaseId: input.phaseId,
      budgetPoolId: fundingPoolId,
      name: input.name.trim(),
      plannedDate: input.startDate,
      endDate: input.endDate && input.endDate > input.startDate ? input.endDate : null,
      kind: 'event',
      estimatedCostCents: input.estimatedCostCents,
      // Trecho money reserves (subtracts); Pote money is à parte (null).
      reservedCents: fundedByPhase ? input.estimatedCostCents : null,
      activityProfileId: null,
    });
  }

  let purchase: PlannedPurchase | null = null;
  if (outcomeCreatesPurchase(outcome)) {
    if (!fundingPoolId) throw new Error('createPlannedExpense: purchase requires a funding pool');
    purchase = createPlannedPurchase({
      tripId: input.tripId,
      budgetPoolId: fundingPoolId,
      name: input.name.trim(),
      category: input.category,
      estimatedCostCents: input.estimatedCostCents,
      // Trecho money reserves (subtracts); Pote money is à parte (track only).
      reservedCents: fundedByPhase ? input.estimatedCostCents : null,
      // A trecho purchase is phase-bound; a Pote purchase is trip-wide.
      phaseId: fundedByPhase ? input.phaseId : null,
    });
  }

  await db.transaction(
    'rw',
    [db.budgetPools, db.budgetPoolPhaseLinks, db.plannedOccurrences, db.plannedPurchases],
    async () => {
      if (newPot) await db.budgetPools.add(newPot);
      if (phaseLink) await db.budgetPoolPhaseLinks.add(phaseLink);
      if (occurrence) await db.plannedOccurrences.add(occurrence);
      if (purchase) await db.plannedPurchases.add(purchase);
    },
  );

  return {
    outcome,
    createdPotId: newPot?.id ?? null,
    occurrenceId: occurrence?.id ?? null,
    purchaseId: purchase?.id ?? null,
  };
}
