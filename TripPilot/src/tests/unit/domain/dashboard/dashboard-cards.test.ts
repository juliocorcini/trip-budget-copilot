import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_CARD_CATALOG,
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  toggleDashboardCardHidden,
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
      'yesterday_recap',
      'occasion_counters',
      'phase_burndown',
      'spend_heatmap',
      'amigo_sincero',
      'pending_shares',
      'funds_summary',
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
    // Default movable order: today_events, yesterday_recap, occasion_counters, …
    expect(order[0]).toBe('today_events');
    expect(order[1]).toBe('occasion_counters');
    expect(order[2]).toBe('yesterday_recap');
  });

  it('does not move past the edges', () => {
    const order = moveDashboardCard(undefined, 'today_events', 'up');
    expect(order[0]).toBe('today_events');
  });

  it('round-trips through resolveDashboardCardSequence', () => {
    const order = moveDashboardCard(undefined, 'recent_expenses', 'up');
    const sequence = resolveDashboardCardSequence(order);
    const movable = sequence.filter((id) => id !== 'active_outing' && id !== 'hero');
    expect(movable[movable.length - 1]).toBe('funds_summary');
    expect(movable[movable.length - 2]).toBe('recent_expenses');
  });
});
