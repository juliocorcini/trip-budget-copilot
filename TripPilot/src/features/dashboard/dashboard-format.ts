import { formatMoney, fromCents } from '@/domain/money';
import { getActiveDecimalSeparator, getActiveIntlLocale } from '@/domain/locale';
import type { DashboardInsight } from '@/domain/insights';

type TranslateFn = (key: string, options?: Record<string, string | number>) => string;

export function splitMoneyDisplay(
  cents: number,
  currency: string,
): { symbol: string; integer: string; decimal: string } {
  const value = fromCents(cents);
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const symbolMap: Record<string, string> = { EUR: '€', USD: '$', BRL: 'R$', GBP: '£' };
  const symbol = symbolMap[currency] ?? currency;

  return {
    symbol,
    integer: `${symbol}${intPart}`,
    // PAR-002 (R6-16): decimal separator follows the active language.
    decimal: `${getActiveDecimalSeparator()}${decPart.toString().padStart(2, '0')}`,
  };
}

// R6-11 (R-02): per-category Mediterranean accents for the counter carousel —
// the old fallback grid had them and the carousel had flattened everything
// to terracotta. Data-driven, mirrors the semantic tokens.
const COUNTER_ACCENTS: Record<string, { color: string; bg: string }> = {
  bar: { color: 'var(--primary)', bg: '#C75B3918' },
  restaurant: { color: 'var(--warning)', bg: '#D4A84318' },
  market: { color: 'var(--success)', bg: '#6B8F7118' },
  transport: { color: '#5B8FA6', bg: '#5B8FA618' },
  outing: { color: 'var(--primary)', bg: '#C75B3918' },
  entertainment: { color: '#9A7BB8', bg: '#9A7BB818' },
  health: { color: 'var(--success)', bg: '#6B8F7118' },
  accommodation: { color: '#5B8FA6', bg: '#5B8FA618' },
  other: { color: 'var(--on-surface-dim)', bg: '#8A8A8A18' },
};

export function counterAccent(category: string | null | undefined): { color: string; bg: string } {
  return COUNTER_ACCENTS[category ?? 'other'] ?? COUNTER_ACCENTS.other!;
}

// DEC-077: icon per insight kind (data-driven).
export const INSIGHT_ICONS: Record<DashboardInsight['kind'], string> = {
  end_of_day: 'edit_note',
  phase_projection: 'query_stats',
  danger_day: 'local_fire_department',
  category_rhythm: 'donut_large',
  phase_countdown: 'flight_takeoff',
  rhythm_compare: 'speed',
  no_spend_streak: 'emoji_events',
  avg_outing_cost: 'local_bar',
  participant_balance: 'group',
  next_event: 'event',
  // D06 · DEC-317: relocated factual reads reuse the icons they had as Amigo
  // extras, so the same data reads the same at a glance — now as an insight.
  piggy_movement: 'savings',
  phase_progress: 'data_usage',
  daily_left: 'calendar_today',
  top_category: 'leaderboard',
  receivable: 'call_received',
};

/** Localized full weekday name (0=Sun..6=Sat) — Jan 4 1970 was a Sunday. */
export function weekdayLabel(index: number): string {
  const reference = new Date(Date.UTC(1970, 0, 4 + index));
  return new Intl.DateTimeFormat(getActiveIntlLocale(), {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(reference);
}

export function formatInsightText(
  insight: DashboardInsight,
  t: TranslateFn,
  currency: string,
): string {
  const v = insight.values;
  switch (insight.kind) {
    case 'phase_projection':
      return t(
        v.over ? 'dashboard.insight_projection_over' : 'dashboard.insight_projection_under',
        {
          projected: formatMoney(v.projectedCents as number, currency),
          diff: formatMoney(v.diffCents as number, currency),
        },
      );
    case 'rhythm_compare':
      return t(v.over ? 'dashboard.insight_rhythm_over' : 'dashboard.insight_rhythm_under', {
        real: formatMoney(v.realDailyCents as number, currency),
        planned: formatMoney(v.plannedDailyCents as number, currency),
      });
    case 'no_spend_streak':
      return t('dashboard.insight_no_spend', { count: v.days as number });
    case 'avg_outing_cost':
      return t('dashboard.insight_avg_outing', {
        amount: formatMoney(v.avgCents as number, currency),
        count: v.count as number,
      });
    case 'participant_balance':
      return t(
        v.owedToMe ? 'dashboard.insight_balance_owed' : 'dashboard.insight_balance_owing',
        {
          name: v.name as string,
          amount: formatMoney(v.amountCents as number, currency),
        },
      );
    case 'next_event':
      return t(
        v.hasReserve ? 'dashboard.insight_next_event' : 'dashboard.insight_next_event_no_reserve',
        {
          name: v.name as string,
          count: v.days as number,
          amount: formatMoney(v.reservedCents as number, currency),
        },
      );
    case 'category_rhythm':
      return t('dashboard.insight_category_rhythm', {
        category: t(`categories.${v.category}` as never),
        percent: v.percent as number,
        day: v.daysElapsed as number,
        total: v.totalDays as number,
      });
    case 'danger_day':
      return t('dashboard.insight_danger_day', {
        weekday: weekdayLabel(v.weekday as number),
        multiplier: v.multiplier as number,
      });
    case 'phase_countdown':
      return t('dashboard.insight_phase_countdown', {
        name: v.name as string,
        count: v.days as number,
        perDay: formatMoney(v.perDayCents as number, currency),
      });
    case 'end_of_day':
      return t('dashboard.insight_end_of_day');
    // D06 · DEC-317: relocated factual reads — NEUTRAL framing (the opinionated
    // wording stays in the Amigo Sincero; the insight states the data plainly).
    case 'piggy_movement':
      return t(v.deposit ? 'dashboard.insight_piggy_in' : 'dashboard.insight_piggy_out', {
        amount: formatMoney(Math.abs(v.deltaCents as number), currency),
        balance: formatMoney(v.balanceCents as number, currency),
      });
    case 'phase_progress':
      return t('dashboard.insight_phase_progress', { percent: v.percent as number });
    case 'daily_left':
      return t('dashboard.insight_daily_left', {
        perDay: formatMoney(v.perDayCents as number, currency),
        days: v.days as number,
      });
    case 'top_category':
      return t('dashboard.insight_top_category', {
        category: t(`categories.${v.categoryKey}` as never),
        amount: formatMoney(v.amountCents as number, currency),
        percent: v.percent as number,
      });
    case 'receivable':
      return t('dashboard.insight_receivable', {
        amount: formatMoney(v.amountCents as number, currency),
      });
  }
}

/* ──────────────── M2: insights auto-rotation (pure, testable) ──────────────── */

/** How often the insights carousel advances on its own. */
export const INSIGHT_AUTO_ROTATE_MS = 7000;
/** After a manual interaction, auto-rotation stays paused for this long. */
export const INSIGHT_RESUME_DELAY_MS = 12000;

/** Index of the next insight in the rotation loop (wraps to the start). */
export function nextInsightIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/**
 * Auto-rotation only runs with 2+ insights and when the user has NOT asked
 * for reduced motion (accessibility) — a single insight has nothing to rotate.
 */
export function shouldAutoRotateInsights(count: number, prefersReducedMotion: boolean): boolean {
  return count >= 2 && !prefersReducedMotion;
}

export function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}
