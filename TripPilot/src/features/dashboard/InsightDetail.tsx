import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/domain/money';
import type { DashboardInsight } from '@/domain/insights';
import { formatInsightText } from './dashboard-format';

/* ──────────────── DEC-091 (R-09): insight calculation detail ──────────────── */

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: 'warning' | 'success' }) {
  return (
    <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
      <span className="text-xs font-semibold text-on-surface-dim">{label}</span>
      <span
        className={`text-sm font-bold tabular ${
          accent === 'warning' ? 'text-warning' : accent === 'success' ? 'text-success' : 'text-on-surface'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function InsightDetail({ insight, currency }: { insight: DashboardInsight; currency: string }) {
  const { t } = useTranslation();
  const v = insight.values;

  if (insight.kind === 'phase_projection') {
    const over = (v.over as number) === 1;
    return (
      <div className="flex flex-col">
        <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
          {formatInsightText(insight, t, currency)}
        </p>
        <DetailRow label={t('dashboard.detail_spent_so_far')} value={formatMoney(v.spentCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_days_elapsed')} value={String(v.daysElapsed)} />
        <DetailRow label={t('dashboard.detail_daily_pace')} value={formatMoney(v.perDayCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_days_remaining')} value={String(v.daysRemaining)} />
        <DetailRow label={t('dashboard.detail_projected_total')} value={formatMoney(v.projectedCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_phase_budget')} value={formatMoney(v.budgetCents as number, currency)} />
        <DetailRow
          label={t(over ? 'dashboard.detail_over_by' : 'dashboard.detail_under_by')}
          value={formatMoney(v.diffCents as number, currency)}
          accent={over ? 'warning' : 'success'}
        />
        <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
          {t('dashboard.detail_projection_explainer')}
        </p>
      </div>
    );
  }

  if (insight.kind === 'rhythm_compare') {
    const over = (v.over as number) === 1;
    return (
      <div className="flex flex-col">
        <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
          {formatInsightText(insight, t, currency)}
        </p>
        <DetailRow
          label={t('dashboard.detail_real_daily')}
          value={formatMoney(v.realDailyCents as number, currency)}
          accent={over ? 'warning' : 'success'}
        />
        <DetailRow label={t('dashboard.detail_planned_daily')} value={formatMoney(v.plannedDailyCents as number, currency)} />
        <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
          {t('dashboard.detail_rhythm_explainer')}
        </p>
      </div>
    );
  }

  // no_spend_streak
  return (
    <div className="flex flex-col">
      <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
        {formatInsightText(insight, t, currency)}
      </p>
      <DetailRow label={t('dashboard.detail_streak_days')} value={String(v.days)} accent="success" />
      <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
        {t('dashboard.detail_streak_explainer')}
      </p>
    </div>
  );
}
