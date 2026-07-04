import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/domain/money';
import type { PhaseSpendLens, PhaseSpendLensLineKey } from '@/domain/budget';

/**
 * DEC-447 (G3 m2): "de onde vêm esses números" — the PhaseSpendLens rendered
 * as arithmetic the user can check line by line. Mounted under the
 * phase-projection insight detail and on the Impact page, the two surfaces
 * that show the derived "orçamento disponível calculado". Mirrors the hero
 * breakdown's visual grammar (DEC-168) so the app explains money one way.
 *
 * DEC-456: other-pool money (global pots etc.) renders in a SEPARATE
 * informative section below the sums — named per fund, never counted.
 */

const LENS_LABEL_KEYS: Record<PhaseSpendLensLineKey, string> = {
  configured_budget: 'dashboard.lens_configured_budget',
  income: 'dashboard.lens_income',
  protected_reserve: 'dashboard.lens_protected',
  future_floor: 'dashboard.lens_future_floor',
  event_reserves: 'dashboard.lens_event_reserves',
  planned_purchases: 'dashboard.lens_planned_purchases',
  paid_other_phases: 'dashboard.lens_paid_other_phases',
  other_pools: 'dashboard.lens_other_pools',
  calculated_envelope: 'dashboard.lens_calculated_envelope',
  phase_pool_spent: 'dashboard.lens_phase_pool_spent',
  free_now: 'dashboard.lens_free_now',
};

export function PhaseSpendLensBlock({
  lens,
  currency,
  poolNameById,
}: {
  lens: PhaseSpendLens;
  currency: string;
  /** DEC-453: names for the `other_pools` per-fund sub-lines ("de qual verba?"). */
  poolNameById?: Map<string, string>;
}) {
  const { t } = useTranslation();

  const arithmeticLines = lens.lines.filter((line) => line.kind !== 'info');
  const hasInfoSection = lens.lines.some((line) => line.kind === 'info');

  return (
    <div data-phase-spend-lens className="mt-4 p-3 rounded-xl bg-surface-container">
      <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
        {t('dashboard.lens_title')}
      </p>
      <div className="flex flex-col gap-0.5 mt-2">
        {arithmeticLines.map((line) => {
          const label = t(LENS_LABEL_KEYS[line.key] as never);
          if (line.kind === 'total') {
            const negative = line.cents < 0;
            return (
              <div
                key={line.key}
                className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t"
                style={{ borderColor: 'var(--border-faint)' }}
              >
                <span className="text-xs font-bold text-on-surface">{label}</span>
                <span
                  className={`text-sm font-extrabold tabular shrink-0 ${
                    line.key === 'free_now' ? (negative ? 'text-warning' : 'text-success') : 'text-on-surface'
                  }`}
                >
                  {formatMoney(line.cents, currency)}
                </span>
              </div>
            );
          }
          const isSubtract = line.kind === 'subtract';
          const isAdd = line.kind === 'add';
          return (
            <div key={line.key} className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="text-xs font-semibold text-on-surface-dim">{label}</span>
              <span
                className={`text-xs font-bold tabular shrink-0 ${
                  isSubtract ? 'text-on-surface-faint' : isAdd ? 'text-success' : 'text-on-surface'
                }`}
              >
                {isSubtract ? '− ' : isAdd ? '+ ' : ''}
                {formatMoney(line.cents, currency)}
              </span>
            </div>
          );
        })}
      </div>
      {/* DEC-456: money attributed to the phase but paid from OTHER funds (global
          pots like Tomorrowland). Informative ONLY — named per fund, outside the
          arithmetic above, so a pot can never inflate the phase budget again. */}
      {hasInfoSection && (
        <div
          data-lens-info-section
          className="mt-3 pt-2 border-t border-dashed"
          style={{ borderColor: 'var(--border-faint)' }}
        >
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
            {t('dashboard.lens_outside_title')}
          </p>
          <div className="flex items-baseline justify-between gap-3 mt-1.5">
            <span className="text-xs font-semibold text-on-surface-dim">
              {t('dashboard.lens_other_pools')}
            </span>
            <span className="text-xs font-bold tabular shrink-0 text-on-surface-dim">
              {formatMoney(lens.otherPoolsCents, currency)}
            </span>
          </div>
          {lens.otherPoolsByPool.map((source) => (
            <div
              key={source.poolId ?? 'none'}
              data-lens-other-pool={source.poolId ?? 'none'}
              className="flex items-baseline justify-between gap-3 pl-3"
            >
              <span className="text-[11px] text-on-surface-faint truncate">
                {(source.poolId ? poolNameById?.get(source.poolId) : null) ??
                  t('dashboard.lens_pool_unknown')}
              </span>
              <span className="text-[11px] font-semibold tabular shrink-0 text-on-surface-faint">
                {formatMoney(source.cents, currency)}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-on-surface-faint mt-1.5 leading-relaxed">
            {t('dashboard.lens_outside_note')}
          </p>
        </div>
      )}
      <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
        {t('dashboard.lens_explainer')}
      </p>
    </div>
  );
}
