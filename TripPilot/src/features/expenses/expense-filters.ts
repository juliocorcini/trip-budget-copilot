/**
 * Pure helpers for the Expense list scope filters (audit 4.4, P2).
 *
 * The list can be narrowed by five independent scopes — a phase (DEC-448), a
 * category, an activity profile, the "no wallet" flag, and a place. These
 * helpers drive the grouped, collapsible filter UI (the active count badge +
 * the "is anything filtering?" state) without the component duplicating the
 * bookkeeping.
 */

/** The phase scope: a phase id narrows the feed; 'all' shows the whole trip. */
export type PhaseScope = string | 'all';

export interface ExpenseFilterState {
  /** DEC-448 (D04): phase scope — defaults to the active phase on trips with 2+ phases. */
  phaseId: PhaseScope;
  category: string | null;
  profileId: string | null;
  walletNull: boolean;
  place: string | null;
}

/** How many scopes are currently narrowing the feed (drives the "Filtros (N)" badge). */
export function countActiveFilters(state: ExpenseFilterState): number {
  const present = [state.category, state.profileId, state.place].filter(Boolean).length;
  return present + (state.walletNull ? 1 : 0) + (state.phaseId !== 'all' ? 1 : 0);
}

/** Whether any scope is active — i.e. the list is not showing everything. */
export function hasActiveFilter(state: ExpenseFilterState): boolean {
  return countActiveFilters(state) > 0;
}

export interface PhaseScopeDefaultInput {
  /** Dia a dia spaces have no meaningful phases — they default to 'all'. */
  isOngoing: boolean;
  activePhaseId: string | null;
  /** Number of live (non-deleted) phases. */
  phaseCount: number;
}

/**
 * DEC-448 (D04): the list opens scoped to the ACTIVE phase — but only when the
 * scope is meaningful: a dated trip with 2+ phases and a resolvable active
 * phase. Single-phase trips and Dia a dia spaces open on 'all' (the scope
 * would be a no-op or noise there).
 */
export function resolvePhaseScopeDefault(input: PhaseScopeDefaultInput): PhaseScope {
  if (input.isOngoing) return 'all';
  if (input.phaseCount < 2) return 'all';
  return input.activePhaseId ?? 'all';
}

/* DEC-448: the user's scope choice is remembered for the app session (an SPA
   in-memory map, per trip) — navigating away and back keeps the choice, a full
   reload returns to the default. */
const sessionPhaseScopeByTrip = new Map<string, PhaseScope>();

export function recallPhaseScope(tripId: string): PhaseScope | null {
  return sessionPhaseScopeByTrip.get(tripId) ?? null;
}

export function rememberPhaseScope(tripId: string, scope: PhaseScope): void {
  sessionPhaseScopeByTrip.set(tripId, scope);
}

/** Test-only: reset the session memory between cases. */
export function clearPhaseScopeMemory(): void {
  sessionPhaseScopeByTrip.clear();
}
