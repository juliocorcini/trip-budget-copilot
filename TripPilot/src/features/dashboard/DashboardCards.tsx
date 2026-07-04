import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatShortDate, localDayOf, localDateString, localClockTime } from '@/domain/dates';
import { getCategoryIcon } from '@/utils/category-icons';
import {
  resolveDashboardCardSequence,
  isDashboardCardHidden,
  isDashboardCardPaired,
  shouldRenderContextualCard,
  groupDashboardRows,
  getDashboardCard,
  type DashboardCardId,
} from '@/domain/dashboard';
import {
  resolveHonestFriendVoice,
  isPhaseFullyPlanned,
  resolveProgressTone,
  resolveSavingDestination,
  type ProgressTone,
} from '@/domain/budget';
import { AskToSpendShortcut } from './AskToSpendShortcut';
import { useLongPress } from '@/hooks/useLongPress';
import { useCountUp } from '@/hooks/useCountUp';
import { hapticSelection } from '@/utils/haptics';
import {
  isOutingSuggestionDismissed,
  dismissOutingSuggestion,
} from '@/utils/outing-suggestion-dismissal';
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
import { PiggyStatementSheet } from '@/features/dashboard/cards/PiggyStatementSheet';
import { capHomeInsights } from '@/features/dashboard/home-insights';
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
  onStartEvent: (occurrenceId: string) => void;
  onEndEvent: (occurrenceId: string) => void;
  onInsightTap: (insight: DashboardInsight) => void;
  onSelectCheckIn: (intent: CheckInIntent) => void;
  onOpenHeroBreakdown: () => void;
  onEditSavingsGoal: () => void;
  /** DEC-465: persist a full piggy resgate (returns the parked money to the flow). */
  onPiggyWithdraw: (amountCents: number) => void;
}

// The hero's previous amount is stashed in sessionStorage so it survives the
// dashboard remount caused by a save → navigate('/dashboard') (a module-scoped
// variable did not survive the lazy route remount): the fresh mount animates
// from the pre-action amount to the new one ("watch it drop"). Absent on the
// very first visit, so there is no intro animation.
const HERO_PREV_KEY = 'tp:hero-free-cents';

// C12 / DEC-299: the hero free-to-spend bar reads its color from the budget
// state, not a fixed terracotta gradient — normal progress is positive, red is
// reserved for a real problem (see resolveProgressTone).
const PROGRESS_TONE_BG: Record<ProgressTone, string> = {
  positive: 'var(--success)',
  risk: 'var(--error)',
};

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
  onStartEvent,
  onEndEvent,
  onInsightTap,
  onSelectCheckIn,
  onOpenHeroBreakdown,
  onEditSavingsGoal,
  onPiggyWithdraw,
}: DashboardCardsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // DEC-091 (R-09): swipe carousel of insights; DEC-076: occasion carousel page.
  const [insightIndex, setInsightIndex] = useState(0);
  const [carouselPage, setCarouselPage] = useState(0);
  // FIELD R2 item 8 (F8): the check-in fused under the hero is compact — once a
  // mode is chosen it collapses to a single chip; tapping it re-opens the picker.
  const [checkInExpanded, setCheckInExpanded] = useState(false);
  // C2: the "open an Outing?" nudge is dismissible for the rest of the day.
  const [outingNudgeDismissed, setOutingNudgeDismissed] = useState(() =>
    isOutingSuggestionDismissed(trip.id, model.todayIso),
  );
  const handleDismissOutingNudge = () => {
    hapticSelection();
    setOutingNudgeDismissed(true);
    dismissOutingSuggestion(trip.id, model.todayIso);
  };
  const insightScrollRef = useRef<HTMLDivElement>(null);
  // Julio device test 2026-06-18 (GATE 17): the occasion carousel must always
  // OPEN on the left — showing the planned, colour-coded metas (bar/restaurante/
  // mercado) first — instead of landing on a generic "Outros" count. Verified
  // cause (Playwright, Julio's backup, with NO JS scroll involved): when the
  // carousel scrolls INTO the viewport, a `scroll-snap-type: x` container is
  // re-snapped by the browser to card 3 (scrollLeft 373 of 497) — both
  // `mandatory` and `proximity` do it; only `snap-none` holds it at 0. So the
  // carousel now scrolls freely (snap-none, see the container class) and the dot
  // pager still tracks position; ordering stays planned-first
  // (buildOccasionCounters). This mount-time pin is cheap insurance against any
  // device-specific scroll restoration on back-navigation.
  const pinOccasionCarouselLeft = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    node.scrollLeft = 0;
    requestAnimationFrame(() => {
      node.scrollLeft = 0;
    });
  }, []);
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
  const heroTargetCents = model.trueFree?.trueFreeCents ?? 0;
  const heroSeedRef = useRef<number | null>(model.trueFree ? readHeroPrevCents() : null);
  const animatedHeroCents = useCountUp(heroTargetCents, !reducedMotion, heroSeedRef.current);
  useEffect(() => {
    if (model.trueFree) writeHeroPrevCents(heroTargetCents);
  }, [heroTargetCents, model.trueFree]);
  const animatedHero =
    model.trueFree && model.heroMoney
      ? splitMoneyDisplay(animatedHeroCents, trip.baseCurrency)
      : null;

  // E5 optimistic check-in: reflect the tapped intent INSTANTLY (before the
  // silent reload round-trip) so the day's framing answers the tap with no
  // perceptible lag. Read-only context (ÂNCORA 12) — a faster echo of what is
  // being persisted, reconciled to null once the settings catch up.
  const [optimisticCheckIn, setOptimisticCheckIn] = useState<CheckInIntent | null>(null);
  // FB-08 · DEC-279: tapping the cofrinho opens its statement (voice + ledger).
  const [piggyStatementOpen, setPiggyStatementOpen] = useState(false);
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

  // FIELD-17: the check-in reframes the prominent "free today" number itself
  // (calm trims it, night reserves part, no-spend zeroes it) instead of only
  // suggesting on its own card. Read-only projection (ÂNCORA 12): the hero
  // "truly free" and the budget never move; only today's framing changes. An
  // already-over day (base ≤ 0) keeps its real negative — no mode hides it.
  const baseFreeTodayCents = model.todayBudget?.freeTodayCents ?? 0;
  const checkInTodayPlan =
    effectiveCheckInIntent && model.todayBudget && baseFreeTodayCents > 0
      ? planCheckInDay(effectiveCheckInIntent, baseFreeTodayCents)
      : null;
  const displayFreeTodayCents = checkInTodayPlan ? checkInTodayPlan.primaryCents : baseFreeTodayCents;
  // FIELD-2 item E06: the check-in lives on the hero's "posso gastar" row as a
  // compact chip. Before a mode is chosen there is nothing to summarise, so the
  // picker shows open; once chosen it collapses to a one-line chip the traveler
  // can tap to expand again (accordion). Read-only framing stays (ÂNCORA 12).
  const isCheckInExpanded = !effectiveCheckInIntent || checkInExpanded;
  const checkInActiveOption = effectiveCheckInIntent
    ? (CHECK_IN_INTENT_CATALOG.find((o) => o.intent === effectiveCheckInIntent) ?? null)
    : null;
  const handleCheckInTap = (intent: CheckInIntent) => {
    // Council ("sensed result"): a soft tap so choosing a mode is FELT, not just
    // seen — native-aware boundary, gated by the user's vibration setting (N8).
    hapticSelection();
    setOptimisticCheckIn(intent);
    onSelectCheckIn(intent);
  };

  // G13 (audit §4.2): cap the Home carousel to the top N insights at rest;
  // "ver mais" reveals the rest in place. They arrive priority-sorted, so the
  // visible slice is always the most important — nothing is dropped (ÂNCORA 9).
  // G13 + Julio device test 2026-06-18: the Home shows the top insights and the
  // rest live on the Copiloto — the "veja mais no copiloto" bar links there, so
  // the Home stays a calm preview instead of a wall.
  const { visible: visibleInsights } = capHomeInsights(model.insights, false);

  // M2: advance the insights carousel every few seconds, honoring pauses.
  const insightCount = visibleInsights.length;
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

  // FIELD-2 item E06: the check-in's expandable body (picker + the chosen mode's
  // read-only payoff). It used to be a standalone movable card right under the
  // hero; it now lives INSIDE the hero, opened from the chip on the "posso
  // gastar" row. The math is untouched (ÂNCORA 12) — only its home changed.
  const renderCheckIn = (): ReactNode => {
    if (!isCheckInExpanded) return null;
    return (
      <div className="mt-2.5 p-3 rounded-2xl bg-surface-container">
        {/* Only prompt before the first choice — once chosen the chips are
            self-explanatory, so the long prompt copy is dropped. */}
        {!effectiveCheckInIntent && (
          <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2.5">
            {t('dashboard.checkin_prompt')}
          </p>
        )}
        <div className="flex gap-1.5">
          {CHECK_IN_INTENT_CATALOG.map((option) => {
            const selected = effectiveCheckInIntent === option.intent;
            return (
              <button
                key={option.intent}
                onClick={() => {
                  handleCheckInTap(option.intent);
                  setCheckInExpanded(true);
                }}
                aria-pressed={selected}
                className="flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 btn-press"
                style={{
                  background: selected ? 'var(--primary)' : 'var(--surface-high)',
                  border: selected
                    ? '1px solid var(--primary)'
                    : '1px solid var(--border-faint)',
                }}
              >
                <Icon
                  name={option.icon}
                  size={18}
                  filled={selected}
                  className={selected ? 'text-surface' : 'text-on-surface-dim'}
                />
                <span
                  className={`text-[10px] font-bold ${selected ? 'text-surface' : 'text-on-surface-dim'}`}
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
                className="checkin-reveal mt-2.5 pt-2.5"
                style={{ borderTop: '1px solid var(--border-faint)' }}
              >
                {/* FIELD-17: compact result. The mode's numbers now live on the
                    hero ("free today" + its complement), so the card keeps only
                    a one-line summary plus the redistribute/lens payoff — no more
                    tall stat boxes. Read-only framing (ÂNCORA 12). */}
                <p className="text-[11px] leading-snug text-on-surface-dim flex items-start gap-1">
                  <Icon name={plan.icon} size={13} className="text-primary shrink-0 mt-px" />
                  <span>
                    {t(plan.messageKey as never, {
                      primary: formatMoney(plan.primaryCents, trip.baseCurrency),
                      secondary: formatMoney(plan.secondaryCents ?? 0, trip.baseCurrency),
                    })}
                  </span>
                </p>
                {/* D11/D14 · DEC-313/314 · the saved money has ONE destination,
                    never two (read-only — ÂNCORA 12): with an active cofrinho it
                    is kept there (and that buffer is what protects the days ahead);
                    without one it dilutes into the days still ahead. The cofrinho
                    is never highlighted when the money did not go to it. */}
                {(effectiveCheckInIntent === 'calm' || effectiveCheckInIntent === 'no_spend') &&
                  (() => {
                    const savedCents = plan.secondaryCents ?? 0;
                    const destination = resolveSavingDestination({
                      savedCents,
                      piggyActive: model.piggyLedger !== null,
                    });
                    if (destination === 'none') return null;
                    const destTitle = (
                      <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                        {t('dashboard.checkin_dest_title')}
                      </p>
                    );
                    if (destination === 'piggy') {
                      return (
                        <div data-saving-destination className="mt-2.5">
                          {destTitle}
                          <p className="text-[11px] font-bold text-primary mt-1 flex items-center gap-1">
                            <Icon name="savings" size={13} className="text-primary" />
                            {t('dashboard.checkin_dest_piggy', {
                              saved: formatMoney(savedCents, trip.baseCurrency),
                            })}
                          </p>
                        </div>
                      );
                    }
                    if (!model.activePhase) return null;
                    const effAfterToday =
                      calculateEffectiveSpendingDays(model.activePhase, model.todayIso) -
                      getDaySpendingWeight(model.activePhase, model.todayIso);
                    const boost = projectDailyBoostCents(savedCents, effAfterToday);
                    if (boost === null) return null;
                    return (
                      <div data-saving-destination className="mt-2.5">
                        {destTitle}
                        <p className="text-[11px] font-bold text-primary mt-1 flex items-center gap-1">
                          <Icon name="trending_up" size={13} className="text-primary" />
                          {t('dashboard.checkin_redistribute', {
                            saved: formatMoney(savedCents, trip.baseCurrency),
                            perDay: formatMoney(boost, trip.baseCurrency),
                          })}
                        </p>
                      </div>
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
  };

  const renderDashboardCard = (id: DashboardCardId): ReactNode => {
    switch (id) {
      case 'today_events':
        return (
          <>
            {/* §7 pos. 3 — DEC-072 (M6.3): DAY CARD — today's planned events without a session */}
            {model.todayEvents.map(({ occ, remainingCents, perDayCents }) => {
              // DEC-385 (G2): the reserve is consumable — the model already netted
              // what is STILL held + the per-day allowance against the spend.
              return (
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
                      {t('dashboard.event_remaining', {
                        remaining: formatMoney(remainingCents, trip.baseCurrency),
                        reserved: formatMoney(occ.reservedCents, trip.baseCurrency),
                      })}
                    </span>
                  )}
                </button>
                {occ.reservedCents !== null && perDayCents > 0 && (
                  <p className="mt-1.5 text-[11px] font-semibold text-on-surface-faint pl-[30px]">
                    {t('dashboard.event_per_day', {
                      amount: formatMoney(perDayCents, trip.baseCurrency),
                    })}
                  </p>
                )}
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
              );
            })}
            {/* GATE 4 (M4.4 / D8): upcoming events as a discreet heads-up — they
                rise here when the owner trecho is active or the D-7 window opens
                (e.g. Tomorrowland once the Eurotrip starts), tapping into the
                event's own edit sheet. */}
            {model.upcomingEvents.map((occ) => (
              <button
                key={occ.id}
                onClick={() => navigate(`/trip/edit?occurrence=${occ.id}`)}
                className="mt-3 w-full p-3.5 rounded-2xl flex items-center gap-3 btn-press text-left"
                style={{ background: 'var(--surface-container)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#C75B3918' }}
                >
                  <Icon name="celebration" size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{occ.name}</p>
                  <p className="text-[11px] font-semibold text-on-surface-dim">
                    {t('dashboard.event_starts_on', {
                      date: formatShortDate(occ.plannedDate ?? ''),
                    })}
                    {occ.reservedCents !== null
                      ? ` · ${t('dashboard.event_reserved', { amount: formatMoney(occ.reservedCents, trip.baseCurrency) })}`
                      : ''}
                  </p>
                </div>
                <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
          </>
        );
      case 'live_event':
        // DEC-390 (parte 2, G1): the live-event block — an event HAPPENING now
        // stays visible with real progress (consumed/what-when, remaining, per-day,
        // days left) EVEN with an outing started (Â-LIVE-EVENT). Coexists with the
        // active-outing card: the listed spends net to `consumedCents` (no double
        // count); with an outing linked the action opens it (the live tally lives
        // there), otherwise it offers the same start/postpone as the day card.
        return (
          <>
            {model.liveEvents.map((live) => {
              const { occurrence: occ } = live;
              const pct =
                live.reservedCents !== null && live.reservedCents > 0
                  ? Math.min(100, Math.round((live.consumedCents / live.reservedCents) * 100))
                  : 0;
              return (
                <div
                  key={occ.id}
                  className="mt-4 p-4 rounded-2xl"
                  style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
                >
                  <button
                    className="flex items-center gap-2.5 w-full text-left btn-press"
                    onClick={() => navigate(`/event/${occ.id}`)}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: '#C75B3925' }}
                    >
                      <Icon name="celebration" size={18} filled className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
                        {t('dashboard.live_event_title')}
                      </p>
                      <p className="text-base font-extrabold text-on-surface truncate">{occ.name}</p>
                      {live.activeSessionId !== null && (
                        <p className="text-[11px] font-semibold text-on-surface-faint truncate">
                          {t('dashboard.live_event_outing_link', { name: occ.name })}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold tabular text-on-surface-dim text-right shrink-0">
                      {live.reservedCents !== null
                        ? t('dashboard.live_event_spent_of', {
                            spent: formatMoney(live.consumedCents, trip.baseCurrency),
                            reserved: formatMoney(live.reservedCents, trip.baseCurrency),
                          })
                        : t('dashboard.live_event_spent_only', {
                            spent: formatMoney(live.consumedCents, trip.baseCurrency),
                          })}
                    </span>
                  </button>

                  {live.reservedCents !== null && live.reservedCents > 0 && (
                    <div
                      className="w-full h-2 rounded-full overflow-hidden mt-3"
                      style={{ background: 'var(--surface-container-high)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: 'var(--primary)' }}
                      />
                    </div>
                  )}

                  {live.reservedCents !== null && (
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2 text-[11px] font-semibold text-on-surface-dim">
                      <span className="text-success font-bold">
                        {t('dashboard.live_event_remaining', {
                          amount: formatMoney(live.remainingCents, trip.baseCurrency),
                        })}
                      </span>
                      {live.perDayCents > 0 && (
                        <span>
                          {t('dashboard.live_event_per_day', {
                            amount: formatMoney(live.perDayCents, trip.baseCurrency),
                          })}
                        </span>
                      )}
                      <span>
                        {t('dashboard.live_event_days_left', { count: live.daysLeftInclusive })}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-1.5">
                    {live.expenses.length === 0 ? (
                      <p className="text-[11px] font-medium text-on-surface-faint">
                        {t('dashboard.live_event_no_spend')}
                      </p>
                    ) : (
                      <>
                        {live.expenses.slice(0, 3).map((e) => (
                          <div key={e.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 min-w-0 truncate text-on-surface-dim font-medium">
                              {e.description || t(`categories.${e.category ?? 'other'}` as never)}
                            </span>
                            <span className="text-on-surface-faint tabular text-[11px] shrink-0">
                              {formatShortDate(e.date)}
                            </span>
                            <span className="tabular font-bold text-on-surface shrink-0">
                              {formatMoney(e.baseCostCents, trip.baseCurrency)}
                            </span>
                          </div>
                        ))}
                        {live.expenses.length > 3 && (
                          <button
                            onClick={() => navigate(`/event/${occ.id}`)}
                            className="text-[11px] font-semibold text-primary btn-press self-start flex items-center gap-0.5"
                          >
                            {t('dashboard.live_event_more', { count: live.expenses.length - 3 })}
                            <Icon name="chevron_right" size={12} className="text-primary" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* DEC-400/409 (G1): the event's own lifecycle. Before it is
                      started → the single "iniciar evento" gesture (+ postpone).
                      Once started → the PRIMARY action is a direct event expense,
                      with "iniciar saída" as the secondary focus mode and an
                      explicit "encerrar evento"; a running outing is embedded here
                      (no 2nd card). */}
                  {occ.startedAt == null ? (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onStartEvent(occ.id)}
                        className="flex-1 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
                      >
                        {t('dashboard.event_start')}
                      </button>
                      <button
                        onClick={() => onPostponeEvent(occ.id)}
                        className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                      >
                        {t('dashboard.event_postpone')}
                      </button>
                    </div>
                  ) : (
                    <>
                      {live.activeSessionId !== null ? (
                        <button
                          onClick={() => navigate('/outings/active')}
                          className="w-full mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5 btn-press text-left"
                          style={{ background: 'var(--surface-container-high)' }}
                        >
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                          </span>
                          <span className="flex-1 min-w-0 text-xs font-bold text-on-surface truncate">
                            {t('dashboard.live_event_active_outing')}
                          </span>
                          <span className="text-[11px] font-bold text-primary shrink-0">
                            {t('dashboard.live_event_open_outing')}
                          </span>
                        </button>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigate(`/quick-add?occurrence=${occ.id}`)}
                            className="flex-1 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
                          >
                            {t('dashboard.live_event_log_expense')}
                          </button>
                          <button
                            onClick={() => navigate(`/outings/new?occurrence=${occ.id}`)}
                            className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                          >
                            {t('dashboard.live_event_start_outing')}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => onEndEvent(occ.id)}
                        className="w-full mt-2 py-1.5 text-[11px] font-bold text-on-surface-faint btn-press"
                      >
                        {t('dashboard.event_end')}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </>
        );
      case 'savings_goal': {
        // M14 (E6): savings goal vs projected end-of-trip surplus. READ-ONLY —
        // shown only when the traveler set a goal (ÂNCORA 11 / DEC-088).
        const goal = model.savingsGoal;
        if (!goal) return null;
        const pct = Math.round(goal.progressRatio * 100);
        return (
          <button
            onClick={onEditSavingsGoal}
            aria-label={t('dashboard.goal_edit')}
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
              <Icon name="edit" size={13} className="text-on-surface-faint" />
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
          <button
            type="button"
            onClick={() => {
              hapticSelection();
              setPiggyStatementOpen(true);
            }}
            className={`relative mt-4 p-4 rounded-2xl flex items-center gap-3 w-full text-left${activeFocusCardId === 'piggy_bank' ? ' lens-card' : ''}`}
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
              <p className="text-[10px] font-bold text-primary mt-1 flex items-center gap-0.5">
                {t('dashboard.piggy_tap_hint')}
                <Icon name="chevron_right" size={12} className="text-primary" />
              </p>
            </div>
          </button>
        ) : null;
      case 'active_outing':
        // DEC-409 (G1): an outing that belongs to a live event is shown EMBEDDED
        // inside that event's card — suppress the standalone card (no 2nd card).
        if (model.activeOutingEmbedded) return null;
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
      case 'suggest_outing':
        // C2 (UX-clarity §4.12): calm, dismissible — never blocks anything.
        if (!model.outingSuggestion.active || outingNudgeDismissed) return null;
        return (
          <div
            data-suggest-outing
            className="w-full mt-4 p-4 rounded-2xl flex items-start gap-3"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="local_bar" size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface">{t('dashboard.suggest_outing_title')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5 leading-snug">
                {t('dashboard.suggest_outing_body', { count: model.outingSuggestion.count })}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  data-suggest-outing-cta
                  onClick={() => {
                    hapticSelection();
                    navigate('/outings/new');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold btn-press"
                  style={{ background: 'var(--primary)', color: 'var(--surface)' }}
                >
                  {t('dashboard.suggest_outing_cta')}
                </button>
                <button
                  data-suggest-outing-dismiss
                  onClick={handleDismissOutingNudge}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-dim btn-press"
                >
                  {t('dashboard.suggest_outing_dismiss')}
                </button>
              </div>
            </div>
          </div>
        );
      case 'hero':
        return (
          <>
            {/* §7 pos. 5 — HERO CARD (DEC-168: tappable → "where this number comes from") */}
            {model.fts && model.trueFree && model.heroMoney && (
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
                {/* M06: a hero €0 has two meanings — spent out vs. fully earmarked.
                    When every euro of the phase is already claimed by the plan, the
                    raw €0 reads as "I'm broke"; this calm line reframes it as "all
                    allocated" so the zero orients instead of alarming. */}
                {isPhaseFullyPlanned(model.trueFree) && (
                  <p className="text-xs font-semibold mt-1.5 text-on-surface-dim">
                    {t('dashboard.hero_fully_planned')}
                  </p>
                )}
                {/* FIELD-18: the truly-free hero, explained — the phase total and the
                    part already earmarked in the plan (trueFree + plan = na fase). */}
                {model.trueFree.planReservedCents > 0 && (
                  <p className="text-[11px] font-semibold mt-1 text-on-surface-faint">
                    {t('dashboard.hero_phase_total', {
                      total: formatMoney(model.trueFree.phaseFreeCents, trip.baseCurrency),
                      plan: formatMoney(model.trueFree.planReservedCents, trip.baseCurrency),
                    })}
                  </p>
                )}
                {model.todayBudget && model.todayBudget.todayAllowanceCents > 0 && (
                  <>
                    <p
                      className={`text-xs font-bold mt-1.5 ${
                        baseFreeTodayCents < 0
                          ? 'text-error'
                          : model.todayBudget.isPeakDay
                            ? 'text-warning'
                            : 'text-on-surface-dim'
                      }`}
                    >
                      {model.todayBudget.isPeakDay
                        ? t('dashboard.peak_day_free', {
                            amount: formatMoney(displayFreeTodayCents, trip.baseCurrency),
                          })
                        : t('dashboard.free_per_day', {
                            amount: formatMoney(displayFreeTodayCents, trip.baseCurrency),
                          })}
                    </p>
                    {/* FIELD-17: when a check-in reframes today, show the complement
                        (saved for later / reserved for the night) so the smaller
                        number is legible — the difference is FELT, not confusing. */}
                    {checkInTodayPlan &&
                      checkInTodayPlan.secondaryCents !== null &&
                      checkInTodayPlan.secondaryCents > 0 &&
                      checkInTodayPlan.secondaryLabelKey && (
                        <p className="text-[11px] font-semibold mt-0.5 text-primary">
                          {t(checkInTodayPlan.secondaryLabelKey as never)}:{' '}
                          {formatMoney(checkInTodayPlan.secondaryCents, trip.baseCurrency)}
                        </p>
                      )}
                    {/* DEC-392 (G2): the event's slice of TODAY, surfaced next to the
                        free number so "livre 27" reads honestly as "+ 25 do evento
                        hoje". Additive display — the reserve already left trueFree, so
                        the hero free math is unchanged (Â-HONEST-DAY). */}
                    {model.todayEventAllowanceCents > 0 && (
                      <p className="text-[11px] font-semibold mt-0.5 text-primary">
                        {t('dashboard.event_today_portion', {
                          amount: formatMoney(model.todayEventAllowanceCents, trip.baseCurrency),
                        })}
                      </p>
                    )}
                    {/* DEC-427 (Field v2 §7-A): the headline now carries ONE number —
                        "Livre para usar hoje" (above). "Ritmo de hoje" (peak-weighted
                        projection) and "Média até o fim" (flat average) used to compete
                        here and made the user unsure which one they could spend today.
                        They moved into the hero breakdown (DashboardSheets) as clearly
                        labelled PROJECTIONS. Zero math changed — only where they render. */}
                    {/* E08 · DEC-328: a negative day reads honestly — when the
                        cofrinho buffer absorbs today's overspend, say so. The two
                        numbers come straight from the piggy ledger's entry for
                        today: the withdrawal it took (`deltaCents`) and any
                        overflow it could NOT cover (`uncoveredCents`, which is what
                        actually trims the days ahead). Read-only — no math change
                        (ÂNCORA 11); "outros dias seguem iguais" only when the
                        buffer fully covered it (overflow === 0). */}
                    {baseFreeTodayCents < 0 &&
                      model.piggyLedger &&
                      (() => {
                        const todayEntry = model.piggyLedger.entries.find(
                          (e) => e.dateIso === model.todayIso,
                        );
                        if (!todayEntry || todayEntry.deltaCents >= 0) return null;
                        const coveredCents = -todayEntry.deltaCents;
                        const overflowCents = todayEntry.uncoveredCents;
                        return (
                          <div
                            data-piggy-covered
                            className="mt-2 p-2.5 rounded-xl flex items-start gap-2"
                            style={{
                              background: 'var(--surface-container)',
                              border: '1px solid var(--border-faint)',
                            }}
                          >
                            <Icon
                              name="savings"
                              size={15}
                              className="text-primary shrink-0 mt-px"
                            />
                            <span className="text-[11px] leading-snug text-on-surface-dim">
                              {overflowCents > 0
                                ? t('dashboard.piggy_covered_partial', {
                                    covered: formatMoney(coveredCents, trip.baseCurrency),
                                    overflow: formatMoney(overflowCents, trip.baseCurrency),
                                  })
                                : t('dashboard.piggy_covered_today', {
                                    covered: formatMoney(coveredCents, trip.baseCurrency),
                                  })}
                            </span>
                          </div>
                        );
                      })()}
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
                      background:
                        PROGRESS_TONE_BG[
                          resolveProgressTone({
                            trueFreeCents: model.trueFree.trueFreeCents,
                            totalBudgetCents: model.fts.totalBudgetCents,
                            totalSpentCents: model.fts.totalSpentCents,
                            protectedReserveCents: model.fts.protectedReserveCents,
                          })
                        ],
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
                  {/* FIELD-18: the scenario plan still reserved ahead — the term
                      that turns "na fase" into "truly free". */}
                  {model.trueFree.planReservedCents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-on-surface-dim">
                        {t('dashboard.reserved_plan')}
                      </span>
                      <span className="text-xs font-bold tabular" style={{ color: 'var(--primary-dim)' }}>
                        {formatMoney(model.trueFree.planReservedCents, trip.baseCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            )}
            {/* M04: the anchor number above answers "how much is free?"; this
                shortcut answers "can I spend ___?" — opening the Simulator
                primed with today's free amount (one "free" per screen kept;
                no new number is added here). */}
            {model.fts && model.todayBudget && model.todayBudget.todayAllowanceCents > 0 && (
              <div className="mt-3">
                {/* E06: the compact "posso gastar" chip leaves room beside it, so
                    the day's check-in chip fills that space on the SAME row. The
                    chip names the chosen mode (or invites a first choice) and
                    expands the picker + read-only payoff downward like a tab. */}
                <div className="flex items-center gap-2">
                  <AskToSpendShortcut prefillCents={displayFreeTodayCents} />
                  <button
                    onClick={() => setCheckInExpanded((v) => !v)}
                    aria-expanded={isCheckInExpanded}
                    aria-label={t('dashboard.checkin_title')}
                    className="flex-1 min-w-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full btn-press"
                    style={{
                      background: 'var(--surface-container)',
                      border: '1px solid var(--border-faint)',
                    }}
                  >
                    <Icon
                      name={checkInActiveOption?.icon ?? 'mood'}
                      size={15}
                      filled={!!checkInActiveOption}
                      className="text-primary shrink-0"
                    />
                    <span className="text-xs font-semibold text-on-surface-dim truncate">
                      {effectiveCheckInIntent
                        ? t('dashboard.checkin_active', {
                            intent: t(`dashboard.checkin_${effectiveCheckInIntent}`),
                          })
                        : t('dashboard.checkin_title')}
                    </span>
                    <Icon
                      name={isCheckInExpanded ? 'expand_less' : 'expand_more'}
                      size={14}
                      className="text-on-surface-faint shrink-0 ml-auto"
                    />
                  </button>
                </div>
                {renderCheckIn()}
              </div>
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
            {/* DEC-076/DEC-122 (R-01): free-scroll carousel, ~3 cards visible.
                GATE 17: snap-none — any scroll-snap made the browser re-snap the
                carousel to card 3 when it entered the viewport, so it opened on
                a generic "Outros" count instead of the planned metas. The dot
                pager still tracks position. */}
            <div
              ref={pinOccasionCarouselLeft}
              className="flex gap-3 overflow-x-auto no-scrollbar -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] scroll-pl-[var(--page-padding-x)] scroll-pr-[var(--page-padding-x)] snap-none"
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
                      // R6-11 (R-02) / DEC-122: ~3 cards per page width.
                      className="shrink-0 w-[calc((100%-1.5rem)/3)] min-w-[104px] flex"
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
                    className="shrink-0 w-[calc((100%-1.5rem)/3)] min-w-[104px] flex"
                  >
                    <OccasionCounter
                      icon={getCategoryIcon(counter.category)}
                      count={counter.occasionCount}
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
              <div className="mt-4 rounded-2xl bg-surface-container">
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
                  {visibleInsights.map((insight) => (
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
                {visibleInsights.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {visibleInsights.map((insight, i) => (
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
                        className="px-2 py-1.5 btn-press"
                      >
                        <span
                          className="block w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              i === Math.min(insightIndex, visibleInsights.length - 1)
                                ? 'var(--primary)'
                                : 'var(--surface-container-high)',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {/* Julio device test 2026-06-18: a thin connector to the richer
                    reads on the Copiloto — reframes the cap as "there's more over
                    there", not "only these exist". */}
                <button
                  onClick={() => navigate('/copiloto')}
                  className="w-full py-2 mt-0.5 flex items-center justify-center gap-1 btn-press border-t"
                  style={{ borderColor: 'var(--border-faint)' }}
                >
                  <Icon name="auto_awesome" size={13} className="text-primary" />
                  <span className="text-[11px] font-semibold text-primary">
                    {t('dashboard.insights_more_copilot')}
                  </span>
                  <Icon name="chevron_right" size={13} className="text-primary" />
                </button>
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
                Shared with the Copiloto via AmigoSinceroCard (one source).
                FIELD R2 (F21): colored by tone; the Home hides the reassuring
                "on plan" state so it only shows when there's something to act on. */}
            <AmigoSinceroCard
              amigo={model.amigoV2}
              // D06 · DEC-317: the Amigo Sincero is VOICE ONLY now. Its factual
              // extras (cofrinho movement, phase %, daily left, top category,
              // receivable) have moved to the insights carousel above (relocated
              // in useDashboardModel, de-duped). No objective data lives in the
              // friend's card anymore — only the opinionated verdict + voice.
              extras={[]}
              currency={trip.baseCurrency}
              onSeeImpact={() => navigate('/impact')}
              onRescue={() => navigate('/rescue')}
              onOpenPiggyStatement={() => setPiggyStatementOpen(true)}
              voice={resolveHonestFriendVoice(settings.honestFriendVoice)}
              daySeed={model.dayNum ?? 0}
              onOpenVoiceSettings={() => navigate('/settings?section=amigo')}
              hideOnPlan
            />
          </>
        );
      case 'pending_p2p':
        // DEC-352 (F19, G6): inbound P2P charges/payments that arrived in
        // real-time — a one-tap doorway to accept/confirm. Self-gates on count.
        return model.inboundP2pCount > 0 ? (
          <button
            onClick={() => navigate('/shared')}
            className="w-full mt-4 p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
            style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
          >
            <Icon name="payments" className="text-warning" />
            <div className="flex-1">
              <p className="text-sm font-bold text-warning">
                {t('dashboard.pending_p2p', { count: model.inboundP2pCount })}
              </p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A843aa' }}>
                {t('dashboard.pending_p2p_hint')}
              </p>
            </div>
            <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
          </button>
        ) : null;
      case 'debt_summary':
        // DL-4: home "te devem / você deve" — confirmed debts only (the real
        // money), a one-tap doorway into the settle-up hub. Hidden when even.
        return model.receivableCents > 0 || model.payableCents > 0 ? (
          <button
            onClick={() => navigate('/shared')}
            className="w-full mt-4 p-4 rounded-2xl bg-surface-container btn-press text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon name="group" size={18} className="text-primary" />
              <p className="text-sm font-bold text-on-surface flex-1">
                {t('dashboard.card_debt_summary')}
              </p>
              <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-faint">
                  {t('shared.summary_receivable')}
                </p>
                <p className="text-xl font-extrabold tabular text-success leading-tight mt-0.5">
                  {formatMoney(model.receivableCents, trip.baseCurrency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-faint">
                  {t('shared.summary_payable')}
                </p>
                <p className="text-xl font-extrabold tabular text-error leading-tight mt-0.5">
                  {formatMoney(model.payableCents, trip.baseCurrency)}
                </p>
              </div>
            </div>
          </button>
        ) : null;
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
            {/* POTS on the Home — only the ones relevant now (D8). The full list
                lives on the "Potes e planejados" section of /viagem. */}
            {model.visiblePotSummaries.map(({ pool, summary }) => (
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
            {/* GATE 5 (D15 / DEC-314): pots owned by another phase stay OUT of the
                focus above, but remain discoverable in a collapsed area — never
                deleted (ÂNCORA 9), and still selectable when logging an expense. */}
            <OtherPhasePotsSection summaries={model.otherPhasePotSummaries} />
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
            {model.recentFeed.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-on-surface">{t('dashboard.recent_expenses')}</p>
                  <button
                    onClick={() => navigate('/expenses')}
                    className="text-xs text-primary btn-press font-bold"
                  >
                    {t('common.view_all')}
                  </button>
                </div>
                {/* FIELD-15: compact preview — one card with dense rows (max 3),
                    not a tall wall of full-size cards. The complete list is one
                    tap away via "ver todos". FIELD R2 (F7): each row reads as a
                    relative day + wall-clock time ("Hoje 19:42 · Bar") so the
                    most recent activity is legible at a glance. D-BUG-13: a
                    browsed session collapses into ONE "Bar · N itens" row here
                    too (same rollup as the full list), never loose rounds. */}
                <div className="bg-surface-container rounded-2xl divide-y divide-on-surface-mute">
                  {model.recentFeed.map((entry) => {
                    const day = localDayOf(entry.date);
                    const dayLabel =
                      day === localDateString()
                        ? t('expenses.day_today')
                        : day === localDateString(new Date(Date.now() - 86_400_000))
                          ? t('expenses.day_yesterday')
                          : formatShortDate(day);
                    if (entry.kind === 'session') {
                      const { session, txs, totalCents } = entry;
                      const isReceipt = txs.some((tx) => tx.externalRef?.startsWith('receipt:'));
                      const profile = model.profiles.find((p) => p.id === session.activityProfileId);
                      const icon = isReceipt
                        ? 'receipt_long'
                        : (profile?.iconName ?? getCategoryIcon(profile?.category ?? null));
                      return (
                        <button
                          key={session.id}
                          onClick={() => navigate(`/outings/${session.id}/review`)}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 btn-press text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0 relative">
                            <Icon name={icon} size={16} className="text-on-surface-dim" />
                            {isReceipt && (
                              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                                <Icon name="auto_awesome" size={8} className="text-on-surface" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-on-surface truncate">{session.name}</p>
                            <p className="text-[11px] text-on-surface-faint truncate">
                              {dayLabel} · {t('expenses.outing_items', { count: txs.length })}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular shrink-0 text-on-surface">
                            {formatMoney(totalCents, txs[0]?.currency ?? trip.baseCurrency)}
                          </p>
                        </button>
                      );
                    }
                    const tx = entry.tx;
                    return (
                      <button
                        key={tx.id}
                        onClick={() => navigate(`/expenses/${tx.id}`)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 btn-press text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                          <Icon
                            name={tx.type === 'income' ? 'savings' : getCategoryIcon(tx.category)}
                            size={16}
                            className={tx.type === 'income' ? 'text-success' : 'text-on-surface-dim'}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-on-surface truncate">{tx.description}</p>
                          <p className="text-[11px] text-on-surface-faint truncate">
                            {dayLabel} {localClockTime(tx.date)}
                            {tx.category ? ` · ${t(`categories.${tx.category}` as never)}` : ''}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold tabular shrink-0 ${
                            tx.type === 'income' ? 'text-success' : 'text-on-surface'
                          }`}
                        >
                          {tx.type === 'income' ? '+ ' : ''}
                          {formatMoney(tx.amountCents, tx.currency)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {model.recentFeed.length === 0 && (
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

  // FIELD item 16: a pairable card has content right now (an empty one never
  // pairs — it would leave a blank half-row). Mirrors each card's own render
  // guard so the geometry and the content stay in lockstep.
  const pairableHasContent = (id: DashboardCardId): boolean => {
    switch (id) {
      case 'savings_goal':
        return Boolean(model.savingsGoal);
      case 'piggy_bank':
        return model.piggyBankCents > 0;
      // FIELD R2 item 6 (F6): the divisions tile only pairs when there's a
      // pending confirmation to surface (an empty one never leaves a blank half).
      case 'pending_shares':
        return model.hasPendingExpenses;
      case 'planned_purchases':
        return model.plannedPurchasesSummary.openCount > 0;
      case 'funds_summary':
        // Half width fits exactly one pool cleanly; with several it stays full.
        return model.visiblePotSummaries.length === 1;
      default:
        return false;
    }
  };

  // FIELD item 16: the half-width compact tile of a pairable card — a uniform
  // icon + label + single number, so two sit cleanly side by side. The full
  // card (its rich body) still renders when the card is on its own row.
  const COMPACT_TILE_CLASS =
    'w-full h-full p-3.5 rounded-2xl bg-surface-container text-left btn-press flex flex-col gap-1';
  const renderCompactCard = (id: DashboardCardId): ReactNode => {
    switch (id) {
      case 'savings_goal': {
        const goal = model.savingsGoal;
        if (!goal) return null;
        const pct = Math.round(goal.progressRatio * 100);
        return (
          <button onClick={onEditSavingsGoal} aria-label={t('dashboard.goal_edit')} className={COMPACT_TILE_CLASS}>
            <div className="flex items-center gap-1.5">
              <Icon name="flag" size={15} filled className={goal.onTrack ? 'text-success' : 'text-warning'} />
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-faint truncate">
                {t('dashboard.goal_title')}
              </span>
            </div>
            <p className="text-xl font-extrabold tracking-tight leading-none mt-0.5 tabular text-on-surface">
              {formatMoney(Math.max(0, goal.projectedSurplusCents), trip.baseCurrency)}
            </p>
            <p className="text-[10px] font-semibold text-on-surface-faint truncate">{t('dashboard.goal_projected')}</p>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden mt-auto"
              style={{ background: 'var(--surface-container-high)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: goal.onTrack ? 'var(--success)' : 'var(--warning)' }}
              />
            </div>
          </button>
        );
      }
      case 'piggy_bank':
        return model.piggyBankCents > 0 ? (
          <div className={COMPACT_TILE_CLASS} style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}>
            <div className="flex items-center gap-1.5">
              <Icon name="savings" size={15} filled className="text-success" />
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-faint truncate">
                {t('dashboard.piggy_title')}
              </span>
            </div>
            <p className="text-xl font-extrabold tabular text-success leading-none mt-0.5">
              <AnimatedMoney cents={model.piggyBankCents} currency={trip.baseCurrency} pulseOnChange />
            </p>
            <p className="text-[10px] font-semibold text-on-surface-faint truncate">{t('dashboard.piggy_desc')}</p>
          </div>
        ) : null;
      case 'pending_shares':
        // FIELD R2 item 6 (F6): the divisions card as a compact tile — count of
        // shares awaiting confirmation + their net impact, opening the same
        // confirm sheet as the full card.
        return model.hasPendingExpenses ? (
          <button
            onClick={onOpenConfirmSheet}
            className={COMPACT_TILE_CLASS}
            style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="group" size={15} className="text-warning" />
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-faint truncate">
                {t('dashboard.card_pending_shares')}
              </span>
            </div>
            <p className="text-xl font-extrabold leading-none mt-0.5 tabular text-warning">
              {model.pendingShares.length}
            </p>
            <p className="text-[10px] font-semibold truncate" style={{ color: '#D4A843aa' }}>
              {formatMoney(model.pendingImpactCents, trip.baseCurrency)}
            </p>
          </button>
        ) : null;
      case 'planned_purchases': {
        const planned = model.plannedPurchasesSummary;
        if (planned.openCount === 0) return null;
        return (
          <button onClick={() => navigate('/planned')} className={COMPACT_TILE_CLASS}>
            <div className="flex items-center gap-1.5">
              <Icon name="shopping_bag" size={15} className="text-primary" />
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-faint truncate">
                {t('dashboard.card_planned_purchases')}
              </span>
            </div>
            {planned.totalReservedCents > 0 ? (
              <p className="text-xl font-extrabold tracking-tight leading-none mt-0.5 tabular text-primary">
                {formatMoney(planned.totalReservedCents, trip.baseCurrency)}
              </p>
            ) : (
              <p className="text-xl font-extrabold leading-none mt-0.5 tabular text-on-surface">{planned.openCount}</p>
            )}
            <p className="text-[10px] font-semibold text-on-surface-faint truncate">
              {planned.totalReservedCents > 0
                ? t('dashboard.planned_card_hint')
                : `${t('planned.tracking_badge')} · ${planned.openCount}`}
            </p>
          </button>
        );
      }
      case 'funds_summary': {
        const entry = model.visiblePotSummaries[0];
        if (!entry) return null;
        const { pool, summary } = entry;
        return (
          <button onClick={() => navigate('/funds')} className={COMPACT_TILE_CLASS}>
            <div className="flex items-center gap-1.5">
              <Icon name="shopping_bag" size={15} className="text-primary" />
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-on-surface-faint truncate">
                {pool.name}
              </span>
            </div>
            <p className="text-xl font-extrabold tracking-tight leading-none mt-0.5 tabular text-on-surface">
              {formatMoney(summary.remainingCents, pool.currency)}
            </p>
            <p className="text-[10px] font-semibold text-on-surface-faint truncate">{t('dashboard.remaining')}</p>
          </button>
        );
      }
      default:
        return null;
    }
  };

  const cardSequence = resolveDashboardCardSequence(settings.dashboardCardOrder);

  // FIELD-09: the day's focus (chosen by the check-in lens) renders right under
  // the hero — the check-in now lives on the hero (E06), so what sits below it is
  // the day's focus, not always the piggy bank. Only repositions a card that is
  // already visible (ÂNCORA 9 — nothing is hidden or removed, just moved for the day).
  // FIELD R2 item 5 (F5): contextual cards (the piggy bank) stay OUT of the
  // permanent flow — they surface only when the day's lens spotlights them or
  // the traveler pinned them, so the reward keeps its punch (ÂNCORA 12 — purely
  // a framing/visibility decision, the amount itself never changes).
  let visibleSequence = cardSequence.filter(
    (id) =>
      !isDashboardCardHidden(id, settings.hiddenDashboardCards) &&
      shouldRenderContextualCard(id, settings.dashboardPinnedCards, activeFocusCardId),
  );
  if (
    activeFocusCardId &&
    visibleSequence.includes(activeFocusCardId) &&
    visibleSequence.includes('hero')
  ) {
    const withoutFocus = visibleSequence.filter((id) => id !== activeFocusCardId);
    const heroIdx = withoutFocus.indexOf('hero');
    visibleSequence = [
      ...withoutFocus.slice(0, heroIdx + 1),
      activeFocusCardId,
      ...withoutFocus.slice(heroIdx + 1),
    ];
  }

  // FIELD item 16: cards the traveler opted into the 2-up grid, that have
  // content and are not the day's spotlighted focus (the focus keeps full width
  // with its lens chip). groupDashboardRows then folds the sequence into rows.
  const pairableNow = new Set<DashboardCardId>(
    visibleSequence.filter(
      (id) =>
        id !== activeFocusCardId &&
        isDashboardCardPaired(id, settings.dashboardPairedCards) &&
        pairableHasContent(id),
    ),
  );
  const rows = groupDashboardRows(visibleSequence, pairableNow);

  // DEC-119 (R-10): configurable home screen — order + visibility.
  // FIELD item 16: paired rows render two compact tiles side by side.
  return (
    <>
      {rows.map((row) =>
        row.kind === 'full' ? (
          getDashboardCard(row.id).fixed ? (
            <div key={row.id}>{renderDashboardCard(row.id)}</div>
          ) : (
            <div key={row.id} {...getCardLongPress(row.id)}>
              {renderDashboardCard(row.id)}
            </div>
          )
        ) : (
          <div key={row.ids.join('+')} className="flex gap-3 mt-4 items-stretch">
            {row.ids.map((id) => (
              <div key={id} className="flex-1 min-w-0" {...getCardLongPress(id)}>
                {renderCompactCard(id)}
              </div>
            ))}
          </div>
        ),
      )}
      {/* FB-08 · DEC-279: mounted once here so the cofrinho statement is reachable
          from BOTH the piggy card and the Amigo Sincero movement insight. */}
      <PiggyStatementSheet
        open={piggyStatementOpen}
        onClose={() => setPiggyStatementOpen(false)}
        ledger={model.piggyLedger}
        currency={trip.baseCurrency}
        todayIso={model.todayIso}
        settledBalanceCents={model.piggyBankCents}
        withdrawOffer={
          model.piggyWithdrawPreview
            ? {
                ...model.piggyWithdrawPreview,
                onWithdraw: () => {
                  hapticSelection();
                  onPiggyWithdraw(model.piggyWithdrawPreview!.availableCents);
                  setPiggyStatementOpen(false);
                },
              }
            : null
        }
      />
    </>
  );
}

/**
 * GATE 5 (D15 / DEC-314): a collapsed "Potes de outras fases" area under the Home
 * pots. Pots dated for another trecho do not pollute the current phase's focus, but
 * they stay one tap away (ÂNCORA 9 — never deleted, only moved down the hierarchy).
 * Tapping any of them opens the full "Potes" screen, where they remain editable and
 * selectable for an expense at any time.
 */
function OtherPhasePotsSection({
  summaries,
}: {
  summaries: DashboardModel['otherPhasePotSummaries'];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (summaries.length === 0) return null;

  return (
    <div className="mt-4" data-other-phase-pots>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 py-1.5 btn-press"
      >
        <span className="text-xs font-semibold text-on-surface-dim">
          {t('dashboard.pots_other_phases', { count: summaries.length })}
        </span>
        <Icon
          name={expanded ? 'expand_less' : 'expand_more'}
          size={18}
          className="text-on-surface-faint shrink-0"
        />
      </button>
      {!expanded && (
        <p className="text-[11px] text-on-surface-faint leading-snug">
          {t('dashboard.pots_other_phases_hint')}
        </p>
      )}
      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          {summaries.map(({ pool, summary }) => (
            <button
              key={pool.id}
              onClick={() => navigate('/funds')}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container text-left btn-press"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{pool.name}</p>
                {pool.dateStart && (
                  <p className="text-[11px] text-on-surface-faint">
                    {formatShortDate(pool.dateStart)}
                    {pool.dateEnd && pool.dateEnd !== pool.dateStart
                      ? ` – ${formatShortDate(pool.dateEnd)}`
                      : ''}
                  </p>
                )}
              </div>
              <p className="text-sm font-bold tabular text-on-surface-dim shrink-0">
                {formatMoney(summary.remainingCents, pool.currency)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
