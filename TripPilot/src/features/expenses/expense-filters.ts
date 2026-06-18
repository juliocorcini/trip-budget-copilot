/**
 * Pure helpers for the Expense list scope filters (audit 4.4, P2).
 *
 * The list can be narrowed by four independent scopes — a category, an activity
 * profile, the "no wallet" flag, and a place. These helpers drive the grouped,
 * collapsible filter UI (the active count badge + the "is anything filtering?"
 * state) without the component duplicating the bookkeeping.
 */
export interface ExpenseFilterState {
  category: string | null;
  profileId: string | null;
  walletNull: boolean;
  place: string | null;
}

/** How many scopes are currently narrowing the feed (drives the "Filtros (N)" badge). */
export function countActiveFilters(state: ExpenseFilterState): number {
  const present = [state.category, state.profileId, state.place].filter(Boolean).length;
  return present + (state.walletNull ? 1 : 0);
}

/** Whether any scope is active — i.e. the list is not showing everything. */
export function hasActiveFilter(state: ExpenseFilterState): boolean {
  return countActiveFilters(state) > 0;
}
