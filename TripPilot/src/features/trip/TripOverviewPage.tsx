import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, formatDate, sortPhasesByOrder, findActivePhase, getDayNumber, getTotalDays } from '@/domain/dates';
import { calculateTotalBudget, calculateTotalSpent, createPoolSummary } from '@/domain/budget';
import { filterTransactionsByPhase, filterTransactionsByPool } from '@/domain/transactions';
import { buildShareCardStats } from '@/domain/sharing';
import { formatMoney } from '@/domain/money';
import { renderShareCard, deliverShareCard } from '@/utils/share-card';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';

export function TripOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, transactions, loading, error, retry } = useAppData();
  const [sharing, setSharing] = useState(false);

  // BUG-004/009/014: a DB read error is NOT "no trip" — never redirect to the
  // destructive onboarding flow on error. Keep showing valid data through a
  // background reload; only branch on state when there is no trip in memory.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const sortedPhases = sortPhasesByOrder(phases);
  const activePhase = resolveActivePhase(phases);
  const totalBudget = calculateTotalBudget(pools);
  const totalSpent = calculateTotalSpent(transactions);

  // DEC-133: local PNG export through the OS share sheet (no in-app social).
  const handleShareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const stats = buildShareCardStats({
        transactions,
        pools,
        dayNumber: getDayNumber(trip.startDate),
        totalDays: getTotalDays(trip.startDate, trip.endDate),
      });
      const blob = await renderShareCard({
        tripName: trip.name,
        spentDisplay: formatMoney(stats.totalSpentCents, trip.baseCurrency),
        subtitle: t('share.of_budget', {
          budget: formatMoney(stats.totalBudgetCents, trip.baseCurrency),
          percent: stats.percentUsed,
        }),
        dayLine: t('share.day_of', { n: stats.dayNumber, total: stats.totalDays }),
        topCategoryLine: stats.topCategory
          ? t('share.top_category', {
              name: t(`categories.${stats.topCategory.category}` as never),
              amount: formatMoney(stats.topCategory.totalCents, trip.baseCurrency),
            })
          : null,
        percentUsed: stats.percentUsed,
        dayPercent: stats.dayPercent,
      });
      if (!blob) {
        showToast(t('share.failed_toast'), 'danger');
        return;
      }
      const outcome = await deliverShareCard(blob, 'trippilot-resumo.png');
      if (outcome === 'downloaded') showToast(t('share.downloaded_toast'), 'success');
      if (outcome === 'failed') showToast(t('share.failed_toast'), 'danger');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface flex-1">{t('trip.overview_title')}</h1>
        {/* DEC-133: shareable summary card */}
        <button
          onClick={handleShareCard}
          disabled={sharing}
          className="btn-press w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-50"
          style={{ background: 'var(--highlight-subtle)' }}
          aria-label={t('share.button')}
        >
          <Icon name="ios_share" size={18} className="text-primary" />
        </button>
      </div>

      <div className="bg-surface-container rounded-2xl p-5">
        <p className="text-xs font-bold text-primary uppercase tracking-wider">{trip.name}</p>
        <p className="text-sm text-on-surface-dim mt-2">
          {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
        </p>
        <div className="flex justify-between mt-4 pt-4 border-t border-on-surface-mute">
          <div>
            <p className="text-[10px] font-bold text-on-surface-faint uppercase">{t('trip.total_budget')}</p>
            <p className="text-xl font-extrabold tabular text-on-surface mt-1">
              {formatMoney(totalBudget, trip.baseCurrency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-on-surface-faint uppercase">{t('trip.total_spent')}</p>
            <p className="text-xl font-extrabold tabular text-primary mt-1">
              {formatMoney(totalSpent, trip.baseCurrency)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip.phases_timeline')}
        </p>
        <div className="flex flex-col gap-2">
          {sortedPhases.map((phase) => {
            const isActive = activePhase?.id === phase.id;
            const isCurrent = findActivePhase(phases)?.id === phase.id;
            const phaseSpent = filterTransactionsByPhase(transactions, phase.id)
              .filter((tx) => tx.type === 'expense')
              .reduce((sum, tx) => sum + tx.amountCents, 0);

            return (
              // R-26: phase cards lead to the phase editor.
              <button
                key={phase.id}
                onClick={() => navigate('/trip/edit')}
                className="bg-surface-container rounded-xl p-4 w-full text-left btn-press"
                style={isCurrent ? { border: '1px solid #C75B3925' } : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">{phase.name}</p>
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {formatDate(phase.startDate)} — {formatDate(phase.endDate)}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-primary/15 text-primary">
                      {t('trip.phase_active')}
                    </span>
                  )}
                  {!isCurrent && isActive && (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-warning/15 text-warning">
                      {t('trip.phase_nearest')}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-on-surface-dim mt-3">
                  {t('trip.phase_spent', { amount: formatMoney(phaseSpent, trip.baseCurrency) })}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip.funds')}
        </p>
        <div className="flex flex-col gap-2">
          {pools.map((pool) => {
            const summary = createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id));
            return (
              // R-26: fund cards lead to the funds screen.
              <button
                key={pool.id}
                onClick={() => navigate('/funds')}
                className="bg-surface-container rounded-xl p-4 flex justify-between items-center w-full text-left btn-press"
              >
                <div>
                  <p className="text-sm font-bold text-on-surface">{pool.name}</p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {formatMoney(summary.spentCents, pool.currency)} / {formatMoney(summary.totalCents, pool.currency)}
                  </p>
                </div>
                <p className="text-sm font-extrabold tabular text-success">
                  {formatMoney(summary.remainingCents, pool.currency)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => navigate('/trip/edit')}
        className="w-full py-3.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
      >
        {t('trip.edit_trip')}
      </button>
    </div>
  );
}
