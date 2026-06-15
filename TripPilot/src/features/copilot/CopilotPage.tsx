import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useDashboardModel } from '@/features/dashboard/useDashboardModel';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { Icon } from '@/components/Icon';
import { BurndownCard } from '@/features/dashboard/cards/BurndownCard';
import { HeatmapCard } from '@/features/dashboard/cards/HeatmapCard';
import { AmigoSinceroCard } from '@/features/dashboard/cards/AmigoSinceroCard';
import { formatMoney } from '@/domain/money';
import { sortPhasesByOrder, getTotalDays, localDateString, addDaysIso, formatDate } from '@/domain/dates';
import { shiftMonth } from '@/domain/dashboard';
import { calculatePoolSpent } from '@/domain/budget';
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
  type CopilotVerdictStatus,
} from '@/domain/copilot';

/** Section heading — mirrors the faint uppercase label used across the app. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mt-5 mb-2 px-1">
      {children}
    </p>
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
  const { trip, transactions, participants, loading, error, settings, retry } = appData;

  const [heatmapMonth, setHeatmapMonth] = useState(() => localDateString(new Date()).slice(0, 7));
  const model = useDashboardModel(appData, heatmapMonth, null);

  const verdict = useMemo(() => buildCopilotVerdict(model.burndown), [model.burndown]);
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
  const hasAnySignal = verdict !== null || categories.length > 0 || hasMap;

  const tools: ToolItem[] = [
    { icon: 'analytics', label: t('copilot.impact'), desc: t('copilot.impact_desc'), path: '/impact' },
    { icon: 'calculate', label: t('copilot.simulate'), desc: t('copilot.simulate_desc'), path: '/simulator' },
    { icon: 'sos', label: t('copilot.rescue'), desc: t('copilot.rescue_desc'), path: '/rescue' },
    { icon: 'auto_awesome', label: t('copilot.guide'), desc: t('copilot.guide_desc'), path: '/guide' },
  ];

  return (
    <div className="flex flex-col pb-6 pt-2">
      <div className="px-1">
        <h1 className="text-heading font-bold text-on-surface">{t('copilot.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-0.5">{t('copilot.subtitle')}</p>
      </div>

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
            </div>
          </div>
        </div>
      )}

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
            </div>
          </div>
        </>
      )}

      {/* 3 · AMIGO SINCERO — shared component, with the simulate action */}
      {model.amigoV2.kind !== 'none' && (
        <AmigoSinceroCard
          amigo={model.amigoV2}
          currency={currency}
          onSeeImpact={() => navigate('/impact')}
          onSimulate={() => navigate('/simulator')}
        />
      )}

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

      {/* 5 · MONTH MAP — heatmap (reused, titles itself) + biggest day / avg
          as a footer so the section title is not duplicated. */}
      {hasMap && (
        <div className="mt-1">
          <HeatmapCard
            heatmap={model.heatmap}
            currency={currency}
            todayIso={model.todayIso}
            canPrev={heatmapMonth > model.tripStartMonth}
            canNext={heatmapMonth < model.currentMonth}
            onPrev={() => setHeatmapMonth((m) => shiftMonth(m, -1))}
            onNext={() => setHeatmapMonth((m) => shiftMonth(m, 1))}
            onSelectDay={() => navigate('/expenses')}
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
            <p className="text-sm font-semibold text-on-surface flex-1">
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
            </div>
          </div>
        </>
      )}

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
            <span className="block mt-3 h-2 rounded-full overflow-hidden bg-surface-high">
              <span className="block h-full rounded-full" style={{ width: `${social.sharedPercent}%`, background: 'var(--primary)' }} />
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

      {/* 10 · TOOLS — always available (council rodapé) */}
      <SectionLabel>{t('copilot.tools')}</SectionLabel>
      <div className="bg-surface-container rounded-xl overflow-hidden">
        {tools.map((tool, i) => (
          <button
            key={tool.path}
            onClick={() => navigate(tool.path)}
            className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
              i < tools.length - 1 ? 'border-b border-on-surface-mute' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
              <Icon name={tool.icon} size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{tool.label}</p>
              <p className="text-[11px] text-on-surface-faint mt-0.5">{tool.desc}</p>
            </div>
            <Icon name="chevron_right" size={18} className="text-on-surface-faint ml-auto shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
