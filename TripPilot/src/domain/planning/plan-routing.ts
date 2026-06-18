/**
 * GATE 4 (master §3.2/§3.3, D6): the "Planejar um gasto" single door dissolves
 * the Evento × Pote × Compra confusion into TWO questions:
 *
 *   P1 — "Acontece numa data específica?"  (has a specific date?)
 *   P2 — "De onde vem o dinheiro?"          (3 funding sources)
 *
 * The pair routes to exactly one canonical outcome. This module is the PURE
 * decision: given the two answers it names the outcome; the orchestrator
 * (`createPlannedExpense`) then creates the right backend entity (Event / Pote /
 * Compra) and wires the funding pool. The user never sees a single backend word.
 */

/** P2: where the money comes from (master §3.3, D6 — exactly three options). */
export type PlanFundingSource = 'phase' | 'new_pot' | 'existing_pot';

/**
 * The canonical thing the door creates. Each maps to a backend shape:
 * - `event_phase`         → PlannedOccurrence(event) funded by the trecho (reserve subtracts).
 * - `event_new_pot`       → a new Pote (global pool) + PlannedOccurrence(event) funded by it.
 * - `event_existing_pot`  → PlannedOccurrence(event) funded by an existing Pote.
 * - `purchase_phase`      → PlannedPurchase funded by the trecho (reserve subtracts).
 * - `purchase_existing_pot` → PlannedPurchase funded by an existing Pote (à parte).
 * - `pot`                 → a standalone Pote (global pool), money set apart with no date.
 */
export type PlannedExpenseOutcome =
  | 'event_phase'
  | 'event_new_pot'
  | 'event_existing_pot'
  | 'purchase_phase'
  | 'purchase_existing_pot'
  | 'pot';

/**
 * GATE 4 (master §3.2): the 2×3 routing table. Dated → an Event funded the chosen
 * way; undated → a Compra (from the trecho or an existing Pote) or, for "money
 * apart with no purchase yet", a Pote. Pure and total over the input space.
 */
export function routePlannedExpense(
  hasDate: boolean,
  funding: PlanFundingSource,
): PlannedExpenseOutcome {
  if (hasDate) {
    if (funding === 'phase') return 'event_phase';
    if (funding === 'new_pot') return 'event_new_pot';
    return 'event_existing_pot';
  }
  if (funding === 'phase') return 'purchase_phase';
  if (funding === 'new_pot') return 'pot';
  return 'purchase_existing_pot';
}

/** True when the outcome materialises a dated Event (PlannedOccurrence). */
export function outcomeCreatesEvent(outcome: PlannedExpenseOutcome): boolean {
  return (
    outcome === 'event_phase' ||
    outcome === 'event_new_pot' ||
    outcome === 'event_existing_pot'
  );
}

/** True when the outcome creates a NEW Pote (a standalone one or to fund an event). */
export function outcomeCreatesNewPot(outcome: PlannedExpenseOutcome): boolean {
  return outcome === 'event_new_pot' || outcome === 'pot';
}

/** True when the outcome materialises an undated Compra planejada (PlannedPurchase). */
export function outcomeCreatesPurchase(outcome: PlannedExpenseOutcome): boolean {
  return outcome === 'purchase_phase' || outcome === 'purchase_existing_pot';
}

/**
 * GATE 4 (D6, M4.3): money that comes from the TRECHO ("do dia a dia") subtracts
 * from its free-to-spend — so a trecho-funded Event/Compra holds a reserve. Money
 * that is À PARTE (a Pote, new or existing) never touches the trecho: the Pote
 * already holds it, so the reserve is null and only the real spend debits the Pote.
 */
export function outcomeFundedByPhase(outcome: PlannedExpenseOutcome): boolean {
  return outcome === 'event_phase' || outcome === 'purchase_phase';
}
