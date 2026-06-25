import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useDashboardModel } from '@/features/dashboard/useDashboardModel';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { BurndownCard } from '@/features/dashboard/cards/BurndownCard';
import { HeatmapCard } from '@/features/dashboard/cards/HeatmapCard';
import { RecapCard } from '@/features/dashboard/cards/RecapCard';
import { AmigoSinceroCard } from '@/features/dashboard/cards/AmigoSinceroCard';
import { PiggyStatementSheet } from '@/features/dashboard/cards/PiggyStatementSheet';
import { TripWrappedSheet } from './TripWrappedSheet';
import { getCategoryIcon } from '@/utils/category-icons';
import { formatMoney, sumCents } from '@/domain/money';
import { sortPhasesByOrder, getTotalDays, localDateString, addDaysIso, formatDate } from '@/domain/dates';
import { shiftMonth } from '@/domain/dashboard';
import { calculatePoolSpent, classifyBudgetSignal } from '@/domain/budget';
import { filterTransactionsByPhase } from '@/domain/transactions';
import { calculateDebts } from '@/domain/splitting';
import { calculateSessionTotal } from '@/domain/outing';
import { forecastSnapshotRepository } from '@/data/repositories';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import {
  buildCopilotVerdict,
  summarizeByCategory,
  summarizeDailySpending,
  summarizeSocialVsSolo,
  comparePhasePace,
  summarizeForecastTrend,
  calculateRunway,
  summarizeWeekdayPattern,
  summarizeOutingEfficiency,
  summarizePaymentMix,
  summarizeHomeCurrencyTotal,
  summarizePeakHour,
  summarizeDisciplineStreak,
  buildTripWrapped,
  NEUTRAL_READING,
  readOutingEfficiency,
  readProjection,
  readForecastTrend,
  readRunway,
  readPhasePace,
  type CopilotVerdictStatus,
  type PatternReading,
} from '@/domain/copilot';

/** Section heading — mirrors the faint uppercase label used across the app. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mt-5 mb-2 px-1">
      {children}
    </p>
  );
}

const READING_TONE_STYLE: Record<PatternReading['tone'], { color: string; icon: string }> = {
  good: { color: 'var(--success)', icon: 'check_circle' },
  watch: { color: 'var(--warning)', icon: 'visibility' },
  neutral: { color: 'var(--on-surface-faint)', icon: 'info' },
};

/**
 * C20 (DEC-304): the explicit, worded read for a pattern card — "Bom sinal" /
 * "De olho" / "Informativo" — so the judgment never relies on the icon color
 * alone (a11y) and a descriptive card can't be misread as a problem.
 */
function ReadingLine({ reading }: { reading: PatternReading }) {
  const { t } = useTranslation();
  const tone = READING_TONE_STYLE[reading.tone];
  return (
    <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold" style={{ color: tone.color }}>
      <Icon name={tone.icon} size={13} />
      {t(reading.labelKey as never)}
    </span>
  );
}

type ThemeKey = 'now' | 'heading' | 'patterns' | 'people';

/**
 * P3 (UX audit §4.6 / G3): the Copiloto used to be a flat wall of ~18 reads
 * ("parede de cards"). They're now grouped into four themes; the first non-empty
 * group opens by default and the rest are one tap away ("ver mais análises").
 * Each group self-hides when it has no data, so the page never shows a dead head.
 */
function ThemeGroup({
  title,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-1 py-2 btn-press text-left"
      >
        <Icon name={icon} size={18} className="text-primary shrink-0" />
        <span className="text-sm font-bold text-on-surface flex-1">{title}</span>
        {!open && count > 0 && (
          <span className="text-[11px] font-bold tabular text-on-surface-faint min-w-5 h-5 px-1.5 rounded-full bg-surface-high flex items-center justify-center">
            {count}
          </span>
        )}
        <Icon
          name="expand_more"
          size={20}
          className="text-on-surface-faint shrink-0 transition-transform"
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>
      {open && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

/** Tint + icon per verdict status — data-driven, not branching in the JSX. */
const VERDICT_STYLE: Record<
  CopilotVerdictStatus,
  { bg: string; border: string; color: string; icon: string }
> = {
  ahead: { bg: 'rgba(107,143,113,.10)', border: 'rgba(107,143,113,.18)', color: 'var(--success)', icon: 'verified_user' },
  on_track: { bg: '#C75B3910', border: '#C75B3918', color: 'var(--primary)', icon: 'check_circle' },
  behind: { bg: '#D4A84312', border: '#D4A84320', color: 'var(--warning)', icon: 'warning' },
};

interface ToolItem {
  icon: string;
  label: string;
  desc: string;
  path: string;
}

/**
 * Redesign (G3): "Copiloto" is the intelligence tab. It turns the data the
 * user already feeds the app into a short narrative — am I OK, where is this
 * heading, what would I do — then deepens into where the money came from, the
 * month map, the phase pace and a few cross-cuts. Pure derivations live in
 * src/domain/copilot/ (DEC-178); this page only orchestrates and reuses the
 * dashboard model. See brain/documents/copilot-intelligence-2026-06-15.md.
 */
export function CopilotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appData = useAppData();
  const { trip, transactions, participants, wallets, loading, error, settings, retry } = appData;

  const [heatmapMonth, setHeatmapMonth] = useState(() => localDateString(new Date()).slice(0, 7));
  // U4 (DEC-131 moved here): tapping a day on the month map opens a floating
  // sheet with that day's expenses (no full navigation).
  const [heatmapDayIso, setHeatmapDayIso] = useState<string | null>(null);
  // P3 (§4.6): which theme groups are expanded — an absent key falls back to
  // "only the first non-empty group is open" (see isGroupOpen below).
  const [openGroups, setOpenGroups] = useState<Partial<Record<ThemeKey, boolean>>>({});
  const [wrappedOpen, setWrappedOpen] = useState(false);
  // C09/DEC-300: the cofrinho is a FIXED, always-reachable section here.
  const [piggyOpen, setPiggyOpen] = useState(false);
  const model = useDashboardModel(appData, heatmapMonth, heatmapDayIso);

  const verdict = useMemo(() => buildCopilotVerdict(model.burndown), [model.burndown]);

  // C04/DEC-304: the recurring scare — the Copilot reads REAL spend pace (this
  // verdict) while the Planner shows a red from FUTURE allocation. When real
  // spend is on track but the plan is over-allocated, say so HERE too, in the
  // same words, so the two screens stop contradicting each other.
  const planOverButRealOk = useMemo(() => {
    if (!model.fts || !model.trueFree) return false;
    const realSpendOverCents = Math.max(0, -model.fts.freeToSpendCents);
    const overAllocationCents =
      model.fts.freeToSpendCents >= 0 && model.trueFree.trueFreeCents < 0
        ? -model.trueFree.trueFreeCents
        : 0;
    return (
      classifyBudgetSignal({
        realSpendOverCents,
        overAllocationCents,
        projectedOverCents: 0,
      }).kind === 'allocation_over'
    );
  }, [model.fts, model.trueFree]);
  const projection = useMemo(
    () => model.insights.find((i) => i.kind === 'phase_projection') ?? null,
    [model.insights],
  );
  const categories = useMemo(() => summarizeByCategory(transactions), [transactions]);
  const dailySummary = useMemo(() => summarizeDailySpending(model.heatmap), [model.heatmap]);
  const social = useMemo(() => summarizeSocialVsSolo(transactions), [transactions]);

  const debts = useMemo(() => {
    if (!model.owner) return [];
    const { debts: all } = calculateDebts(
      transactions,
      model.allShares,
      participants,
      model.settlements,
      model.owner.id,
    );
    return all.filter(
      (d) =>
        d.amountCents > 0 && (d.creditorId === model.owner!.id || d.debtorId === model.owner!.id),
    );
  }, [transactions, model.allShares, participants, model.settlements, model.owner]);

  // "vs the previous phase" — daily pace now against the phase before the
  // active one. Self-censors (null) until both phases have real spend.
  const phaseComparison = useMemo(() => {
    if (!model.activePhase || model.dayNum === null) return null;
    const ordered = sortPhasesByOrder(appData.phases.filter((p) => p.deletedAt === null));
    const idx = ordered.findIndex((p) => p.id === model.activePhase!.id);
    const previous = idx > 0 ? ordered[idx - 1] : null;
    if (!previous) return null;
    const currentSpent = calculatePoolSpent(filterTransactionsByPhase(transactions, model.activePhase.id));
    const previousSpent = calculatePoolSpent(filterTransactionsByPhase(transactions, previous.id));
    const result = comparePhasePace(
      currentSpent,
      model.dayNum,
      previousSpent,
      getTotalDays(previous.startDate, previous.endDate),
    );
    return result ? { ...result, previousName: previous.name } : null;
  }, [appData.phases, transactions, model.activePhase, model.dayNum]);

  // DEC-181: forecast-snapshot series for the active phase — the one time
  // series the app keeps. Loaded async (it's the only Copiloto datum not
  // already in the dashboard model).
  const [snapshots, setSnapshots] = useState<ForecastSnapshot[]>([]);
  useEffect(() => {
    if (!model.activePhase) {
      setSnapshots([]);
      return;
    }
    let alive = true;
    forecastSnapshotRepository
      .getByPhaseId(model.activePhase.id)
      .then((rows) => {
        if (alive) setSnapshots(rows);
      })
      .catch(() => {
        if (alive) setSnapshots([]);
      });
    return () => {
      alive = false;
    };
  }, [model.activePhase, transactions]);

  const forecastTrend = useMemo(() => summarizeForecastTrend(snapshots), [snapshots]);

  // DEC-182: runway of the free-to-spend at the phase's daily pace.
  const runway = useMemo(() => {
    if (!model.fts || !model.activePhase || model.dayNum === null) return null;
    const avgDailyCents = model.dayNum > 0 ? Math.round(model.fts.totalSpentCents / model.dayNum) : 0;
    const totalDays = getTotalDays(model.activePhase.startDate, model.activePhase.endDate);
    const daysLeft = totalDays - model.dayNum + 1;
    return calculateRunway(model.fts.freeToSpendCents, avgDailyCents, daysLeft);
  }, [model.fts, model.activePhase, model.dayNum]);

  const weekday = useMemo(() => summarizeWeekdayPattern(transactions), [transactions]);

  // DEC-184: efficiency across closed outings that set a target.
  const outingEfficiency = useMemo(() => {
    const outings = model.completedSessions
      .filter((s) => s.targetCents !== null)
      .map((s) => ({
        targetCents: s.targetCents as number,
        totalCents: calculateSessionTotal(transactions.filter((tx) => tx.sessionId === s.id)),
      }))
      .filter((o) => o.totalCents > 0);
    return summarizeOutingEfficiency(outings);
  }, [model.completedSessions, transactions]);

  // B10: four more data-gated cross-cuts (DEC-184 backlog). Each self-censors.
  const homeTotal = useMemo(() => summarizeHomeCurrencyTotal(transactions), [transactions]);
  const peakHour = useMemo(() => summarizePeakHour(transactions), [transactions]);
  const paymentMix = useMemo(() => {
    const walletTypeById = new Map(wallets.map((w) => [w.id, w.walletType]));
    return summarizePaymentMix(transactions, walletTypeById);
  }, [transactions, wallets]);
  // Discipline streak vs the phase's ideal per-day pace (budget ÷ phase days).
  const disciplineStreak = useMemo(() => {
    if (!model.fts || !model.activePhase) return null;
    const days = getTotalDays(model.activePhase.startDate, model.activePhase.endDate);
    if (days <= 0) return null;
    const dailyTargetCents = Math.round(model.fts.totalBudgetCents / days);
    const phaseTxs = filterTransactionsByPhase(transactions, model.activePhase.id);
    return summarizeDisciplineStreak(phaseTxs, dailyTargetCents);
  }, [model.fts, model.activePhase, transactions]);

  // DEC-247 (module H / C1): the end-of-trip "Wrapped" — trip-wide superlatives
  // from the same pure derivations, reachable any time (preview until ended).
  const wrapped = useMemo(
    () =>
      buildTripWrapped({
        transactions,
        endDateIso: trip?.endDate ?? '',
        todayIso: model.todayIso,
      }),
    [transactions, trip?.endDate, model.todayIso],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }
  if (error) return <DataErrorScreen onRetry={retry} />;
  if (!trip || !settings?.onboardingCompleted) return <Navigate to="/welcome" replace />;

  const currency = trip.baseCurrency;
  const phaseTotalDays = model.activePhase
    ? getTotalDays(model.activePhase.startDate, model.activePhase.endDate)
    : 0;
  const maxCategoryCents = categories[0]?.cents ?? 0;
  const hasMap = model.heatmap.monthTotalCents > 0;
  const hasAnySignal = verdict !== null || categories.length > 0 || hasMap || homeTotal !== null;

  // P3 (§4.6 / G3): per-section visibility → per-theme counts → which groups to
  // render and which opens by default. Mirrors each section's own render guard.
  const vVerdict = !!(verdict && model.activePhase && model.fts);
  const vRecap = !!model.recap;
  const vAmigo = model.amigoV2.kind !== 'none';
  const vAnchor = !!homeTotal;
  const vStreak = !!disciplineStreak;
  const vProjection = !!projection;
  const vTrend = !!forecastTrend;
  const vRunway = !!runway;
  const vBurndown = !!model.burndown;
  const vCompare = !!phaseComparison;
  const vCategories = categories.length > 0;
  const vMap = hasMap;
  const vWeekday = !!weekday;
  const vPeak = !!peakHour;
  const vOutings = !!outingEfficiency;
  const vSocial = social.sharedCents > 0;
  const vMethod = !!paymentMix;
  const vDebts = debts.length > 0 && !!model.owner;

  const countBools = (...bs: boolean[]) => bs.filter(Boolean).length;
  const nowCount = countBools(vVerdict, vRecap, vAmigo, vAnchor, vStreak);
  const headingCount = countBools(vProjection, vTrend, vRunway, vBurndown, vCompare);
  const patternsCount = countBools(vCategories, vMap, vWeekday, vPeak, vOutings);
  const peopleCount = countBools(vSocial, vMethod, vDebts);

  const firstGroup: ThemeKey | null =
    nowCount > 0
      ? 'now'
      : headingCount > 0
        ? 'heading'
        : patternsCount > 0
          ? 'patterns'
          : peopleCount > 0
            ? 'people'
            : null;
  const isGroupOpen = (key: ThemeKey) => openGroups[key] ?? key === firstGroup;
  const toggleGroup = (key: ThemeKey) => {
    const next = !isGroupOpen(key);
    setOpenGroups((prev) => ({ ...prev, [key]: next }));
  };

  const tools: ToolItem[] = [
    { icon: 'analytics', label: t('copilot.impact'), desc: t('copilot.impact_desc'), path: '/impact' },
    { icon: 'calculate', label: t('copilot.simulate'), desc: t('copilot.simulate_desc'), path: '/simulator' },
    { icon: 'currency_exchange', label: t('copilot.converter'), desc: t('copilot.converter_desc'), path: '/converter' },
    { icon: 'sos', label: t('copilot.rescue'), desc: t('copilot.rescue_desc'), path: '/rescue' },
    { icon: 'auto_awesome', label: t('copilot.guide'), desc: t('copilot.guide_desc'), path: '/guide' },
    // FB-28 V1 (DEC-278): the help center sits beside the feature guide — "what
    // can it do" (guide) and "how do I do it" (help) are the two discovery doors.
    { icon: 'help', label: t('copilot.help'), desc: t('copilot.help_desc'), path: '/help' },
  ];

  // C09 — the most recent day that actually moved the piggy, surfaced as
  // "entrou recente" only when it was a deposit (a saving day).
  const piggyLastEntry = model.piggyLedger
    ? [...model.piggyLedger.entries].reverse().find((e) => e.kind !== 'flat')
    : undefined;
  const piggyRecentDepositCents =
    piggyLastEntry && piggyLastEntry.kind === 'deposit' ? piggyLastEntry.deltaCents : 0;
  // C21 — "ontem" routes to the cofrinho when it was a saving day (the recap is
  // about money you kept), and to the expense list when you went over (to review
  // the spend). Falls back to the list when there is no piggy concept.
  const openRecap = () => {
    if (model.recap?.within && model.piggyLedger) setPiggyOpen(true);
    else navigate('/expenses');
  };

  return (
    <div className="flex flex-col pb-6 pt-2">
      <div className="px-1">
        <h1 className="text-heading font-bold text-on-surface">{t('copilot.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-0.5">{t('copilot.subtitle')}</p>
      </div>

      {/* DEC-247: the trip retrospective ("Wrapped") — reachable any time, labeled
          a preview until the trip ends; only shown once there is real spend. */}
      {hasAnySignal && wrapped.totalCents > 0 && (
        <button
          onClick={() => setWrappedOpen(true)}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 btn-press text-left bg-surface-container"
          data-wrapped-entry
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary-subtle">
            <Icon name="auto_awesome" size={20} className="text-primary" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-on-surface">{t('wrapped.entry_title')}</span>
            <span className="block text-xs text-on-surface-dim">
              {wrapped.ended ? t('wrapped.entry_sub_ended') : t('wrapped.entry_sub_preview')}
            </span>
          </span>
          <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
        </button>
      )}
      {wrappedOpen && trip && (
        <TripWrappedSheet
          wrapped={wrapped}
          tripName={trip.name}
          currency={currency}
          onClose={() => setWrappedOpen(false)}
        />
      )}

      {/* Empty / warming-up state — never a dead screen (council §3). */}
      {!hasAnySignal && (
        <div
          className="mt-5 p-5 rounded-2xl text-center"
          style={{ background: 'var(--surface-container)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: '#C75B3918' }}
          >
            <Icon name="insights" size={24} className="text-primary" />
          </div>
          <p className="text-base font-bold text-on-surface">{t('copilot.empty_title')}</p>
          <p className="text-sm text-on-surface-dim mt-1.5 leading-snug">{t('copilot.empty_desc')}</p>
          <button
            onClick={() => navigate('/quick-add')}
            className="btn-press mt-4 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {t('copilot.empty_cta')}
          </button>
        </div>
      )}

      {/* ── COFRINHO — fixed section (C09/DEC-300): always reachable whenever the
          buffer concept applies (a dated phase → a daily ideal exists). The
          headline is what is ALREADY saved on the days that closed; today only
          lands at the day's close, so the tag reads "já guardado" (C10). ── */}
      {model.piggyLedger && (
        <>
          <SectionLabel>{t('dashboard.piggy_title')}</SectionLabel>
          <button
            onClick={() => setPiggyOpen(true)}
            className="p-4 rounded-2xl flex items-center gap-3.5 w-full text-left btn-press"
            style={{ background: 'var(--surface-container)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
              <Icon name="savings" size={18} className="text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xl font-extrabold tabular text-on-surface leading-none">
                  {formatMoney(model.piggyBankCents, currency)}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-success">
                  {t('dashboard.piggy_already_saved')}
                </span>
              </div>
              <p className="text-xs text-on-surface-faint mt-1">{t('dashboard.piggy_desc')}</p>
              {piggyRecentDepositCents > 0 && (
                <p className="text-[11px] font-semibold text-success mt-0.5">
                  +{formatMoney(piggyRecentDepositCents, currency)}
                </p>
              )}
            </div>
            <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
          </button>
        </>
      )}

      {/* ── AGORA — am I OK right now? (verdict · yesterday · honest friend ·
          whole-trip anchor · discipline streak) ── */}
      {nowCount > 0 && (
        <ThemeGroup
          title={t('copilot.group_now')}
          icon="bolt"
          count={nowCount}
          open={isGroupOpen('now')}
          onToggle={() => toggleGroup('now')}
        >
          {/* 1 · VERDICT — am I OK? */}
          {verdict && model.activePhase && model.fts && (
            <div
              className="mt-5 p-4 rounded-2xl"
              style={{ background: VERDICT_STYLE[verdict.status].bg, border: `1px solid ${VERDICT_STYLE[verdict.status].border}` }}
            >
              <div className="flex items-start gap-3">
                <Icon name={VERDICT_STYLE[verdict.status].icon} filled className="mt-0.5" style={{ color: VERDICT_STYLE[verdict.status].color }} />
                <div className="flex-1">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: VERDICT_STYLE[verdict.status].color }}>
                    {t(`copilot.verdict_${verdict.status}_label`)}
                  </p>
                  <p className="text-[17px] font-extrabold mt-1.5 leading-tight text-on-surface">
                    {t(`copilot.verdict_${verdict.status}_msg`)}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-on-surface-dim">
                      {t('copilot.verdict_phase_day', {
                        phase: model.activePhase.name || trip.name,
                        day: model.dayNum,
                        total: phaseTotalDays,
                      })}
                    </span>
                    <span className="text-xs tabular text-on-surface-dim">
                      {formatMoney(model.fts.totalSpentCents, currency)} / {formatMoney(model.fts.totalBudgetCents, currency)}
                    </span>
                  </div>
                  {/* C04/DEC-304: reconcile with the Planner's red — real spend
                      ok, only the plan (future allocation) is over. */}
                  {planOverButRealOk && (
                    <p className="text-[11px] leading-snug mt-2.5 text-on-surface-dim">
                      {t('copilot.verdict_plan_note')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1b · YESTERDAY — daily recap, moved from the home (U5 / DEC-180).
              C21: a saving day opens the cofrinho (where that money went), an
              over day opens the list (to review the spend). */}
          {model.recap && (
            <RecapCard recap={model.recap} currency={currency} onOpen={openRecap} />
          )}

          {/* 3 · AMIGO SINCERO — shared component, with the simulate action */}
          {model.amigoV2.kind !== 'none' && (
            <AmigoSinceroCard
              amigo={model.amigoV2}
              // D06 · DEC-317: voice only. The Copiloto already surfaces every
              // factual read through its dedicated sections (piggy section,
              // category bars, projection/trend/runway, debts), so the friend's
              // card carries no objective data — only the opinionated verdict.
              extras={[]}
              currency={currency}
              onSeeImpact={() => navigate('/impact')}
              onSimulate={() => navigate('/simulator')}
              onRescue={() => navigate('/rescue')}
            />
          )}

          {/* 3b · HOME-CURRENCY ANCHOR — the whole trip in one number (B10) */}
          {homeTotal && (
            <>
              <SectionLabel>{t('copilot.anchor_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex items-center gap-3.5" style={{ background: 'var(--surface-container)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon name="account_balance" size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-extrabold tabular text-on-surface leading-none">
                    {formatMoney(homeTotal.totalCents, currency)}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-1">
                    {t('copilot.anchor_desc', { count: homeTotal.expenseCount, currency })}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 2d · DISCIPLINE STREAK — days in a row within the daily target (B10) */}
          {disciplineStreak && (
            <>
              <SectionLabel>{t('copilot.streak_title')}</SectionLabel>
              <div
                className="p-4 rounded-2xl flex items-center gap-3.5"
                style={{ background: 'var(--surface-container)' }}
              >
                {/* C22/DEC-299 tone: the fire (a reward) shows ONLY while the
                    last active day was within target (currentStreak ≥ 1). A
                    broken streak is a neutral "start over", never a medal in a
                    negative message. */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={disciplineStreak.currentStreak >= 1 ? 'local_fire_department' : 'restart_alt'}
                    size={18}
                    style={{ color: disciplineStreak.currentStreak >= 1 ? 'var(--success)' : 'var(--on-surface-faint)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {disciplineStreak.currentStreak >= 1
                      ? t('copilot.streak_current', { days: disciplineStreak.currentStreak })
                      : t('copilot.streak_broken')}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {t('copilot.streak_desc', {
                      best: disciplineStreak.longestStreak,
                      target: formatMoney(disciplineStreak.dailyTargetCents, currency),
                    })}
                  </p>
                </div>
              </div>
            </>
          )}
        </ThemeGroup>
      )}

      {/* ── PARA ONDE VAI — trajectory (projection · trend · runway · pace ·
          vs the previous phase) ── */}
      {headingCount > 0 && (
        <ThemeGroup
          title={t('copilot.group_heading')}
          icon="trending_up"
          count={headingCount}
          open={isGroupOpen('heading')}
          onToggle={() => toggleGroup('heading')}
        >
          {/* 2 · WHERE IT'S HEADING — projection + reserve */}
          {projection && (
            <>
              <SectionLabel>{t('copilot.where_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex items-center gap-3.5" style={{ background: 'var(--surface-container)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={projection.values.over ? 'trending_up' : 'trending_down'}
                    size={18}
                    style={{ color: projection.values.over ? 'var(--warning)' : 'var(--success)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {t('copilot.where_projection', {
                      amount: formatMoney(Number(projection.values.projectedCents), currency),
                    })}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {projection.values.over
                      ? t('copilot.where_over', { amount: formatMoney(Number(projection.values.diffCents), currency) })
                      : t('copilot.where_under', { amount: formatMoney(Number(projection.values.diffCents), currency) })}
                  </p>
                  <ReadingLine reading={readProjection(Boolean(projection.values.over))} />
                </div>
              </div>
            </>
          )}

          {/* 2b · COURSE CORRECTION — trend of the projected close (DEC-181) */}
          {forecastTrend && (
            <>
              <SectionLabel>{t('copilot.trend_title')}</SectionLabel>
              <div
                className="p-4 rounded-2xl flex items-center gap-3.5"
                style={{ background: 'var(--surface-container)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={forecastTrend.direction === 'improving' ? 'trending_down' : 'trending_up'}
                    size={18}
                    style={{ color: forecastTrend.direction === 'improving' ? 'var(--success)' : 'var(--warning)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {t(`copilot.trend_${forecastTrend.direction}`)}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {t(`copilot.trend_${forecastTrend.direction}_desc`, {
                      days: forecastTrend.daysSpan,
                      from: formatMoney(forecastTrend.firstProjectedCents, currency),
                      to: formatMoney(forecastTrend.latestProjectedCents, currency),
                      delta: formatMoney(Math.abs(forecastTrend.deltaCents), currency),
                    })}
                  </p>
                  <ReadingLine reading={readForecastTrend(forecastTrend.direction)} />
                </div>
              </div>
            </>
          )}

          {/* 2c · RUNWAY — how long the free-to-spend lasts (DEC-182) */}
          {runway && (
            <>
              <SectionLabel>{t('copilot.runway_title')}</SectionLabel>
              <div
                className="p-4 rounded-2xl flex items-center gap-3.5"
                style={{ background: 'var(--surface-container)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={runway.coversRemaining ? 'check_circle' : 'schedule'}
                    size={18}
                    style={{ color: runway.coversRemaining ? 'var(--success)' : 'var(--warning)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {runway.coversRemaining
                      ? t('copilot.runway_covers')
                      : t('copilot.runway_until', { days: runway.days })}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {runway.coversRemaining
                      ? t('copilot.runway_covers_desc', { days: runway.days })
                      : t('copilot.runway_until_desc', {
                          date: formatDate(addDaysIso(model.todayIso, runway.days), "d 'de' MMMM"),
                        })}
                  </p>
                  <ReadingLine reading={readRunway(runway.coversRemaining)} />
                </div>
              </div>
            </>
          )}

          {/* 6 · PHASE PACE — burn-down (reused, titles itself "Ritmo da fase") */}
          {model.burndown && (
            <BurndownCard burndown={model.burndown} currency={currency} onOpen={() => navigate('/impact')} />
          )}

          {/* 7 · COMPARED TO THE PREVIOUS PHASE */}
          {phaseComparison && (
            <>
              <SectionLabel>{t('copilot.compare_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex items-center gap-3.5" style={{ background: 'var(--surface-container)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={phaseComparison.deltaPercent <= 0 ? 'trending_down' : 'trending_up'}
                    size={18}
                    style={{ color: phaseComparison.deltaPercent <= 0 ? 'var(--success)' : 'var(--warning)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {phaseComparison.deltaPercent === 0
                      ? t('copilot.compare_same', { phase: phaseComparison.previousName })
                      : phaseComparison.deltaPercent < 0
                        ? t('copilot.compare_slower', {
                            percent: Math.abs(phaseComparison.deltaPercent),
                            phase: phaseComparison.previousName,
                          })
                        : t('copilot.compare_faster', {
                            percent: phaseComparison.deltaPercent,
                            phase: phaseComparison.previousName,
                          })}
                  </p>
                  <ReadingLine reading={readPhasePace(phaseComparison.deltaPercent)} />
                </div>
              </div>
            </>
          )}
        </ThemeGroup>
      )}

      {/* ── PADRÕES — where it came from + the month map + behavioral patterns ── */}
      {patternsCount > 0 && (
        <ThemeGroup
          title={t('copilot.group_patterns')}
          icon="insights"
          count={patternsCount}
          open={isGroupOpen('patterns')}
          onToggle={() => toggleGroup('patterns')}
        >
          {/* 4 · WHERE IT CAME FROM — category bars */}
          {categories.length > 0 && (
            <>
              <SectionLabel>{t('copilot.from_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: 'var(--surface-container)' }}>
                {categories.slice(0, 6).map((c) => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-dim w-[78px] shrink-0 truncate">
                      {t(`categories.${c.category}` as never)}
                    </span>
                    <span className="flex-1 h-[18px] rounded-md overflow-hidden bg-surface-high">
                      <span
                        className="block h-full rounded-md"
                        style={{
                          width: `${maxCategoryCents > 0 ? Math.max(6, Math.round((c.cents / maxCategoryCents) * 100)) : 0}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </span>
                    <span className="text-xs font-bold tabular w-[58px] text-right text-on-surface">
                      {formatMoney(c.cents, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 5 · MONTH MAP — heatmap (reused, titles itself) + biggest day / avg. */}
          {hasMap && (
            <div className="mt-3">
              <HeatmapCard
                heatmap={model.heatmap}
                currency={currency}
                todayIso={model.todayIso}
                canPrev={heatmapMonth > model.tripStartMonth}
                canNext={heatmapMonth < model.currentMonth}
                onPrev={() => setHeatmapMonth((m) => shiftMonth(m, -1))}
                onNext={() => setHeatmapMonth((m) => shiftMonth(m, 1))}
                onSelectDay={(iso) => setHeatmapDayIso(iso)}
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-3 rounded-xl" style={{ background: 'var(--surface-container)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint">{t('copilot.map_max')}</p>
                  <p className="text-base font-extrabold tabular text-on-surface mt-0.5">
                    {formatMoney(dailySummary.maxDayCents, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--surface-container)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint">{t('copilot.map_avg')}</p>
                  <p className="text-base font-extrabold tabular text-on-surface mt-0.5">
                    {formatMoney(dailySummary.avgPerActiveDayCents, currency)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5b · WEEKDAY PATTERN — weekend vs weekday day (DEC-183) */}
          {weekday && (
            <>
              <SectionLabel>{t('copilot.weekday_title')}</SectionLabel>
              <div className="p-4 rounded-2xl" style={{ background: 'var(--surface-container)' }}>
                <p className="text-sm font-bold text-on-surface">
                  {weekday.weekendIsPricier
                    ? t('copilot.weekday_pricier', { ratio: weekday.ratio })
                    : t('copilot.weekday_calmer', { ratio: weekday.ratio })}
                </p>
                <p className="text-xs text-on-surface-faint mt-1">
                  {t('copilot.weekday_desc', {
                    weekend: formatMoney(weekday.weekendAvgCents, currency),
                    weekday: formatMoney(weekday.weekdayAvgCents, currency),
                  })}
                </p>
                <ReadingLine reading={NEUTRAL_READING} />
              </div>
            </>
          )}

          {/* 5c · PEAK HOUR — the local hour the money leaves (B10) */}
          {peakHour && (
            <>
              <SectionLabel>{t('copilot.peak_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex items-center gap-3.5" style={{ background: 'var(--surface-container)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon name="schedule" size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {t('copilot.peak_hour', { hour: peakHour.hour })}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {t('copilot.peak_desc', {
                      amount: formatMoney(peakHour.hourCents, currency),
                      percent: peakHour.sharePercent,
                    })}
                  </p>
                  <ReadingLine reading={NEUTRAL_READING} />
                </div>
              </div>
            </>
          )}

          {/* 7b · OUTING EFFICIENCY — beat-target rate + avg saving (DEC-184) */}
          {outingEfficiency && (
            <>
              <SectionLabel>{t('copilot.outings_title')}</SectionLabel>
              <div className="p-4 rounded-2xl flex items-center gap-3.5" style={{ background: 'var(--surface-container)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-high">
                  <Icon
                    name={outingEfficiency.avgSavingCents >= 0 ? 'savings' : 'local_bar'}
                    size={18}
                    style={{ color: outingEfficiency.avgSavingCents >= 0 ? 'var(--success)' : 'var(--warning)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">
                    {t('copilot.outings_summary', {
                      within: outingEfficiency.withinTarget,
                      total: outingEfficiency.total,
                    })}
                  </p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {outingEfficiency.avgSavingCents >= 0
                      ? t('copilot.outings_saving', {
                          amount: formatMoney(outingEfficiency.avgSavingCents, currency),
                        })
                      : t('copilot.outings_over', {
                          amount: formatMoney(Math.abs(outingEfficiency.avgSavingCents), currency),
                        })}
                  </p>
                  <ReadingLine reading={readOutingEfficiency(outingEfficiency.avgSavingCents)} />
                </div>
              </div>
            </>
          )}
        </ThemeGroup>
      )}

      {/* ── PESSOAS — social split · payment mix · settlements ── */}
      {peopleCount > 0 && (
        <ThemeGroup
          title={t('copilot.group_people')}
          icon="group"
          count={peopleCount}
          open={isGroupOpen('people')}
          onToggle={() => toggleGroup('people')}
        >
          {/* 8 · SOCIAL vs SOLO */}
          {social.sharedCents > 0 && (
            <>
              <SectionLabel>{t('copilot.social_title')}</SectionLabel>
              <div className="p-4 rounded-2xl" style={{ background: 'var(--surface-container)' }}>
                <p className="text-sm font-bold text-on-surface">
                  {t('copilot.social_shared', { percent: social.sharedPercent })}
                </p>
                <p className="text-xs text-on-surface-faint mt-1">
                  {t('copilot.social_desc', {
                    shared: formatMoney(social.sharedCents, currency),
                    solo: formatMoney(social.soloCents, currency),
                  })}
                </p>
                <div><ReadingLine reading={NEUTRAL_READING} /></div>
                <span className="block mt-3 h-2 rounded-full overflow-hidden bg-surface-high">
                  <span className="block h-full rounded-full" style={{ width: `${social.sharedPercent}%`, background: 'var(--primary)' }} />
                </span>
              </div>
            </>
          )}

          {/* 8b · PAYMENT MIX — cash vs card reliability (B10) */}
          {paymentMix && (
            <>
              <SectionLabel>{t('copilot.method_title')}</SectionLabel>
              <div className="p-4 rounded-2xl" style={{ background: 'var(--surface-container)' }}>
                <p className="text-sm font-bold text-on-surface">
                  {t('copilot.method_cash', { percent: paymentMix.cashPercent })}
                </p>
                <p className="text-xs text-on-surface-faint mt-1">
                  {t('copilot.method_desc', {
                    cash: formatMoney(paymentMix.cashCents, currency),
                    card: formatMoney(paymentMix.cardCents, currency),
                  })}
                  {paymentMix.untrackedCents > 0
                    ? ` · ${t('copilot.method_untracked', { amount: formatMoney(paymentMix.untrackedCents, currency) })}`
                    : ''}
                </p>
                <div><ReadingLine reading={NEUTRAL_READING} /></div>
                <span className="block mt-3 h-2 rounded-full overflow-hidden bg-surface-high">
                  <span className="block h-full rounded-full" style={{ width: `${paymentMix.cashPercent}%`, background: 'var(--warning)' }} />
                </span>
              </div>
            </>
          )}

          {/* 9 · SETTLEMENTS (debts involving the owner) */}
          {debts.length > 0 && model.owner && (
            <>
              <SectionLabel>{t('copilot.debts_title')}</SectionLabel>
              <button
                onClick={() => navigate('/shared')}
                className="w-full p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
                style={{ background: 'var(--surface-container)' }}
              >
                <Icon name="group" className="text-warning shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {debts[0]!.creditorId === model.owner.id
                      ? t('copilot.debts_owed_to_me', {
                          name: debts[0]!.debtorName,
                          amount: formatMoney(debts[0]!.amountCents, currency),
                        })
                      : t('copilot.debts_i_owe', {
                          name: debts[0]!.creditorName,
                          amount: formatMoney(debts[0]!.amountCents, currency),
                        })}
                  </p>
                  {debts.length > 1 && (
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {t('copilot.debts_more', { count: debts.length - 1 })}
                    </p>
                  )}
                </div>
                <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
              </button>
            </>
          )}
        </ThemeGroup>
      )}

      {/* 10 · TOOLS — always available (council rodapé). U3: a 2-column grid of
          cards (icon + label + description) instead of a long list. */}
      <SectionLabel>{t('copilot.tools')}</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => (
          <button
            key={tool.path}
            onClick={() => navigate(tool.path)}
            className="bg-surface-container rounded-xl p-3.5 btn-press text-left flex flex-col gap-2 h-full"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
              <Icon name={tool.icon} size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{tool.label}</p>
              <p className="text-[11px] text-on-surface-faint mt-0.5 leading-snug">{tool.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* U4: month-map day drill-down — the expenses of the tapped day */}
      <BottomSheet
        open={heatmapDayIso !== null}
        onClose={() => setHeatmapDayIso(null)}
        title={heatmapDayIso ? formatDate(heatmapDayIso, "d 'de' MMMM") : ''}
      >
        <div className="flex flex-col gap-2">
          {model.heatmapDayTxs.map((tx) => (
            <button
              key={tx.id}
              onClick={() => {
                setHeatmapDayIso(null);
                navigate(`/expenses/${tx.id}`);
              }}
              className="w-full p-3 rounded-xl bg-surface-high flex items-center gap-3 text-left btn-press"
            >
              <Icon name={getCategoryIcon(tx.category)} size={18} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{tx.description}</p>
                <p className="text-xs text-on-surface-faint mt-0.5">
                  {tx.category ? t(`categories.${tx.category}` as never) : '—'}
                </p>
              </div>
              <p className="text-sm font-extrabold tabular text-on-surface">
                {formatMoney(tx.personalCostCents ?? tx.amountCents, currency)}
              </p>
            </button>
          ))}
          {model.heatmapDayTxs.length === 0 ? (
            <p className="text-sm text-on-surface-dim text-center py-4">{t('copilot.map_day_empty')}</p>
          ) : (
            <div className="flex justify-between items-center px-1 pt-2">
              <p className="text-xs font-bold uppercase text-on-surface-faint">{t('common.total')}</p>
              <p className="text-sm font-extrabold tabular text-on-surface">
                {formatMoney(
                  sumCents(model.heatmapDayTxs.map((tx) => tx.personalCostCents ?? tx.amountCents)),
                  currency,
                )}
              </p>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* C09/DEC-300: the cofrinho statement — same sheet the dashboard uses, so
          the buffer reads identically in both places (C14 invariant). */}
      <PiggyStatementSheet
        open={piggyOpen}
        onClose={() => setPiggyOpen(false)}
        ledger={model.piggyLedger}
        currency={currency}
      />
    </div>
  );
}
