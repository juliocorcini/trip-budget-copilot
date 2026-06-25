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
 * E01 (DEC-321): when the door creates a Pote/Fundo ("guardar dinheiro"), which
 * part of the trip it belongs to.
 * - `trip`  → a standalone `global` Pote, available from any phase (legacy `pot`).
 * - `phase` → a `linked_phases` pool tied to one phase (reuses the `/funds` path):
 *   no Event, no countdown, off the current Home, but selectable when logging (E02).
 */
export type PotScope = 'trip' | 'phase';

/**
 * The canonical thing the door creates. Each maps to a backend shape:
 * - `event_phase`         → PlannedOccurrence(event) funded by the trecho (reserve subtracts).
 * - `event_new_pot`       → a new Pote (global pool) + PlannedOccurrence(event) funded by it.
 * - `event_existing_pot`  → PlannedOccurrence(event) funded by an existing Pote.
 * - `purchase_phase`      → PlannedPurchase funded by the trecho (reserve subtracts).
 * - `purchase_existing_pot` → PlannedPurchase funded by an existing Pote (à parte).
 * - `pot`                 → a standalone Pote (global pool), money set apart with no date.
 * - `pot_phase`           → a phase-scoped Pote/Fundo (`linked_phases` pool tied to one
 *   phase), money set apart for a leg of the trip — NO Event, NO countdown (E01/DEC-321).
 */
export type PlannedExpenseOutcome =
  | 'event_phase'
  | 'event_new_pot'
  | 'event_existing_pot'
  | 'purchase_phase'
  | 'purchase_existing_pot'
  | 'pot'
  | 'pot_phase';

/**
 * GATE 4 (master §3.2) + E01 (DEC-321): the routing table. Dated → an Event funded
 * the chosen way; undated → a Compra (from the trecho or an existing Pote) or, for
 * "money set apart", a Pote/Fundo — `pot_phase` when it is scoped to a single phase
 * (the `/funds` model) or `pot` for the whole trip. Pure and total over the input
 * space; `potScope` only matters for the undated new-pot branch (defaults to `trip`,
 * so the 2-arg legacy callers keep their exact behaviour).
 */
export function routePlannedExpense(
  hasDate: boolean,
  funding: PlanFundingSource,
  potScope: PotScope = 'trip',
): PlannedExpenseOutcome {
  if (hasDate) {
    if (funding === 'phase') return 'event_phase';
    if (funding === 'new_pot') return 'event_new_pot';
    return 'event_existing_pot';
  }
  if (funding === 'phase') return 'purchase_phase';
  if (funding === 'new_pot') return potScope === 'phase' ? 'pot_phase' : 'pot';
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

/** True when the outcome creates a NEW Pote (standalone, phase-scoped, or to fund an event). */
export function outcomeCreatesNewPot(outcome: PlannedExpenseOutcome): boolean {
  return outcome === 'event_new_pot' || outcome === 'pot' || outcome === 'pot_phase';
}

/**
 * True when the NEW Pote is phase-scoped: a `linked_phases` pool tied to one phase
 * (the `/funds` model), with no Event/countdown and out of the current-phase Home
 * focus, yet selectable when logging a spend (E01/DEC-321).
 */
export function outcomeCreatesPhasePot(outcome: PlannedExpenseOutcome): boolean {
  return outcome === 'pot_phase';
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
