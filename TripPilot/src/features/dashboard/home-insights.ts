import type { DashboardInsight } from '@/domain/insights';

/**
 * Audit §4.2 (G13) — the Home shows at most this many insights at rest; the
 * rest stay one tap away behind "ver mais". Insights arrive priority-sorted
 * (warnings first, see `buildDashboardInsights`), so the visible slice is
 * always the most important ones — a cap, not a filter.
 *
 * Julio field feedback: raised 4 → 6 so the Home surfaces more at rest before
 * folding the rest behind "ver mais".
 */
export const HOME_INSIGHTS_CAP = 6;

export interface CappedInsights {
  /** The insights to render right now. */
  visible: DashboardInsight[];
  /** How many are held back behind "ver mais" (0 when nothing is hidden). */
  hiddenCount: number;
}

/**
 * Caps the Home insight carousel to `max` items unless the user expanded it.
 * Pure — the caller owns the `showAll` toggle. Nothing is dropped: the hidden
 * ones are revealed in place when `showAll` flips (ÂNCORA 9, nothing removed).
 */
export function capHomeInsights(
  insights: DashboardInsight[],
  showAll: boolean,
  max: number = HOME_INSIGHTS_CAP,
): CappedInsights {
  if (showAll || insights.length <= max) {
    return { visible: insights, hiddenCount: 0 };
  }
  return { visible: insights.slice(0, max), hiddenCount: insights.length - max };
}
