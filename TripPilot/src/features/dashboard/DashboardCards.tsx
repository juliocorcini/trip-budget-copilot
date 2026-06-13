import { useState, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import { getCategoryIcon } from '@/utils/category-icons';
import {
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  getDashboardCard,
  shiftMonth,
  type DashboardCardId,
} from '@/domain/dashboard';
import { useLongPress } from '@/hooks/useLongPress';
import type { DashboardInsight } from '@/domain/insights';
import type { Trip } from '@/domain/types/trip';
import type { AppSettings } from '@/domain/types/app-settings';
import { RecapCard } from '@/features/dashboard/cards/RecapCard';
import { BurndownCard } from '@/features/dashboard/cards/BurndownCard';
import { HeatmapCard } from '@/features/dashboard/cards/HeatmapCard';
import { OccasionCounter } from '@/features/dashboard/cards/OccasionCounter';
import { counterAccent, INSIGHT_ICONS, formatInsightText, formatElapsed } from './dashboard-format';
import type { DashboardModel } from './useDashboardModel';

interface DashboardCardsProps {
  model: DashboardModel;
  trip: Trip;
  settings: AppSettings;
  heatmapMonth: string;
  setHeatmapMonth: Dispatch<SetStateAction<string>>;
  onOpenConfirmSheet: () => void;
  onConfigCard: (id: DashboardCardId) => void;
  onPostponeEvent: (occurrenceId: string) => void;
  onInsightTap: (insight: DashboardInsight) => void;
  onSelectHeatmapDay: (iso: string) => void;
}

// BUG-008: the home cards moved out of the 1.6k-line DashboardPage into one
// presentational component driven entirely by the memoized DashboardModel.
export function DashboardCards({
  model,
  trip,
  settings,
  heatmapMonth,
  setHeatmapMonth,
  onOpenConfirmSheet,
  onConfigCard,
  onPostponeEvent,
  onInsightTap,
  onSelectHeatmapDay,
}: DashboardCardsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // DEC-091 (R-09): swipe carousel of insights; DEC-076: occasion carousel page.
  const [insightIndex, setInsightIndex] = useState(0);
  const [carouselPage, setCarouselPage] = useState(0);
  const insightScrollRef = useRef<HTMLDivElement>(null);
  // DEC-119 (R-10): long-press on a card opens its options sheet.
  const getCardLongPress = useLongPress((id) => onConfigCard(id as DashboardCardId));

  const renderDashboardCard = (id: DashboardCardId): ReactNode => {
    switch (id) {
      case 'today_events':
        return (
          <>
            {/* §7 pos. 3 — DEC-072 (M6.3): DAY CARD — today's planned events without a session */}
            {model.todayEvents.map((occ) => (
              <div
                key={occ.id}
                className="mt-4 p-4 rounded-2xl"
                style={{ background: 'var(--surface-deep)', border: '1px solid var(--border-faint)' }}
              >
                {/* DEC-101 (R-23): tapping the event opens ITS edit sheet */}
                <button
                  className="flex items-center gap-2.5 w-full text-left btn-press"
                  onClick={() => navigate(`/trip/edit?occurrence=${occ.id}`)}
                >
                  <Icon
                    name={occ.kind === 'sub_destination' ? 'location_on' : 'celebration'}
                    size={20}
                    filled
                    className="text-primary"
                  />
                  <p className="text-sm font-extrabold text-on-surface flex-1 truncate">
                    {t('dashboard.event_today', { name: occ.name })}
                  </p>
                  {occ.reservedCents !== null && (
                    <span className="text-xs font-bold tabular text-on-surface-dim">
                      {t('dashboard.event_reserved', {
                        amount: formatMoney(occ.reservedCents, trip.baseCurrency),
                      })}
                    </span>
                  )}
                </button>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate(`/outings/new?occurrence=${occ.id}`)}
                    className="flex-1 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
                  >
                    {t('dashboard.event_start_now')}
                  </button>
                  <button
                    onClick={() => onPostponeEvent(occ.id)}
                    className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                  >
                    {t('dashboard.event_postpone')}
                  </button>
                </div>
              </div>
            ))}
          </>
        );
      case 'active_outing':
        return (
          <>
            {/* §7 pos. 4 — ACTIVE OUTING CARD */}
            {model.activeSession && (
              <button
                onClick={() => navigate('/outings/active')}
                className="w-full mt-4 p-4 rounded-2xl flex items-center gap-4 btn-press text-left"
                style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#C75B3925' }}
                >
                  <Icon name={model.sessionIcon} size={24} filled className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
                    {t('dashboard.active_outing')} · {formatElapsed(model.activeSession.startedAt)}
                  </p>
                  <p className="text-base font-extrabold mt-0.5 text-on-surface truncate">
                    {model.activeSession.name}
                  </p>
                  <p className="text-xs font-semibold mt-0.5 text-on-surface-dim">
                    {t('dashboard.active_outing_spent', {
                      amount: formatMoney(model.sessionTotalCents, trip.baseCurrency),
                    })}
                    {model.sessionDrinksLeft !== null &&
                      ` · ${t('dashboard.session_drinks_left', { count: model.sessionDrinksLeft })}`}
                  </p>
                </div>
                <span
                  className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--primary)', color: 'var(--surface)' }}
                >
                  {t('dashboard.active_outing_open')}
                </span>
              </button>
            )}
          </>
        );
      case 'hero':
        return (
          <>
            {/* §7 pos. 5 — HERO CARD */}
            {model.fts && model.heroMoney && (
              <div className="mt-5 p-5 rounded-2xl bg-surface-container">
                <p className="text-xs font-bold" style={{ color: '#C75B39aa' }}>
                  {t('dashboard.free_to_spend', {
                    date: model.activePhase ? formatDate(model.activePhase.endDate, "d 'de' MMMM") : '',
                  })}
                </p>
                <p className="text-[44px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
                  {model.heroMoney.integer}
                  <span className="text-xl font-bold text-on-surface-dim">{model.heroMoney.decimal}</span>
                </p>
                {model.todayBudget && model.todayBudget.todayAllowanceCents > 0 && (
                  <>
                    <p
                      className={`text-xs font-bold mt-1.5 ${
                        model.todayBudget.freeTodayCents < 0
                          ? 'text-error'
                          : model.todayBudget.isPeakDay
                            ? 'text-warning'
                            : 'text-on-surface-dim'
                      }`}
                    >
                      {model.todayBudget.isPeakDay
                        ? t('dashboard.peak_day_free', {
                            amount: formatMoney(model.todayBudget.freeTodayCents, trip.baseCurrency),
                          })
                        : t('dashboard.free_per_day', {
                            amount: formatMoney(model.todayBudget.freeTodayCents, trip.baseCurrency),
                          })}
                    </p>
                    {/* DEC-088: the recalculated average becomes a secondary, named metric */}
                    <p className="text-[11px] font-semibold mt-0.5 text-on-surface-faint">
                      {t('dashboard.avg_daily_until_end', {
                        amount: formatMoney(model.todayBudget.avgDailyUntilEndCents, trip.baseCurrency),
                      })}
                    </p>
                  </>
                )}
                <div
                  className="w-full h-2 rounded-full overflow-hidden mt-4"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, model.progressPercent)}%`,
                      background: 'linear-gradient(90deg, var(--success), var(--primary))',
                    }}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.fund_balance')}</span>
                    <span className="text-xs font-bold tabular text-on-surface-dim">
                      {formatMoney(model.fts.totalBudgetCents - model.fts.totalSpentCents, trip.baseCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.protected_reserve')}</span>
                    <span className="text-xs font-bold tabular text-on-surface-faint">
                      {formatMoney(model.fts.protectedReserveCents, trip.baseCurrency)}
                    </span>
                  </div>
                  {/* DEC-072: active event reserves deduct from freeToSpend */}
                  {model.fts.eventReservesCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-on-surface-dim">
                        {t('dashboard.reserved_events')}
                      </span>
                      <span className="text-xs font-bold tabular" style={{ color: 'var(--primary-dim)' }}>
                        {formatMoney(model.fts.eventReservesCents, trip.baseCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
      case 'yesterday_recap':
        // DEC-129: hidden until there is a past day worth recapping.
        return model.recap ? (
          <RecapCard recap={model.recap} currency={trip.baseCurrency} onOpen={() => navigate('/expenses')} />
        ) : null;
      case 'phase_burndown':
        // DEC-130: needs an active phase with a positive budget envelope.
        return model.burndown ? (
          <BurndownCard burndown={model.burndown} currency={trip.baseCurrency} onOpen={() => navigate('/impact')} />
        ) : null;
      case 'spend_heatmap':
        // DEC-131: pointless before the first registered expense.
        return model.hasTransactions ? (
          <HeatmapCard
            heatmap={model.heatmap}
            currency={trip.baseCurrency}
            todayIso={model.todayIso}
            canPrev={heatmapMonth > model.tripStartMonth}
            canNext={heatmapMonth < model.currentMonth}
            onPrev={() => setHeatmapMonth((m) => shiftMonth(m, -1))}
            onNext={() => setHeatmapMonth((m) => shiftMonth(m, 1))}
            onSelectDay={onSelectHeatmapDay}
          />
        ) : null;
      case 'occasion_counters':
        return (
          <>
            {/* §7 pos. 6 — OCCASION COUNTERS — carousel (DEC-076), done-count fallback */}
            {model.forecasts.length > 0 ? (
              <div className="mt-4">
                {/* DEC-076/DEC-122 (R-01): pure-CSS scroll-snap carousel, ~3 visible */}
                <div
                  className="flex gap-3 overflow-x-auto no-scrollbar -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] scroll-pl-[var(--page-padding-x)] scroll-pr-[var(--page-padding-x)] snap-x snap-mandatory"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const pageCount = Math.ceil(model.forecasts.length / 3);
                    const maxScroll = el.scrollWidth - el.clientWidth;
                    if (maxScroll <= 0) return;
                    const page = Math.round((el.scrollLeft / maxScroll) * (pageCount - 1));
                    if (page !== carouselPage) setCarouselPage(page);
                  }}
                >
                  {model.forecasts.map((forecast) => {
                    const profile = model.profiles.find((p) => p.id === forecast.profileId);
                    const accent = counterAccent(profile?.category);
                    return (
                      <div
                        key={forecast.profileId}
                        // R6-11 (R-02) / DEC-122: exactly 3 cards per page, snap-always.
                        className="snap-start snap-always shrink-0 w-[calc((100%-1.5rem)/3)] min-w-[104px] flex"
                      >
                        <OccasionCounter
                          icon={profile?.iconName ?? getCategoryIcon(profile?.category ?? 'other')}
                          count={forecast.remaining}
                          label={t('dashboard.occasion_remaining', { name: forecast.profileName })}
                          sublabel={t('dashboard.occasion_done', { count: forecast.spent })}
                          iconBg={accent.bg}
                          iconColor={accent.color}
                          onClick={() => navigate(`/expenses?profile=${forecast.profileId}`)}
                        />
                      </div>
                    );
                  })}
                </div>
                {model.forecasts.length > 3 && (
                  <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
                    {Array.from({ length: Math.ceil(model.forecasts.length / 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: i === carouselPage ? 'var(--primary)' : 'var(--surface-container-high)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : model.hasOccasionData ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <OccasionCounter
                  icon="local_bar"
                  count={model.barCount}
                  label={t('dashboard.occasion_bar')}
                  iconBg="#C75B3918"
                  iconColor="var(--primary)"
                  onClick={() => navigate('/expenses?category=bar')}
                />
                <OccasionCounter
                  icon="shopping_cart"
                  count={model.marketCount}
                  label={t('dashboard.occasion_market')}
                  iconBg="#6B8F7118"
                  iconColor="var(--success)"
                  onClick={() => navigate('/expenses?category=market')}
                />
                <OccasionCounter
                  icon="restaurant"
                  count={model.restaurantCount}
                  label={t('dashboard.occasion_restaurant')}
                  iconBg="#D4A84318"
                  iconColor="var(--warning)"
                  onClick={() => navigate('/expenses?category=restaurant')}
                />
              </div>
            ) : null}
          </>
        );
      case 'insights':
        return (
          <>
            {/* §7 pos. 7 — INSIGHTS (DEC-091 / R-09): swipe switches, tap details */}
            {model.insights.length > 0 && (
              <div className="mt-4 rounded-2xl bg-surface-container pb-1">
                <div
                  ref={insightScrollRef}
                  className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.clientWidth === 0) return;
                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                    if (idx !== insightIndex) setInsightIndex(idx);
                  }}
                >
                  {model.insights.map((insight) => (
                    <button
                      key={insight.kind}
                      onClick={() => onInsightTap(insight)}
                      // DEC-122 (R-02): snap-always — a strong swipe advances exactly one insight.
                      className="w-full shrink-0 snap-center snap-always p-4 text-left btn-press flex items-start gap-3"
                    >
                      <Icon
                        name={INSIGHT_ICONS[insight.kind]}
                        size={18}
                        className={
                          insight.tone === 'positive'
                            ? 'text-success'
                            : insight.tone === 'warning'
                              ? 'text-warning'
                              : 'text-primary'
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                          {t('dashboard.insights_title')}
                        </p>
                        <p className="text-[13px] font-semibold leading-snug mt-1 text-on-surface">
                          {formatInsightText(insight, t, trip.baseCurrency)}
                        </p>
                      </div>
                      <Icon name="chevron_right" size={14} className="text-on-surface-faint mt-1" />
                    </button>
                  ))}
                </div>
                {model.insights.length > 1 && (
                  <div className="flex justify-center gap-1.5 pb-2">
                    {model.insights.map((insight, i) => (
                      <button
                        key={insight.kind}
                        onClick={() =>
                          insightScrollRef.current?.scrollTo({
                            left: i * insightScrollRef.current.clientWidth,
                            behavior: 'smooth',
                          })
                        }
                        aria-label={`${t('dashboard.insights_title')} ${i + 1}`}
                        className="p-1 btn-press"
                      >
                        <span
                          className="block w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              i === Math.min(insightIndex, model.insights.length - 1)
                                ? 'var(--primary)'
                                : 'var(--surface-container-high)',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SAVINGS CARD — DEC-092 (R-10): cites the specific outing + reference */}
            {model.savings.hasSavings && (
              <div
                className="mt-3 p-3.5 rounded-2xl flex items-center gap-3"
                style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}
              >
                <Icon name="trending_up" className="text-success" />
                <p className="text-sm font-semibold text-success">
                  {t('dashboard.savings_last_outing', {
                    profile: model.savings.profileName.toLowerCase(),
                    spent: formatMoney(model.savings.spentCents, trip.baseCurrency),
                    saved: formatMoney(model.savings.savedCents, trip.baseCurrency),
                    typical: formatMoney(model.savings.typicalCents, trip.baseCurrency),
                  })}
                </p>
              </div>
            )}
          </>
        );
      case 'amigo_sincero':
        return (
          <>
            {/* §7 pos. 8 — AMIGO SINCERO v2 (DEC-093 / R-11): plan-based */}
            {model.amigoV2.kind !== 'none' && (
              <div
                className="mt-5 p-4 rounded-2xl"
                style={{ background: '#C75B3910', border: '1px solid #C75B3918' }}
              >
                <div className="flex items-start gap-3">
                  <Icon name="chat_bubble" className="text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary">{t('dashboard.amigo_sincero')}</p>
                    <p className="text-[13px] mt-1.5 leading-snug font-semibold text-on-surface">
                      {model.amigoV2.kind === 'over_pace' &&
                        t('dashboard.amigo_over_pace', {
                          planned: model.amigoV2.plannedQuantity,
                          type: model.amigoV2.profileName.toLowerCase(),
                          fit: model.amigoV2.fitCount,
                          remaining: model.amigoV2.remainingPlanned,
                        })}
                      {model.amigoV2.kind === 'on_plan' &&
                        t('dashboard.amigo_on_plan', {
                          type: model.amigoV2.profileName.toLowerCase(),
                          done: model.amigoV2.doneQuantity,
                          planned: model.amigoV2.plannedQuantity,
                        })}
                      {model.amigoV2.kind === 'over_plan' &&
                        t('dashboard.amigo_over_plan', {
                          type: model.amigoV2.profileName.toLowerCase(),
                          done: model.amigoV2.doneQuantity,
                          planned: model.amigoV2.plannedQuantity,
                        })}
                      {model.amigoV2.kind === 'no_plan' &&
                        t('dashboard.amigo_no_plan', {
                          type: model.amigoV2.profileName.toLowerCase(),
                          percent: model.amigoV2.impactPercent,
                        })}
                    </p>
                    {(model.amigoV2.kind === 'over_pace' || model.amigoV2.kind === 'over_plan') &&
                      model.amigoV2.reserveStartDate && (
                        <p className="text-xs font-bold text-warning mt-2">
                          {t('dashboard.amigo_reserve_date', {
                            date: formatDate(model.amigoV2.reserveStartDate, "d 'de' MMMM"),
                          })}
                        </p>
                      )}
                    <button
                      onClick={() => navigate('/impact')}
                      className="btn-press mt-3 px-4 py-2 rounded-lg text-xs font-bold"
                      style={{ background: '#C75B3918', color: 'var(--primary)' }}
                    >
                      {t('dashboard.amigo_see_impact')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      case 'pending_shares':
        return (
          <>
            {/* §7 pos. 9 — PENDING SHARE CONFIRMATIONS (DEC-071 / FIELD-03) */}
            {model.hasPendingExpenses && (
              <button
                onClick={onOpenConfirmSheet}
                className="w-full mt-4 p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
                style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
              >
                <Icon name="group" className="text-warning" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-warning">
                    {t('dashboard.pending_confirmation', { count: model.pendingShares.length })}
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A843aa' }}>
                    {t('dashboard.pending_impact', {
                      amount: formatMoney(model.pendingImpactCents, trip.baseCurrency),
                    })}
                  </p>
                </div>
                <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
              </button>
            )}
          </>
        );
      case 'funds_summary':
        return (
          <>
            {/* GLOBAL POOLS (personal shopping etc. — by scope, GAP-017) */}
            {model.globalPoolSummaries.map(({ pool, summary }) => (
              <button
                key={pool.id}
                onClick={() => navigate('/funds')}
                className="mt-5 p-4 rounded-2xl bg-surface-container w-full text-left btn-press"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#C75B3918' }}
                  >
                    <Icon name="shopping_bag" size={18} className="text-primary" />
                  </div>
                  <p className="text-sm font-bold text-on-surface">{pool.name}</p>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[32px] font-extrabold tracking-tight leading-none tabular text-on-surface">
                      {formatMoney(summary.remainingCents, pool.currency)}
                    </p>
                    <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">{t('dashboard.remaining')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-on-surface-faint">
                      {t('dashboard.used_of', {
                        used: formatMoney(summary.spentCents, pool.currency),
                        total: formatMoney(summary.totalCents, pool.currency),
                      })}
                    </p>
                    <div
                      className="w-28 h-2 rounded-full overflow-hidden mt-1.5"
                      style={{ background: 'var(--surface-container-high)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, summary.percentUsed)}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </>
        );
      case 'recent_expenses':
        return (
          <>
            {/* §7 pos. 10 — RECENT EXPENSES */}
            {model.recent.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-on-surface">{t('dashboard.recent_expenses')}</p>
                  <button
                    onClick={() => navigate('/expenses')}
                    className="text-xs text-primary btn-press font-bold"
                  >
                    {t('common.view_all')}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {/* FIELD-13: recent items navigate to the expense detail */}
                  {model.recent.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => navigate(`/expenses/${tx.id}`)}
                      className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
                    >
                      <div>
                        <p className="text-sm text-on-surface font-semibold">{tx.description}</p>
                        <p className="text-xs text-on-surface-faint">
                          {tx.category ? t(`categories.${tx.category}` as never) : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold tabular text-on-surface">
                          {formatMoney(tx.amountCents, tx.currency)}
                        </p>
                        <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {model.recent.length === 0 && (
              <div className="mt-5">
                <div className="bg-surface-container rounded-xl p-6 text-center">
                  <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
                  <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
                  <p className="text-xs text-on-surface-faint mt-1">{t('dashboard.no_expenses_desc')}</p>
                </div>
              </div>
            )}
          </>
        );
    }
  };

  const cardSequence = resolveDashboardCardSequence(settings.dashboardCardOrder);

  // DEC-119 (R-10): configurable home screen — order + visibility.
  return (
    <>
      {cardSequence
        .filter((id) => !isDashboardCardHidden(id, settings.hiddenDashboardCards))
        .map((id) =>
          getDashboardCard(id).fixed ? (
            <div key={id}>{renderDashboardCard(id)}</div>
          ) : (
            <div key={id} {...getCardLongPress(id)}>
              {renderDashboardCard(id)}
            </div>
          ),
        )}
    </>
  );
}
