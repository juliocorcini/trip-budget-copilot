import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { getHonestFriendTone, type HonestFriendTone, type HonestFriendV2 } from '@/domain/budget';

interface AmigoSinceroCardProps {
  amigo: HonestFriendV2;
  /** Base currency, to format the phase-slack reconciliation (G6). */
  currency: string;
  /** Opens the full impact breakdown. */
  onSeeImpact: () => void;
  /** Copiloto adds a "simulate a spend" action next to "see impact". */
  onSimulate?: () => void;
  /** Audit §4.8 (G12): offered ONLY in the dire `alert` tone — a contextual
   * door to rescue mode when the phase is overflowing into its reserve. */
  onRescue?: () => void;
  /** Top margin — Home keeps the default; flex-gap layouts pass "". */
  marginClass?: string;
  /** FIELD R2 item 21 (F21): the Home hides the reassuring "on plan" state so
   * the card only appears when there is something to act on; the Copiloto keeps
   * it (that tab is where the full read lives). */
  hideOnPlan?: boolean;
}

// FIELD R2 item 21 (F21): tint + accent + icon per tone — same data-driven shape
// as the Copiloto VERDICT_STYLE, so the card is colored by meaning (green when
// on plan, amber when off pace, red when the reserve is at risk) instead of
// always reading as the orange alert accent.
const TONE_STYLE: Record<
  HonestFriendTone,
  { bg: string; border: string; color: string; icon: string }
> = {
  positive: {
    bg: 'rgba(107,143,113,.10)',
    border: 'rgba(107,143,113,.20)',
    color: 'var(--success)',
    icon: 'sentiment_satisfied',
  },
  // D-BUG-11 (D-DEC-E): calm dusty-blue — "over pace, but the phase covers it".
  steady: {
    bg: 'rgba(94,140,167,.10)',
    border: 'rgba(94,140,167,.22)',
    color: 'var(--steady)',
    icon: 'info',
  },
  caution: { bg: '#D4A84312', border: '#D4A84322', color: 'var(--warning)', icon: 'pace' },
  alert: { bg: '#D9404012', border: '#D9404026', color: 'var(--error)', icon: 'priority_high' },
  neutral: {
    bg: 'var(--surface-container)',
    border: 'var(--border-faint)',
    color: 'var(--on-surface-dim)',
    icon: 'chat_bubble',
  },
};

/**
 * DEC-093 (R-11): the plan-based "honest friend". Extracted so the Dashboard
 * and the Copiloto render the exact same card from one source — the copy is
 * reconciled in a single place (G6). FIELD R2 (F21/F6): colored by tone and
 * compacted; the Home hides the "on plan" state.
 */
export function AmigoSinceroCard({
  amigo,
  currency,
  onSeeImpact,
  onSimulate,
  onRescue,
  marginClass = 'mt-5',
  hideOnPlan = false,
}: AmigoSinceroCardProps) {
  const { t } = useTranslation();
  if (amigo.kind === 'none') return null;
  // F21: on the Home, the reassuring "you're on plan" read is just noise — show
  // the card only when there is something worth a second look.
  if (hideOnPlan && amigo.kind === 'on_plan') return null;

  const tone = getHonestFriendTone(amigo);
  const style = TONE_STYLE[tone];

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
      className={`${marginClass} p-3.5 rounded-2xl`}
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <div className="flex items-start gap-2.5">
        <Icon name={style.icon} size={18} className="mt-0.5 shrink-0" style={{ color: style.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold" style={{ color: style.color }}>
            {t('dashboard.amigo_sincero')}
          </p>
          <p className="text-[13px] mt-1 leading-snug font-semibold text-on-surface">
            {/* DEC-236: phase truth first — out of free money pre-empts every
                category read. */}
            {amigo.kind === 'over_budget' && t('dashboard.amigo_over_budget')}
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
              t('dashboard.amigo_no_plan', { percent: amigo.impactPercent })}
          </p>
          {/* DEC-236: present-tense truth, precise to the case — reserve dip,
              plan-committed remainder, or exactly at the line. Never a future date. */}
          {amigo.kind === 'over_budget' && (
            <p className="text-xs font-bold mt-1.5" style={{ color: style.color }}>
              {amigo.intoReserve
                ? t('dashboard.amigo_over_budget_reserve', {
                    amount: formatMoney(amigo.reserveUsedCents, currency),
                  })
                : amigo.planShortfallCents > 0
                  ? t('dashboard.amigo_over_budget_plan', {
                      amount: formatMoney(amigo.planShortfallCents, currency),
                    })
                  : t('dashboard.amigo_over_budget_edge')}
            </p>
          )}
          {showPhaseSlack && amigo.kind === 'over_pace' && (
            <p className="text-xs font-semibold mt-1.5 flex items-start gap-1.5 text-on-surface-dim">
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
            <p className="text-xs font-bold mt-1.5" style={{ color: style.color }}>
              {t('dashboard.amigo_reserve_date', {
                date: formatDate(amigo.reserveStartDate, "d 'de' MMMM"),
              })}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {/* G12: the reserve is at risk — surface rescue mode right here. */}
            {onRescue && tone === 'alert' && (
              <button
                onClick={onRescue}
                className="btn-press px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                style={{ background: style.color, color: '#fff' }}
              >
                <Icon name={amigo.kind === 'over_budget' ? 'restart_alt' : 'emergency'} size={14} />
                {t(
                  amigo.kind === 'over_budget'
                    ? 'dashboard.amigo_recover_cta'
                    : 'dashboard.amigo_rescue_cta',
                )}
              </button>
            )}
            {onSimulate && (
              <button
                onClick={onSimulate}
                className="btn-press px-3.5 py-1.5 rounded-lg text-xs font-bold"
                style={
                  onRescue && tone === 'alert'
                    ? { background: style.bg, color: style.color, border: `1px solid ${style.border}` }
                    : { background: style.color, color: '#fff' }
                }
              >
                {t('copilot.amigo_simulate')}
              </button>
            )}
            <button
              onClick={onSeeImpact}
              className="btn-press px-3.5 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
            >
              {t('dashboard.amigo_see_impact')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
