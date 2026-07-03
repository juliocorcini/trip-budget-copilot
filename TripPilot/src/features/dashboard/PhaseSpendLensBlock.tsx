import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/domain/money';
import type { PhaseSpendLens, PhaseSpendLensLineKey } from '@/domain/budget';

/**
 * DEC-447 (G3 m2): "de onde vêm esses números" — the PhaseSpendLens rendered
 * as arithmetic the user can check line by line. Mounted under the
 * phase-projection insight detail and on the Impact page, the two surfaces
 * that show the derived "orçamento disponível calculado". Mirrors the hero
 * breakdown's visual grammar (DEC-168) so the app explains money one way.
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
  attributed_spent: 'dashboard.lens_attributed_spent',
  free_now: 'dashboard.lens_free_now',
};

export function PhaseSpendLensBlock({
  lens,
  currency,
}: {
  lens: PhaseSpendLens;
  currency: string;
}) {
  const { t } = useTranslation();

  return (
    <div data-phase-spend-lens className="mt-4 p-3 rounded-xl bg-surface-container">
      <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
        {t('dashboard.lens_title')}
      </p>
      <div className="flex flex-col gap-0.5 mt-2">
        {lens.lines.map((line) => {
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
      <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
        {t('dashboard.lens_explainer')}
      </p>
    </div>
  );
}
