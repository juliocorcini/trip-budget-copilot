import { describe, it, expect } from 'vitest';
import { capHomeInsights, HOME_INSIGHTS_CAP } from '@/features/dashboard/home-insights';
import type { DashboardInsight, DashboardInsightKind } from '@/domain/insights';

/**
 * GATE 13 (audit §4.2) — the Home shows at most N insights at rest, the rest
 * behind "ver mais". This proves the cap math: it never drops anything, keeps
 * the priority-sorted order the builder produced, and reports the overflow.
 */
const KINDS: DashboardInsightKind[] = [
  'phase_projection',
  'rhythm_compare',
  'danger_day',
  'no_spend_streak',
  'category_rhythm',
  'avg_outing_cost',
  'next_event',
];

function makeInsights(n: number): DashboardInsight[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: KINDS[i % KINDS.length]!,
    tone: 'warning' as const,
    priority: 100 - i,
    values: {},
  }));
}

describe('capHomeInsights — Home warning cap (G13)', () => {
  it('passes everything through untouched when at or below the cap', () => {
    const list = makeInsights(HOME_INSIGHTS_CAP);
    const { visible, hiddenCount } = capHomeInsights(list, false);
    expect(visible).toHaveLength(HOME_INSIGHTS_CAP);
    expect(hiddenCount).toBe(0);
    expect(visible).toEqual(list);
  });

  it('shows only the top N and reports the overflow when over the cap', () => {
    const list = makeInsights(HOME_INSIGHTS_CAP + 5);
    const { visible, hiddenCount } = capHomeInsights(list, false);
    expect(visible).toHaveLength(HOME_INSIGHTS_CAP);
    expect(hiddenCount).toBe(5);
  });

  it('keeps the incoming (priority-sorted) order — visible is the head slice', () => {
    const list = makeInsights(8);
    const { visible } = capHomeInsights(list, false);
    expect(visible).toEqual(list.slice(0, HOME_INSIGHTS_CAP));
  });

  it('reveals everything in place once expanded — nothing is ever dropped', () => {
    const list = makeInsights(10);
    const { visible, hiddenCount } = capHomeInsights(list, true);
    expect(visible).toEqual(list);
    expect(hiddenCount).toBe(0);
  });

  it('honours a custom cap', () => {
    const list = makeInsights(6);
    const { visible, hiddenCount } = capHomeInsights(list, false, 2);
    expect(visible).toHaveLength(2);
    expect(hiddenCount).toBe(4);
  });

  it('is safe on an empty list', () => {
    const { visible, hiddenCount } = capHomeInsights([], false);
    expect(visible).toEqual([]);
    expect(hiddenCount).toBe(0);
  });
});
