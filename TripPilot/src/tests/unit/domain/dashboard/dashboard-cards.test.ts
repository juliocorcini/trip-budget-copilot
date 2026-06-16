import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_CARD_CATALOG,
  DEFAULT_COLLAPSED_CARDS,
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  toggleDashboardCardHidden,
  isDashboardCardCollapsed,
  toggleDashboardCardCollapsed,
  isDashboardCardPairable,
  isDashboardCardPaired,
  toggleDashboardCardPaired,
  groupDashboardRows,
  moveDashboardCard,
  type DashboardCardId,
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
      'planned_purchases',
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
    // planned_purchases tile, which becomes last.
    expect(movable[movable.length - 1]).toBe('planned_purchases');
    expect(movable[movable.length - 2]).toBe('recent_expenses');
  });
});

// FIELD item 16: curated 2-up grid — opt-in pairing of compact cards.
describe('pairable cards (2-up grid)', () => {
  it('marks only the compact single-number cards as pairable', () => {
    expect(isDashboardCardPairable('savings_goal')).toBe(true);
    expect(isDashboardCardPairable('piggy_bank')).toBe(true);
    expect(isDashboardCardPairable('planned_purchases')).toBe(true);
    expect(isDashboardCardPairable('funds_summary')).toBe(true);
    // Rich cards and anchors stay full width.
    expect(isDashboardCardPairable('hero')).toBe(false);
    expect(isDashboardCardPairable('daily_checkin')).toBe(false);
    expect(isDashboardCardPairable('recent_expenses')).toBe(false);
    expect(isDashboardCardPairable('insights')).toBe(false);
  });

  it('toggles a pairable card in and out of the opted-in set', () => {
    const paired = toggleDashboardCardPaired('piggy_bank', []);
    expect(paired).toEqual(['piggy_bank']);
    expect(isDashboardCardPaired('piggy_bank', paired)).toBe(true);
    expect(toggleDashboardCardPaired('piggy_bank', paired)).toEqual([]);
  });

  it('is a no-op for non-pairable cards', () => {
    expect(toggleDashboardCardPaired('hero', [])).toEqual([]);
    expect(isDashboardCardPaired('hero', ['hero'])).toBe(false);
  });
});

describe('groupDashboardRows', () => {
  const pair = (...ids: DashboardCardId[]) => new Set<DashboardCardId>(ids);

  it('renders everything full width when nothing is paired', () => {
    const seq: DashboardCardId[] = ['hero', 'savings_goal', 'piggy_bank'];
    expect(groupDashboardRows(seq, pair())).toEqual([
      { kind: 'full', id: 'hero' },
      { kind: 'full', id: 'savings_goal' },
      { kind: 'full', id: 'piggy_bank' },
    ]);
  });

  it('pairs two adjacent opted-in compact cards into one row', () => {
    const seq: DashboardCardId[] = ['hero', 'savings_goal', 'piggy_bank', 'recent_expenses'];
    expect(groupDashboardRows(seq, pair('savings_goal', 'piggy_bank'))).toEqual([
      { kind: 'full', id: 'hero' },
      { kind: 'pair', ids: ['savings_goal', 'piggy_bank'] },
      { kind: 'full', id: 'recent_expenses' },
    ]);
  });

  it('does not pair across a full-width card between two compact cards', () => {
    const seq: DashboardCardId[] = ['savings_goal', 'recent_expenses', 'piggy_bank'];
    expect(groupDashboardRows(seq, pair('savings_goal', 'piggy_bank'))).toEqual([
      { kind: 'full', id: 'savings_goal' },
      { kind: 'full', id: 'recent_expenses' },
      { kind: 'full', id: 'piggy_bank' },
    ]);
  });

  it('leaves a lone opted-in card full width and pairs the next two', () => {
    const seq: DashboardCardId[] = ['savings_goal', 'piggy_bank', 'planned_purchases'];
    // All three opted in: first two pair, the third is left over as full.
    expect(groupDashboardRows(seq, pair('savings_goal', 'piggy_bank', 'planned_purchases'))).toEqual(
      [
        { kind: 'pair', ids: ['savings_goal', 'piggy_bank'] },
        { kind: 'full', id: 'planned_purchases' },
      ],
    );
  });

  it('treats a not-opted-in compact card as a full-width separator', () => {
    const seq: DashboardCardId[] = ['savings_goal', 'funds_summary', 'piggy_bank'];
    // funds_summary not opted in → flushes savings_goal full, piggy_bank ends full.
    expect(groupDashboardRows(seq, pair('savings_goal', 'piggy_bank'))).toEqual([
      { kind: 'full', id: 'savings_goal' },
      { kind: 'full', id: 'funds_summary' },
      { kind: 'full', id: 'piggy_bank' },
    ]);
  });
});

// U6 (DEC-180): the analytics drawer (the only collapsible card) moved to the
// Copiloto. The collapse machinery stays as dormant, generic infra — no catalog
// card is collapsible anymore.
describe('collapse / expand (dormant)', () => {
  it('has nothing collapsed by default', () => {
    expect(DEFAULT_COLLAPSED_CARDS).toEqual([]);
  });

  it('never reports a card as collapsed (none are collapsible)', () => {
    expect(isDashboardCardCollapsed('hero', undefined)).toBe(false);
    expect(isDashboardCardCollapsed('recent_expenses', ['recent_expenses'])).toBe(false);
  });

  it('is a no-op for non-collapsible cards', () => {
    expect(toggleDashboardCardCollapsed('hero', [])).toEqual([]);
    expect(toggleDashboardCardCollapsed('recent_expenses', [])).toEqual([]);
  });
});
