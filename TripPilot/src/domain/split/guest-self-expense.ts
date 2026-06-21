/**
 * F9 — "register my part in my own app" (guest side of the live table).
 *
 * When the live-table guest is ALSO a TripPilot user (their device already has a
 * trip), the bill they just split with someone else is a real expense for THEM
 * too. This pure planner decides what the guest screen should offer for their
 * own slice, with zero side effects so it is fully unit-testable:
 *
 *  - `none`              → nothing to register (no positive slice, or a broken
 *                          trip with no active phase/pool — the CTA stays hidden).
 *  - `no_trip`           → the guest is a true stranger (no app) → the onboarding
 *                          door handles them; no self-expense is offered.
 *  - `already`           → the slice was already registered once (idempotent),
 *                          so re-opening the link never double-books it.
 *  - `currency_mismatch` → the table currency differs from the guest's base
 *                          currency, which needs the rate UI → hand the pre-fill
 *                          to the full editor instead of guessing a rate.
 *  - `ready`             → same-currency app user → register the slice directly
 *                          on this device (phase + pool already resolved).
 *
 * No ids, FX, or entities-with-behaviour cross this boundary; the caller passes
 * plain values and applies the resulting plan.
 */
export interface PlanGuestSelfExpenseInput {
  /** The guest's live slice of the bill, in the table currency (cents). */
  myTotalCents: number;
  sessionCurrency: string;
  sessionName: string;
  /** Dominant category of the split (already derived from the session). */
  category: string;
  /** True when this device has an active trip (i.e. it is an app user). */
  hasTrip: boolean;
  /** The guest trip's base currency, or null when there is no trip. */
  tripBaseCurrency: string | null;
  /** The guest's active phase id, or null. */
  activePhaseId: string | null;
  /** The guest's primary budget pool id, or null. */
  primaryPoolId: string | null;
  /** A previously committed transaction id for THIS table (idempotency), or null. */
  committedTxId: string | null;
}

export type GuestSelfExpensePlan =
  | { kind: 'none' }
  | { kind: 'no_trip' }
  | { kind: 'already'; txId: string }
  | {
      kind: 'currency_mismatch';
      amountCents: number;
      currency: string;
      category: string;
      description: string;
    }
  | {
      kind: 'ready';
      amountCents: number;
      currency: string;
      category: string;
      description: string;
      phaseId: string;
      budgetPoolId: string;
    };

const FALLBACK_DESCRIPTION = 'Split';

export function planGuestSelfExpense(input: PlanGuestSelfExpenseInput): GuestSelfExpensePlan {
  const amountCents = Math.round(input.myTotalCents);
  if (amountCents <= 0) return { kind: 'none' };
  if (input.committedTxId) return { kind: 'already', txId: input.committedTxId };
  if (!input.hasTrip) return { kind: 'no_trip' };

  const description = input.sessionName.trim() || FALLBACK_DESCRIPTION;
  const category = input.category;

  if (input.tripBaseCurrency && input.tripBaseCurrency !== input.sessionCurrency) {
    return { kind: 'currency_mismatch', amountCents, currency: input.sessionCurrency, category, description };
  }

  // An app user always has a phase + pool; a missing one means a broken/empty
  // trip, in which case we simply hide the CTA rather than mis-route them.
  if (!input.activePhaseId || !input.primaryPoolId) return { kind: 'none' };

  return {
    kind: 'ready',
    amountCents,
    currency: input.sessionCurrency,
    category,
    description,
    phaseId: input.activePhaseId,
    budgetPoolId: input.primaryPoolId,
  };
}
