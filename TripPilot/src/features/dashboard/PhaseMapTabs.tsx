import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import type { PhaseAllowanceDay, PhaseAllowanceMap } from '@/domain/phases';
import type { MonthHeatmap } from '@/domain/dashboard';
import { AvailableCalendar } from './cards/AvailableCalendar';
import { HeatmapGrid } from './cards/HeatmapGrid';

type PhaseMapTab = 'available' | 'spent';

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
            <p className="text-xs font-bold text-on-surface mt-3">
              {formatLongDay(selectedSpent.dayIso)} · {formatMoney(selectedSpent.totalCents, currency)}
            </p>
          ) : (
            <p className="text-xs font-semibold text-on-surface-dim mt-3">
              {t('dashboard.heatmap_total', {
                amount: formatMoney(heatmap.monthTotalCents, currency),
              })}
            </p>
          )}
          <p className="text-[11px] text-on-surface-faint mt-1 leading-snug">
            {t('dashboard.phase_map_spent_hint')}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * F20: the open "why is today this much" — €X free + each reserve = €Y total.
 * The reserve already left `trueFree`; surfacing it here is display-only.
 */
function DayBreakdown({
  day,
  currency,
  label,
}: {
  day: PhaseAllowanceDay;
  currency: string;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 p-3 rounded-xl bg-surface-container">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-on-surface">
          {day.isToday ? t('dashboard.day_map_today') : label}
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
    </div>
  );
}
