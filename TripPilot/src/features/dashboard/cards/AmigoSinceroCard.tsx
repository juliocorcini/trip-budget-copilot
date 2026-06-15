import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { HonestFriendV2 } from '@/domain/budget';

interface AmigoSinceroCardProps {
  amigo: HonestFriendV2;
  /** Base currency, to format the phase-slack reconciliation (G6). */
  currency: string;
  /** Opens the full impact breakdown. */
  onSeeImpact: () => void;
  /** Copiloto adds a "simulate a spend" action next to "see impact". */
  onSimulate?: () => void;
  /** Top margin — Home keeps the default; flex-gap layouts pass "". */
  marginClass?: string;
}

/**
 * DEC-093 (R-11): the plan-based "honest friend". Extracted so the Dashboard
 * and the Copiloto render the exact same card from one source — the copy is
 * reconciled in a single place (G6).
 */
export function AmigoSinceroCard({
  amigo,
  currency,
  onSeeImpact,
  onSimulate,
  marginClass = 'mt-5',
}: AmigoSinceroCardProps) {
  const { t } = useTranslation();
  if (amigo.kind === 'none') return null;

  // G6: when over the category pace but the phase still covers the overflow, the
  // honest move is to reconcile both — "your bar plan is tight, but the phase has
  // room: do it guilt-free, or hold N to stay on plan". Otherwise the reserve-date
  // warning still applies (the tight case).
  const showPhaseSlack = amigo.kind === 'over_pace' && amigo.overflowFitsPhase;
  const showReserveDate =
    (amigo.kind === 'over_pace' || amigo.kind === 'over_plan') &&
    amigo.reserveStartDate !== null &&
    !showPhaseSlack;

  return (
    <div
      className={`${marginClass} p-4 rounded-2xl`}
      style={{ background: '#C75B3910', border: '1px solid #C75B3918' }}
    >
      <div className="flex items-start gap-3">
        <Icon name="chat_bubble" className="text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-bold text-primary">{t('dashboard.amigo_sincero')}</p>
          <p className="text-[13px] mt-1.5 leading-snug font-semibold text-on-surface">
            {amigo.kind === 'over_pace' &&
              t('dashboard.amigo_over_pace', {
                planned: amigo.plannedQuantity,
                type: amigo.profileName.toLowerCase(),
                fit: amigo.fitCount,
                remaining: amigo.remainingPlanned,
              })}
            {amigo.kind === 'on_plan' &&
              t('dashboard.amigo_on_plan', {
                type: amigo.profileName.toLowerCase(),
                done: amigo.doneQuantity,
                planned: amigo.plannedQuantity,
              })}
            {amigo.kind === 'over_plan' &&
              t('dashboard.amigo_over_plan', {
                type: amigo.profileName.toLowerCase(),
                done: amigo.doneQuantity,
                planned: amigo.plannedQuantity,
              })}
            {amigo.kind === 'no_plan' &&
              t('dashboard.amigo_no_plan', {
                type: amigo.profileName.toLowerCase(),
                percent: amigo.impactPercent,
              })}
          </p>
          {showPhaseSlack && amigo.kind === 'over_pace' && (
            <p className="text-xs font-semibold mt-2 flex items-start gap-1.5 text-on-surface-dim">
              <Icon name="check_circle" size={14} className="text-success mt-0.5 flex-shrink-0" filled />
              <span>
                {t('dashboard.amigo_over_pace_slack', {
                  free: formatMoney(amigo.phaseFreeCents, currency),
                  type: amigo.profileName.toLowerCase(),
                  hold: amigo.overflowCount,
                })}
              </span>
            </p>
          )}
          {showReserveDate && amigo.reserveStartDate && (
            <p className="text-xs font-bold text-warning mt-2">
              {t('dashboard.amigo_reserve_date', {
                date: formatDate(amigo.reserveStartDate, "d 'de' MMMM"),
              })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            {onSimulate && (
              <button
                onClick={onSimulate}
                className="btn-press px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {t('copilot.amigo_simulate')}
              </button>
            )}
            <button
              onClick={onSeeImpact}
              className="btn-press px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: '#C75B3918', color: 'var(--primary)' }}
            >
              {t('dashboard.amigo_see_impact')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
