import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import {
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  getDashboardCard,
  type DashboardCardId,
} from '@/domain/dashboard';
import { useLongPress } from '@/hooks/useLongPress';
import { useCountUp } from '@/hooks/useCountUp';
import { hapticSelection } from '@/utils/haptics';
import { AnimatedMoney } from '@/components/AnimatedMoney';
import {
  CHECK_IN_INTENT_CATALOG,
  getActiveCheckIn,
  planCheckInDay,
  projectDailyBoostCents,
  getCheckInLens,
  estimateNightRounds,
  deriveAvgRoundCents,
} from '@/domain/check-in';
import { calculateEffectiveSpendingDays, getDaySpendingWeight } from '@/domain/phases';
import type { DashboardInsight } from '@/domain/insights';
import type { Trip } from '@/domain/types/trip';
import type { AppSettings } from '@/domain/types/app-settings';
import type { CheckInIntent } from '@/domain/types/common';
import { AmigoSinceroCard } from '@/features/dashboard/cards/AmigoSinceroCard';
import { OccasionCounter } from '@/features/dashboard/cards/OccasionCounter';
import {
  counterAccent,
  splitMoneyDisplay,
  INSIGHT_ICONS,
  formatInsightText,
  formatElapsed,
  nextInsightIndex,
  shouldAutoRotateInsights,
  INSIGHT_AUTO_ROTATE_MS,
  INSIGHT_RESUME_DELAY_MS,
} from './dashboard-format';
import type { DashboardModel } from './useDashboardModel';

interface DashboardCardsProps {
  model: DashboardModel;
  trip: Trip;
  settings: AppSettings;
  onOpenConfirmSheet: () => void;
  onConfigCard: (id: DashboardCardId) => void;
  onPostponeEvent: (occurrenceId: string) => void;
  onInsightTap: (insight: DashboardInsight) => void;
  onSelectCheckIn: (intent: CheckInIntent) => void;
  onOpenHeroBreakdown: () => void;
}

// The hero's previous amount is stashed in sessionStorage so it survives the
// dashboard remount caused by a save → navigate('/dashboard') (a module-scoped
// variable did not survive the lazy route remount): the fresh mount animates
// from the pre-action amount to the new one ("watch it drop"). Absent on the
// very first visit, so there is no intro animation.
const HERO_PREV_KEY = 'tp:hero-free-cents';

function readHeroPrevCents(): number | null {
  try {
    const raw = sessionStorage.getItem(HERO_PREV_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeHeroPrevCents(cents: number): void {
  try {
    sessionStorage.setItem(HERO_PREV_KEY, String(cents));
  } catch {
    // Private mode / storage disabled — the animation simply won't seed.
  }
}

// E5 "lens of the day": a small tag pinned to the card the day's mode spotlights.
function LensChip({ label, corner = false }: { label: string; corner?: boolean }) {
  return (
    <span className={`lens-chip${corner ? ' lens-chip--corner' : ''}`}>
      <Icon name="center_focus_strong" size={11} className="text-primary" />
      {label}
    </span>
  );
}

// BUG-008: the home cards moved out of the 1.6k-line DashboardPage into one
// presentational component driven entirely by the memoized DashboardModel.
export function DashboardCards({
  model,
  trip,
  settings,
  onOpenConfirmSheet,
  onConfigCard,
  onPostponeEvent,
  onInsightTap,
  onSelectCheckIn,
  onOpenHeroBreakdown,
}: DashboardCardsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // DEC-091 (R-09): swipe carousel of insights; DEC-076: occasion carousel page.
  const [insightIndex, setInsightIndex] = useState(0);
  const [carouselPage, setCarouselPage] = useState(0);
  const insightScrollRef = useRef<HTMLDivElement>(null);
  // M2: auto-rotation — paused (timestamp) while the user is interacting, and
  // gated by reduced-motion. Self-scrolls never re-pause (only pointer/wheel).
  const insightPausedUntilRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  // DEC-119 (R-10): long-press on a card opens its options sheet.
  const getCardLongPress = useLongPress((id) => onConfigCard(id as DashboardCardId));

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Council ("money responds"): the hero free-to-spend tweens to its new value
  // after any change, so the budget visibly reacts to what you just did. This
  // only animates how an already-correct number (ÂNCORA 12) is displayed.
  const heroTargetCents = model.fts?.freeToSpendCents ?? 0;
  const heroSeedRef = useRef<number | null>(model.fts ? readHeroPrevCents() : null);
  const animatedHeroCents = useCountUp(heroTargetCents, !reducedMotion, heroSeedRef.current);
  useEffect(() => {
    if (model.fts) writeHeroPrevCents(heroTargetCents);
  }, [heroTargetCents, model.fts]);
  const animatedHero =
    model.fts && model.heroMoney
      ? splitMoneyDisplay(animatedHeroCents, trip.baseCurrency)
      : null;

  // E5 optimistic check-in: reflect the tapped intent INSTANTLY (before the
  // silent reload round-trip) so the day's framing answers the tap with no
  // perceptible lag. Read-only context (ÂNCORA 12) — a faster echo of what is
  // being persisted, reconciled to null once the settings catch up.
  const [optimisticCheckIn, setOptimisticCheckIn] = useState<CheckInIntent | null>(null);
  const persistedCheckInIntent =
    getActiveCheckIn(settings.dailyCheckIn, model.todayIso)?.intent ?? null;
  const effectiveCheckInIntent = optimisticCheckIn ?? persistedCheckInIntent;
  useEffect(() => {
    if (optimisticCheckIn && persistedCheckInIntent === optimisticCheckIn) {
      setOptimisticCheckIn(null);
    }
  }, [optimisticCheckIn, persistedCheckInIntent]);

  // E5 "lens of the day": the chosen mode spotlights ONE other card. The focus
  // only counts when that card is actually visible (not hidden, has content),
  // so the check-in's "↓ in focus below" line never points at nothing.
  const lens = effectiveCheckInIntent ? getCheckInLens(effectiveCheckInIntent) : null;
  const piggyVisible =
    model.piggyBankCents > 0 && !isDashboardCardHidden('piggy_bank', settings.hiddenDashboardCards);
  const occasionsVisible =
    model.occasionCounters.length > 0 &&
    !isDashboardCardHidden('occasion_counters', settings.hiddenDashboardCards);
  const focusAvailable =
    lens?.focusCardId === 'piggy_bank'
      ? piggyVisible
      : lens?.focusCardId === 'occasion_counters'
        ? occasionsVisible
        : false;
  const activeFocusCardId = focusAvailable ? lens!.focusCardId : null;
  // Night projection: rounds the night reserve buys at the traveler's own price.
  const avgRoundCents = deriveAvgRoundCents(model.profiles);
  const handleCheckInTap = (intent: CheckInIntent) => {
    // Council ("sensed result"): a soft tap so choosing a mode is FELT, not just
    // seen — native-aware boundary, gated by the user's vibration setting (N8).
    hapticSelection();
    setOptimisticCheckIn(intent);
    onSelectCheckIn(intent);
  };

  // M2: advance the insights carousel every few seconds, honoring pauses.
  const insightCount = model.insights.length;
  useEffect(() => {
    if (!shouldAutoRotateInsights(insightCount, reducedMotion)) return;
    const timer = window.setInterval(() => {
      if (Date.now() < insightPausedUntilRef.current) return;
      const el = insightScrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const current = Math.round(el.scrollLeft / el.clientWidth);
      const next = nextInsightIndex(current, insightCount);
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, INSIGHT_AUTO_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [insightCount, reducedMotion]);

  const pauseInsightRotation = () => {
    insightPausedUntilRef.current = Date.now() + INSIGHT_RESUME_DELAY_MS;
  };

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
      case 'daily_checkin': {
        // M7 (E5): one-tap intent for the day — read-only context, never blocks.
        // Optimistic: the tapped intent shows instantly (Gate E), then settles.
        // `effectiveCheckInIntent` is hoisted to component scope (drives the lens).
        return (
          <div className="mt-4 p-4 rounded-2xl bg-surface-container">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
              {t('dashboard.checkin_title')}
            </p>
            <p className="text-[13px] font-semibold leading-snug mt-1 text-on-surface">
              {effectiveCheckInIntent
                ? t('dashboard.checkin_active', {
                    intent: t(`dashboard.checkin_${effectiveCheckInIntent}`),
                  })
                : t('dashboard.checkin_prompt')}
            </p>
            <div className="flex gap-2 mt-3">
              {CHECK_IN_INTENT_CATALOG.map((option) => {
                const selected = effectiveCheckInIntent === option.intent;
                return (
                  <button
                    key={option.intent}
                    onClick={() => handleCheckInTap(option.intent)}
                    aria-pressed={selected}
                    className="flex-1 py-2.5 rounded-xl flex flex-col items-center gap-1 btn-press"
                    style={{
                      background: selected ? 'var(--primary)' : 'var(--surface-high)',
                      border: selected ? '1px solid var(--primary)' : '1px solid var(--border-faint)',
                    }}
                  >
                    <Icon
                      name={option.icon}
                      size={20}
                      filled={selected}
                      className={selected ? 'text-surface' : 'text-on-surface-dim'}
                    />
                    <span
                      className={`text-[11px] font-bold ${selected ? 'text-surface' : 'text-on-surface-dim'}`}
                    >
                      {t(option.labelKey as never)}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* The tap's RESULT: each mode turns the day's free money into a
                DIFFERENT, concrete suggestion (light target / night reserve /
                free pace). Read-only — never changes the budget. Keyed by intent
                so it re-animates on each switch. */}
            {effectiveCheckInIntent &&
              model.todayBudget &&
              (() => {
                const plan = planCheckInDay(
                  effectiveCheckInIntent,
                  model.todayBudget.freeTodayCents,
                );
                return (
                  <div
                    key={effectiveCheckInIntent}
                    className="checkin-reveal mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--border-faint)' }}
                  >
                    {/* K1: surface the mode's numbers as real stats so the choice
                        is FELT — the headline figure changes per mode, and the
                        complement (slack / before-night) makes the split legible.
                        Still read-only (ÂNCORA 12): the hero free-today is fixed. */}
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 rounded-xl px-3 py-2 bg-primary/10">
                        <p className="text-[9px] font-bold tracking-[0.08em] uppercase text-primary/80 flex items-center gap-1">
                          <Icon name={plan.icon} size={12} className="text-primary" />
                          {t(plan.primaryLabelKey as never)}
                        </p>
                        <p className="text-[19px] font-extrabold tracking-tight leading-none mt-1 tabular text-on-surface">
                          {formatMoney(plan.primaryCents, trip.baseCurrency)}
                        </p>
                      </div>
                      {plan.secondaryCents !== null && plan.secondaryLabelKey && (
                        <div className="flex-1 rounded-xl px-3 py-2 bg-surface-high">
                          <p className="text-[9px] font-bold tracking-[0.08em] uppercase text-on-surface-faint">
                            {t(plan.secondaryLabelKey as never)}
                          </p>
                          <p className="text-[19px] font-extrabold tracking-tight leading-none mt-1 tabular text-on-surface-dim">
                            {formatMoney(plan.secondaryCents, trip.baseCurrency)}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] leading-snug text-on-surface-dim mt-2">
                      {t(plan.messageKey as never, {
                        primary: formatMoney(plan.primaryCents, trip.baseCurrency),
                        secondary: formatMoney(plan.secondaryCents ?? 0, trip.baseCurrency),
                      })}
                    </p>
                    {/* G5 "real effect" (read-only — ÂNCORA 12): the money saved
                        by a calm / no-spend day doesn't vanish — it lifts every day
                        still ahead in the phase. Shown only when it lands ≥ +€1/day. */}
                    {(effectiveCheckInIntent === 'calm' || effectiveCheckInIntent === 'no_spend') &&
                      model.activePhase &&
                      (() => {
                        const savedCents = plan.secondaryCents ?? 0;
                        const effAfterToday =
                          calculateEffectiveSpendingDays(model.activePhase, model.todayIso) -
                          getDaySpendingWeight(model.activePhase, model.todayIso);
                        const boost = projectDailyBoostCents(savedCents, effAfterToday);
                        if (boost === null) return null;
                        return (
                          <p className="text-[11px] font-bold text-primary mt-2 flex items-center gap-1">
                            <Icon name="trending_up" size={13} className="text-primary" />
                            {t('dashboard.checkin_redistribute', {
                              saved: formatMoney(savedCents, trip.baseCurrency),
                              perDay: formatMoney(boost, trip.baseCurrency),
                            })}
                          </p>
                        );
                      })()}
                    {/* The "lens" payoff: the mode reshapes the home — night
                        projects rounds; calm/outing spotlight a card below. */}
                    {(() => {
                      if (effectiveCheckInIntent === 'night') {
                        const rounds = estimateNightRounds(plan.primaryCents, avgRoundCents);
                        if (rounds === null) return null;
                        return (
                          <p className="text-[11px] font-bold text-primary mt-2 flex items-center gap-1">
                            <Icon name="local_bar" size={13} className="text-primary" />
                            {t('dashboard.checkin_lens_night', { count: rounds })}
                          </p>
                        );
                      }
                      if (activeFocusCardId === 'piggy_bank') {
                        return (
                          <p className="text-[11px] font-bold text-primary mt-2 flex items-center gap-1">
                            <Icon name="south" size={13} className="text-primary" />
                            {t('dashboard.checkin_lens_calm')}
                          </p>
                        );
                      }
                      if (activeFocusCardId === 'occasion_counters') {
                        return (
                          <p className="text-[11px] font-bold text-primary mt-2 flex items-center gap-1">
                            <Icon name="south" size={13} className="text-primary" />
                            {t('dashboard.checkin_lens_outing')}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })()}
          </div>
        );
      }
      case 'savings_goal': {
        // M14 (E6): savings goal vs projected end-of-trip surplus. READ-ONLY —
        // shown only when the traveler set a goal (ÂNCORA 11 / DEC-088).
        const goal = model.savingsGoal;
        if (!goal) return null;
        const pct = Math.round(goal.progressRatio * 100);
        return (
          <button
            onClick={() => navigate('/settings')}
            className="w-full mt-4 p-4 rounded-2xl bg-surface-container text-left btn-press"
          >
            <div className="flex items-center gap-2.5">
              <Icon
                name="flag"
                size={18}
                filled
                className={goal.onTrack ? 'text-success' : 'text-warning'}
              />
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint flex-1">
                {t('dashboard.goal_title')}
              </p>
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {t('dashboard.goal_target', { amount: formatMoney(goal.goalCents, trip.baseCurrency) })}
              </span>
            </div>
            <p className="text-[26px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
              {formatMoney(Math.max(0, goal.projectedSurplusCents), trip.baseCurrency)}
            </p>
            <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">{t('dashboard.goal_projected')}</p>
            <div
              className="w-full h-2 rounded-full overflow-hidden mt-3"
              style={{ background: 'var(--surface-container-high)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: goal.onTrack ? 'var(--success)' : 'var(--warning)' }}
              />
            </div>
            <p className={`text-xs font-bold mt-2 ${goal.onTrack ? 'text-success' : 'text-warning'}`}>
              {goal.onTrack
                ? t('dashboard.goal_on_track', { amount: formatMoney(goal.gapCents, trip.baseCurrency) })
                : t('dashboard.goal_behind', { amount: formatMoney(Math.abs(goal.gapCents), trip.baseCurrency) })}
            </p>
          </button>
        );
      }
      case 'piggy_bank':
        // M15 (E6): accumulated under-spend framed as a piggy bank. READ-ONLY —
        // never part of "free today" (ÂNCORA 11).
        return model.piggyBankCents > 0 ? (
          <div
            className={`relative mt-4 p-4 rounded-2xl flex items-center gap-3${activeFocusCardId === 'piggy_bank' ? ' lens-card' : ''}`}
            style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}
          >
            {activeFocusCardId === 'piggy_bank' && <LensChip label={t('dashboard.lens_in_focus')} corner />}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#6B8F7118' }}
            >
              <Icon name="savings" size={20} filled className="text-success" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                {t('dashboard.piggy_title')}
              </p>
              <p className="text-lg font-extrabold tabular text-success leading-tight">
                <AnimatedMoney cents={model.piggyBankCents} currency={trip.baseCurrency} pulseOnChange />
              </p>
              <p className="text-[11px] font-semibold text-on-surface-dim mt-0.5">{t('dashboard.piggy_desc')}</p>
            </div>
          </div>
        ) : null;
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
            {/* §7 pos. 5 — HERO CARD (DEC-168: tappable → "where this number comes from") */}
            {model.fts && model.heroMoney && (
              <button
                type="button"
                onClick={onOpenHeroBreakdown}
                aria-label={t('dashboard.hero_breakdown_title')}
                className="mt-5 p-5 rounded-2xl bg-surface-container w-full text-left btn-press block"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* G4: the overline frames the figure as the phase's free amount
                      instead of repeating the end date already shown in the header. */}
                  <p className="text-xs font-bold" style={{ color: '#C75B39aa' }}>
                    {t('dashboard.free_to_spend_phase')}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-on-surface-faint flex-shrink-0 mt-0.5">
                    <Icon name="help" size={13} className="text-on-surface-faint" />
                    {t('dashboard.hero_breakdown_hint')}
                  </span>
                </div>
                <p className="text-[44px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
                  {(animatedHero ?? model.heroMoney).integer}
                  <span className="text-xl font-bold text-on-surface-dim">
                    {(animatedHero ?? model.heroMoney).decimal}
                  </span>
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
                    {/* DEC-088: the recalculated average is a secondary metric — but
                        when it lands within ~€0.50 of today's free amount it just
                        repeats the line above (two identical numbers confuse), so
                        only surface it when it actually says something different. */}
                    {Math.abs(
                      model.todayBudget.avgDailyUntilEndCents - model.todayBudget.freeTodayCents,
                    ) > 50 && (
                      <p className="text-[11px] font-semibold mt-0.5 text-on-surface-faint">
                        {t('dashboard.avg_daily_until_end', {
                          amount: formatMoney(
                            model.todayBudget.avgDailyUntilEndCents,
                            trip.baseCurrency,
                          ),
                        })}
                      </p>
                    )}
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
              </button>
            )}
          </>
        );
      case 'occasion_counters': {
        // §7 pos. 6 — OCCASION COUNTERS (U6 / DEC-180): one carousel — planned
        // metas first (remaining/done), then per-category item counts with an
        // explicit unit label ("gastos"). ÂNCORA 10, beloved card.
        const counters = model.occasionCounters;
        if (counters.length === 0) return null;
        const occasionsFocused = activeFocusCardId === 'occasion_counters';
        const pageCount = Math.ceil(counters.length / 3);
        return (
          <div className="mt-4">
            {/* E5 lens: when "outing" is the day's mode, the counters are spotlighted. */}
            {occasionsFocused && (
              <div className="mb-2">
                <LensChip label={t('dashboard.lens_in_focus')} />
              </div>
            )}
            {/* DEC-076/DEC-122 (R-01): pure-CSS scroll-snap carousel, ~3 visible */}
            <div
              className="flex gap-3 overflow-x-auto no-scrollbar -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] scroll-pl-[var(--page-padding-x)] scroll-pr-[var(--page-padding-x)] snap-x snap-mandatory"
              onScroll={(e) => {
                const el = e.currentTarget;
                const maxScroll = el.scrollWidth - el.clientWidth;
                if (maxScroll <= 0) return;
                const page = Math.round((el.scrollLeft / maxScroll) * (pageCount - 1));
                if (page !== carouselPage) setCarouselPage(page);
              }}
            >
              {counters.map((counter) => {
                const accent = counterAccent(counter.category);
                if (counter.kind === 'planned') {
                  const profile = model.profiles.find((p) => p.id === counter.profileId);
                  return (
                    <div
                      key={counter.key}
                      // R6-11 (R-02) / DEC-122: exactly 3 cards per page, snap-always.
                      className="snap-start snap-always shrink-0 w-[calc((100%-1.5rem)/3)] min-w-[104px] flex"
                    >
                      <OccasionCounter
                        icon={profile?.iconName ?? getCategoryIcon(counter.category)}
                        count={counter.remaining}
                        label={t('dashboard.occasion_remaining', { name: counter.name })}
                        sublabel={t('dashboard.occasion_done', { count: counter.done })}
                        iconBg={accent.bg}
                        iconColor={accent.color}
                        onClick={() => navigate(`/expenses?profile=${counter.profileId}`)}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={counter.key}
                    className="snap-start snap-always shrink-0 w-[calc((100%-1.5rem)/3)] min-w-[104px] flex"
                  >
                    <OccasionCounter
                      icon={getCategoryIcon(counter.category)}
                      count={counter.itemCount}
                      label={t(`categories.${counter.category}` as never)}
                      sublabel={t('dashboard.occasion_items')}
                      iconBg={accent.bg}
                      iconColor={accent.color}
                      onClick={() => navigate(`/expenses?category=${counter.category}`)}
                    />
                  </div>
                );
              })}
            </div>
            {counters.length > 3 && (
              <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
                {Array.from({ length: pageCount }).map((_, i) => (
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
        );
      }
      case 'insights':
        return (
          <>
            {/* §7 pos. 7 — INSIGHTS (DEC-091 / R-09): swipe switches, tap details */}
            {model.insights.length > 0 && (
              <div className="mt-4 rounded-2xl bg-surface-container pb-1">
                <div
                  ref={insightScrollRef}
                  className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
                  // M2: any manual interaction pauses auto-rotation; programmatic
                  // self-scrolls fire onScroll only, so they never re-pause.
                  onPointerDown={pauseInsightRotation}
                  onWheel={pauseInsightRotation}
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
                        onClick={() => {
                          pauseInsightRotation();
                          insightScrollRef.current?.scrollTo({
                            left: i * insightScrollRef.current.clientWidth,
                            behavior: 'smooth',
                          });
                        }}
                        aria-label={`${t('dashboard.insights_title')} ${i + 1}`}
                        className="p-2.5 btn-press"
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
            {/* §7 pos. 8 — AMIGO SINCERO v2 (DEC-093 / R-11): plan-based.
                Shared with the Copiloto via AmigoSinceroCard (one source). */}
            <AmigoSinceroCard
              amigo={model.amigoV2}
              currency={trip.baseCurrency}
              onSeeImpact={() => navigate('/impact')}
            />
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
      case 'planned_purchases': {
        // DEC-175: only surfaces when there is something planned — an empty card
        // would be noise (ÂNCORA: every card must earn its place).
        const planned = model.plannedPurchasesSummary;
        if (planned.openCount === 0) return null;
        return (
          <button
            onClick={() => navigate('/planned')}
            className="mt-5 p-4 rounded-2xl bg-surface-container w-full text-left btn-press"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#C75B3918' }}
              >
                <Icon name="shopping_bag" size={18} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-on-surface">
                {t('dashboard.card_planned_purchases')}
              </p>
              <Icon name="chevron_right" size={16} className="text-on-surface-faint ml-auto" />
            </div>
            {planned.totalReservedCents > 0 ? (
              <>
                <p className="text-[28px] font-extrabold tracking-tight leading-none tabular text-primary">
                  {formatMoney(planned.totalReservedCents, trip.baseCurrency)}
                </p>
                <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">
                  {t('dashboard.planned_card_hint')}
                </p>
              </>
            ) : (
              <p className="text-xs text-on-surface-dim">
                {t('planned.tracking_badge')} · {planned.openCount}
              </p>
            )}
            {planned.items.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3">
                {planned.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        name={getCategoryIcon(it.category)}
                        size={14}
                        className="text-on-surface-faint"
                      />
                      <span className="text-xs text-on-surface truncate">{it.name}</span>
                    </div>
                    {it.remainingCents !== null && (
                      <span className="text-xs font-semibold tabular text-on-surface-dim">
                        {formatMoney(it.remainingCents, trip.baseCurrency)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      }
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
