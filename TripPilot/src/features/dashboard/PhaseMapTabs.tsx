import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import type { PhaseAllowanceDay, PhaseAllowanceMap } from '@/domain/phases';
import type { HeatmapDay, MonthHeatmap } from '@/domain/dashboard';
import { getCategoryIcon } from '@/utils/category-icons';
import { AvailableCalendar } from './cards/AvailableCalendar';
import { HeatmapGrid } from './cards/HeatmapGrid';

type PhaseMapTab = 'available' | 'spent';

/** GATE 19: cap the day's category rows so a busy day never becomes a long list. */
const MAX_SPENT_ROWS = 5;

interface PhaseMapTabsProps {
  map: PhaseAllowanceMap;
  heatmap: MonthHeatmap;
  currency: string;
  todayIso: string;
}

/**
 * F4 + F20 + F22 — the phase map. One card with two VISIBLE tabs (no
 * auto-rotation, per Julio's decision): "Available per day" (a calendar shaded
 * by each day's free + reserved total, the default) and "Spending per day" (the
 * month heatmap). Tapping a day drills into its breakdown.
 */
export function PhaseMapTabs({ map, heatmap, currency, todayIso }: PhaseMapTabsProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'pt-BR';
  const [tab, setTab] = useState<PhaseMapTab>('available');
  const [availableDayIso, setAvailableDayIso] = useState<string | null>(null);
  const [spentDayIso, setSpentDayIso] = useState<string | null>(null);

  const selectedDay = availableDayIso
    ? map.days.find((d) => d.dateIso === availableDayIso) ?? null
    : null;
  const selectedSpent = spentDayIso
    ? heatmap.days.find((d) => d.dayIso === spentDayIso) ?? null
    : null;

  const formatLongDay = (iso: string) => {
    const label = new Date(`${iso.slice(0, 10)}T12:00:00`)
      .toLocaleDateString(lang, { weekday: 'long', day: '2-digit', month: 'short' })
      .replace('.', '');
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const tabs: { id: PhaseMapTab; labelKey: string }[] = [
    { id: 'available', labelKey: 'dashboard.phase_map_tab_available' },
    { id: 'spent', labelKey: 'dashboard.phase_map_tab_spent' },
  ];

  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-faint)]">
      <p className="text-sm font-bold text-on-surface">{t('dashboard.day_map_title')}</p>
      <p className="text-xs text-on-surface-dim mt-0.5 mb-3">{t('dashboard.phase_map_intro')}</p>

      {/* F22: segmented control — both tabs always visible, no auto-rotation. */}
      <div className="flex p-1 rounded-xl bg-surface-container mb-3" role="tablist">
        {tabs.map(({ id, labelKey }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold btn-press transition-colors ${
                active ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-dim'
              }`}
            >
              {t(labelKey as never)}
            </button>
          );
        })}
      </div>

      {tab === 'available' ? (
        <>
          <AvailableCalendar
            map={map}
            currency={currency}
            selectedDayIso={availableDayIso}
            onSelectDay={(iso) => setAvailableDayIso((cur) => (cur === iso ? null : iso))}
          />

          {selectedDay ? (
            <DayBreakdown
              day={selectedDay}
              currency={currency}
              label={formatLongDay(selectedDay.dateIso)}
              explain={{ normalAllowanceCents: map.normalAllowanceCents, hasRhythm: map.hasRhythm }}
            />
          ) : (
            <p className="text-[11px] text-on-surface-faint mt-3 leading-snug">
              {t('dashboard.phase_map_available_hint')}
            </p>
          )}

          {map.undatedPlanItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-faint)]">
              <p className="text-[11px] font-semibold text-on-surface-dim mb-1.5">
                {t('dashboard.day_map_undated', {
                  amount: formatMoney(map.undatedPlanTotalCents, currency),
                })}
              </p>
              <div className="flex flex-wrap gap-1">
                {map.undatedPlanItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--primary-dim)' }}
                  >
                    <Icon name="shopping_bag" size={11} />
                    {item.name} · {formatMoney(item.amountCents, currency)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <HeatmapGrid
            heatmap={heatmap}
            currency={currency}
            todayIso={todayIso}
            selectedDayIso={spentDayIso}
            onSelectDay={(iso) => setSpentDayIso((cur) => (cur === iso ? null : iso))}
          />

          {selectedSpent ? (
            <SpentDayBreakdown
              day={selectedSpent}
              currency={currency}
              label={formatLongDay(selectedSpent.dayIso)}
            />
          ) : (
            <>
              <p className="text-xs font-semibold text-on-surface-dim mt-3">
                {t('dashboard.heatmap_total', {
                  amount: formatMoney(heatmap.monthTotalCents, currency),
                })}
              </p>
              <p className="text-[11px] text-on-surface-faint mt-1 leading-snug">
                {t('dashboard.phase_map_spent_hint')}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * F20: the open "why is today this much" — €X free + each reserve = €Y total.
 * The reserve already left `trueFree`; surfacing it here is display-only.
 *
 * F18: the phase preview reuses this same breakdown. There the first day is the
 * phase's "day one", not the real today, so `hideToday` keeps the date label
 * instead of the "Hoje" tag.
 */
export function DayBreakdown({
  day,
  currency,
  label,
  hideToday = false,
  explain,
}: {
  day: PhaseAllowanceDay;
  currency: string;
  label: string;
  hideToday?: boolean;
  /**
   * GATE 19: when provided, the card explains WHERE the day's free number comes
   * from (the phase reserve spread across days, why a peak day is higher, and
   * that planned reserves are already set aside). Optional so the math is
   * unchanged for callers that only want the raw breakdown.
   */
  explain?: { normalAllowanceCents: number; hasRhythm: boolean };
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 p-3 rounded-xl bg-surface-container">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-on-surface">
          {day.isToday && !hideToday ? t('dashboard.day_map_today') : label}
        </p>
        <p className="text-sm font-bold tabular text-on-surface">
          {formatMoney(day.dayTotalCents, currency)}
        </p>
      </div>

      <div className="flex items-baseline justify-between py-0.5">
        <span className="text-xs text-on-surface-dim">{t('dashboard.phase_map_free')}</span>
        <span
          className={`text-xs font-semibold tabular ${
            day.freeCents < 0 ? 'text-error' : 'text-on-surface'
          }`}
        >
          {formatMoney(day.freeCents, currency)}
        </span>
      </div>

      {day.planItems.map((item) => (
        <div key={item.id} className="flex items-baseline justify-between py-0.5">
          <span className="text-xs text-on-surface-dim inline-flex items-center gap-1 min-w-0">
            <Icon name={item.kind === 'occurrence' ? 'event' : 'shopping_bag'} size={12} />
            <span className="truncate">{item.name}</span>
          </span>
          <span className="text-xs font-semibold tabular text-on-surface flex-shrink-0">
            + {formatMoney(item.amountCents, currency)}
          </span>
        </div>
      ))}

      {day.planItems.length > 0 && (
        <div className="flex items-baseline justify-between pt-1.5 mt-1 border-t border-[var(--border-faint)]">
          <span className="text-xs font-bold text-on-surface">{t('dashboard.phase_map_day_total')}</span>
          <span className="text-xs font-bold tabular text-on-surface">
            {formatMoney(day.dayTotalCents, currency)}
          </span>
        </div>
      )}

      {/* DEC-392 (G2): lead with the common-day BASE amount, then the explicit
          peak DELTA, then the reserved/event — so "why €52" reads as base + pico
          + evento instead of a single weighted "free". Display-only: these are the
          start-of-day shares; the actual free/total rows above are untouched. */}
      {explain && (
        <div className="mt-2 pt-2 border-t border-[var(--border-faint)] space-y-1">
          <ExplainAmount
            icon="savings"
            label={t('dashboard.day_explain_base_amount')}
            amount={formatMoney(explain.normalAllowanceCents, currency)}
          />
          {explain.hasRhythm && day.isPeakDay && day.allowanceCents > explain.normalAllowanceCents && (
            <ExplainAmount
              icon="trending_up"
              label={t('dashboard.day_explain_peak_delta')}
              amount={`+ ${formatMoney(day.allowanceCents - explain.normalAllowanceCents, currency)}`}
            />
          )}
          {day.planTotalCents > 0 && (
            <ExplainAmount
              icon="event_available"
              label={t('dashboard.day_explain_reserved')}
              amount={`+ ${formatMoney(day.planTotalCents, currency)}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ExplainAmount({ icon, label, amount }: { icon: string; label: string; amount: string }) {
  return (
    <p className="text-[11px] text-on-surface-faint leading-snug flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 min-w-0">
        <Icon name={icon} size={12} className="flex-shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="tabular font-semibold flex-shrink-0">{amount}</span>
    </p>
  );
}

/**
 * GATE 19: the spent-day drill-down. Beyond the bare day total it now lists the
 * categories that made up that day's spend (sorted by amount), so "spent €83"
 * becomes "€60 market · €18 bar · €5 transport". Capped at MAX_SPENT_ROWS with a
 * "+N in other categories" tail; the categories sum to the day total.
 */
function SpentDayBreakdown({
  day,
  currency,
  label,
}: {
  day: HeatmapDay;
  currency: string;
  label: string;
}) {
  const { t } = useTranslation();
  const rows = day.byCategory.filter((c) => c.totalCents !== 0);
  const visible = rows.slice(0, MAX_SPENT_ROWS);
  const hidden = Math.max(0, rows.length - MAX_SPENT_ROWS);

  return (
    <div className="mt-3 p-3 rounded-xl bg-surface-container">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-on-surface">{label}</p>
        <p className="text-sm font-bold tabular text-on-surface">
          {formatMoney(day.totalCents, currency)}
        </p>
      </div>

      {visible.length > 0 ? (
        <>
          {visible.map((row) => (
            <div key={row.category} className="flex items-baseline justify-between py-0.5">
              <span className="text-xs text-on-surface-dim inline-flex items-center gap-1.5 min-w-0">
                <Icon name={getCategoryIcon(row.category)} size={13} className="flex-shrink-0" />
                <span className="truncate">{t(`categories.${row.category}` as never)}</span>
              </span>
              <span className="text-xs font-semibold tabular text-on-surface flex-shrink-0">
                {formatMoney(row.totalCents, currency)}
              </span>
            </div>
          ))}
          {hidden > 0 && (
            <p className="text-[11px] text-on-surface-faint pt-1">
              {t('dashboard.day_spent_more', { count: hidden })}
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] text-on-surface-faint leading-snug">
          {t('dashboard.day_spent_none')}
        </p>
      )}

      <p className="text-[11px] text-on-surface-faint mt-2 pt-2 border-t border-[var(--border-faint)] leading-snug">
        {t('dashboard.day_spent_recent_hint')}
      </p>
    </div>
  );
}
