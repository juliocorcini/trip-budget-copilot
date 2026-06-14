import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_CARD_CATALOG,
  DEFAULT_COLLAPSED_CARDS,
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  toggleDashboardCardHidden,
  isDashboardCardCollapsed,
  toggleDashboardCardCollapsed,
  moveDashboardCard,
} from '@/domain/dashboard';

// DEC-119 (R-10): configurable home screen — sequence resolution rules.

const CATALOG_ORDER = DASHBOARD_CARD_CATALOG.map((c) => c.id);

describe('resolveDashboardCardSequence', () => {
  it('returns the catalog order when nothing is saved', () => {
    expect(resolveDashboardCardSequence(undefined)).toEqual(CATALOG_ORDER);
    expect(resolveDashboardCardSequence([])).toEqual(CATALOG_ORDER);
  });

  it('keeps anchors (active_outing, hero) in their fixed slots', () => {
    const sequence = resolveDashboardCardSequence(['recent_expenses', 'insights']);
    expect(sequence[1]).toBe('active_outing');
    expect(sequence[2]).toBe('hero');
  });

  it('applies the saved order to movable cards and appends the missing ones', () => {
    const sequence = resolveDashboardCardSequence(['recent_expenses', 'insights']);
    const movable = sequence.filter((id) => id !== 'active_outing' && id !== 'hero');
    expect(movable[0]).toBe('recent_expenses');
    expect(movable[1]).toBe('insights');
    // The rest keeps catalog order.
    expect(movable.slice(2)).toEqual([
      'today_events',
      'daily_checkin',
      'savings_goal',
      'piggy_bank',
      'occasion_counters',
      'amigo_sincero',
      'pending_shares',
      'funds_summary',
      'trip_analytics',
    ]);
  });

  it('drops unknown ids from the saved order', () => {
    const sequence = resolveDashboardCardSequence(['ghost_card', 'insights']);
    expect(sequence).toHaveLength(CATALOG_ORDER.length);
    expect(sequence).not.toContain('ghost_card');
  });
});

describe('hide / show', () => {
  it('toggles visibility for movable cards', () => {
    const hidden = toggleDashboardCardHidden('insights', []);
    expect(hidden).toEqual(['insights']);
    expect(isDashboardCardHidden('insights', hidden)).toBe(true);
    expect(toggleDashboardCardHidden('insights', hidden)).toEqual([]);
  });

  it('never hides anchors', () => {
    expect(toggleDashboardCardHidden('hero', [])).toEqual([]);
    expect(isDashboardCardHidden('hero', ['hero'])).toBe(false);
  });
});

describe('moveDashboardCard', () => {
  it('moves a card up among the movable cards', () => {
    const order = moveDashboardCard(undefined, 'occasion_counters', 'up');
    // Default movable order: today_events, daily_checkin, savings_goal,
    // piggy_bank, occasion_counters, insights, …
    expect(order[0]).toBe('today_events');
    expect(order[1]).toBe('daily_checkin');
    expect(order[2]).toBe('savings_goal');
    // occasion_counters swaps up past piggy_bank.
    expect(order[3]).toBe('occasion_counters');
    expect(order[4]).toBe('piggy_bank');
  });

  it('does not move past the edges', () => {
    const order = moveDashboardCard(undefined, 'today_events', 'up');
    expect(order[0]).toBe('today_events');
  });

  it('round-trips through resolveDashboardCardSequence', () => {
    const order = moveDashboardCard(undefined, 'recent_expenses', 'up');
    const sequence = resolveDashboardCardSequence(order);
    const movable = sequence.filter((id) => id !== 'active_outing' && id !== 'hero');
    // recent_expenses is the last movable card; moving it up swaps with the
    // trip_analytics drawer, which becomes last.
    expect(movable[movable.length - 1]).toBe('trip_analytics');
    expect(movable[movable.length - 2]).toBe('recent_expenses');
  });
});

// UX polish (D3): collapsible analytics drawer — closed by default.
describe('collapse / expand', () => {
  it('reports the trip_analytics drawer as collapsed by default', () => {
    expect(DEFAULT_COLLAPSED_CARDS).toContain('trip_analytics');
    // undefined settings fall back to the default collapsed set.
    expect(isDashboardCardCollapsed('trip_analytics', undefined)).toBe(true);
  });

  it('honours an explicit empty collapsed list (user expanded it)', () => {
    expect(isDashboardCardCollapsed('trip_analytics', [])).toBe(false);
  });

  it('never reports non-collapsible cards as collapsed', () => {
    expect(isDashboardCardCollapsed('hero', undefined)).toBe(false);
    expect(isDashboardCardCollapsed('recent_expenses', ['recent_expenses'])).toBe(false);
  });

  it('toggles the collapsed state for a collapsible card', () => {
    // From the default (collapsed) → expand → collapse again.
    const expanded = toggleDashboardCardCollapsed('trip_analytics', DEFAULT_COLLAPSED_CARDS);
    expect(expanded).not.toContain('trip_analytics');
    expect(isDashboardCardCollapsed('trip_analytics', expanded)).toBe(false);
    const collapsedAgain = toggleDashboardCardCollapsed('trip_analytics', expanded);
    expect(collapsedAgain).toContain('trip_analytics');
  });

  it('is a no-op for non-collapsible cards', () => {
    expect(toggleDashboardCardCollapsed('hero', [])).toEqual([]);
  });
});
