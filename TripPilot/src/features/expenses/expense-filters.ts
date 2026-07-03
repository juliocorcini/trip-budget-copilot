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

/**
 * How many scopes are currently narrowing the feed (drives the "Filtros (N)"
 * badge). DEC-453 (field fix): the PHASE scope no longer counts here — it is a
 * first-class selector chip always visible on the filter line, not one of the
 * collapsible "Filtros" (Julio: "no lugar do botão Todos deveria aparecer a
 * fase atual", one line, no duplicated chip on a second row).
 */
export function countActiveFilters(state: ExpenseFilterState): number {
  const present = [state.category, state.profileId, state.place].filter(Boolean).length;
  return present + (state.walletNull ? 1 : 0);
}

/** Whether any collapsible filter is active (the phase selector is separate). */
export function hasActiveFilter(state: ExpenseFilterState): boolean {
  return countActiveFilters(state) > 0;
}

/** The scopes that travel between screens (list → map) as URL params. */
export interface ExpenseScope {
  phaseId: PhaseScope;
  category: string | null;
  profileId: string | null;
  place: string | null;
}

/**
 * DEC-453 (field fix): the ONE scope predicate shared by the expense list and
 * the expense map — "the map shows the spends the list is showing". The list
 * adds its local-only concerns on top (walletNull, free-text search).
 */
export function matchesExpenseScope(
  tx: {
    deletedAt: string | null;
    phaseId: string | null;
    category: string | null;
    activityProfileId: string | null;
    placeLabel: string | null;
  },
  scope: ExpenseScope,
): boolean {
  return (
    tx.deletedAt === null &&
    (scope.phaseId === 'all' || tx.phaseId === scope.phaseId) &&
    (!scope.category || tx.category === scope.category) &&
    (!scope.profileId || tx.activityProfileId === scope.profileId) &&
    (!scope.place || tx.placeLabel === scope.place)
  );
}

/** DEC-453: reads the list's scope out of /mapa's URL params (absent = open). */
export function readExpenseScopeFromParams(params: URLSearchParams): ExpenseScope {
  return {
    phaseId: params.get('phase') ?? 'all',
    category: params.get('category'),
    profileId: params.get('profile'),
    place: params.get('place'),
  };
}

/** Whether the scope narrows anything (drives the map's "filtered" pill). */
export function isExpenseScopeActive(scope: ExpenseScope): boolean {
  return scope.phaseId !== 'all' || Boolean(scope.category || scope.profileId || scope.place);
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
