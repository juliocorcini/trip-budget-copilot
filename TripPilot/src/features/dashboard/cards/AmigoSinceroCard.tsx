import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import {
  getHonestFriendTone,
  type HonestFriendExtra,
  type HonestFriendTone,
  type HonestFriendV2,
} from '@/domain/budget';

interface AmigoSinceroCardProps {
  amigo: HonestFriendV2;
  /**
   * DEC-093 follow-up (device-test 2026-06-20): extra honest reads that turn the
   * card into a carousel so it is never "stuck" on a single verdict. Defaults to
   * none → the card behaves exactly as the original single-verdict version.
   */
  extras?: HonestFriendExtra[];
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

/** Carousel rotation cadence — slow enough to read, only while untouched. */
const AUTO_ADVANCE_MS = 9000;

const EXTRA_ICON: Record<HonestFriendExtra['id'], string> = {
  phase_progress: 'data_usage',
  daily_left: 'calendar_today',
  top_category: 'leaderboard',
  receivable: 'call_received',
};

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
  extras = [],
  currency,
  onSeeImpact,
  onSimulate,
  onRescue,
  marginClass = 'mt-5',
  hideOnPlan = false,
}: AmigoSinceroCardProps) {
  const { t } = useTranslation();

  // F21: on the Home, the reassuring "you're on plan" read is just noise — keep
  // the verdict off the carousel there (but its extras can still stand on their own).
  const verdictShown =
    amigo.kind !== 'none' && !(hideOnPlan && amigo.kind === 'on_plan');

  // The carousel = the verdict (slide 0, when shown) followed by each extra.
  const slides: ({ kind: 'verdict' } | { kind: 'extra'; extra: HonestFriendExtra })[] = [
    ...(verdictShown ? [{ kind: 'verdict' as const }] : []),
    ...extras.map((extra) => ({ kind: 'extra' as const, extra })),
  ];
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  // Gentle auto-advance so the user discovers there's more — stops for good once
  // they take control, so it never fights a manual read. Single-slide → no timer.
  useEffect(() => {
    if (count <= 1 || userInteracted) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [count, userInteracted]);

  if (count === 0) return null;

  const current = slides[safeIndex]!;
  const verdictTone = getHonestFriendTone(amigo);
  const tone: HonestFriendTone = current.kind === 'verdict' ? verdictTone : current.extra.tone;
  const style = TONE_STYLE[tone];

  const goTo = (i: number) => {
    setIndex(i);
    setUserInteracted(true);
  };

  const slideIcon = current.kind === 'verdict' ? style.icon : EXTRA_ICON[current.extra.id];

  return (
    <div
      className={`${marginClass} p-3.5 rounded-2xl`}
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <div className="flex items-start gap-2.5">
        <Icon name={slideIcon} size={18} className="mt-0.5 shrink-0" style={{ color: style.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold" style={{ color: style.color }}>
              {t('dashboard.amigo_sincero')}
            </p>
            {count > 1 && (
              <div className="flex items-center gap-1.5 shrink-0" role="tablist" aria-label={t('dashboard.amigo_sincero')}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`${i + 1}/${count}`}
                    aria-selected={i === safeIndex}
                    role="tab"
                    className="btn-press rounded-full transition-all"
                    style={{
                      width: i === safeIndex ? 16 : 6,
                      height: 6,
                      background: i === safeIndex ? style.color : 'var(--border-subtle)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {current.kind === 'verdict'
            ? renderVerdict(amigo, style.color, currency, t)
            : renderExtra(current.extra, currency, t)}

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {/* G12: the reserve is at risk — surface rescue mode right here. The
                action set follows the VERDICT (not the current slide) so it stays
                reachable while browsing the extras. */}
            {onRescue && verdictShown && verdictTone === 'alert' && (
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
                  onRescue && verdictTone === 'alert'
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

type Translate = ReturnType<typeof useTranslation>['t'];

/** The rich, kind-specific verdict body (DEC-236) — unchanged from the original. */
function renderVerdict(amigo: HonestFriendV2, color: string, currency: string, t: Translate) {
  if (amigo.kind === 'none') return null;
  // G6: over the category pace but the phase still covers the overflow → reconcile
  // both truths; otherwise the reserve-date warning applies (the tight case).
  const showPhaseSlack = amigo.kind === 'over_pace' && amigo.overflowFitsPhase;
  const showReserveDate =
    (amigo.kind === 'over_pace' || amigo.kind === 'over_plan') &&
    amigo.reserveStartDate !== null &&
    !showPhaseSlack;

  return (
    <>
      <p className="text-[13px] mt-1 leading-snug font-semibold text-on-surface">
        {/* DEC-236: phase truth first — out of free money pre-empts category reads. */}
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
        {amigo.kind === 'no_plan' && t('dashboard.amigo_no_plan', { percent: amigo.impactPercent })}
      </p>
      {amigo.kind === 'over_budget' && (
        <p className="text-xs font-bold mt-1.5" style={{ color }}>
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
        <p className="text-xs font-bold mt-1.5" style={{ color }}>
          {t('dashboard.amigo_reserve_date', {
            date: formatDate(amigo.reserveStartDate, "d 'de' MMMM"),
          })}
        </p>
      )}
    </>
  );
}

/** A single extra-insight slide (device-test 2026-06-20 carousel). */
function renderExtra(extra: HonestFriendExtra, currency: string, t: Translate) {
  const text =
    extra.id === 'phase_progress'
      ? t('dashboard.amigo_extra_phase_progress', { percent: extra.percent })
      : extra.id === 'daily_left'
        ? t('dashboard.amigo_extra_daily_left', {
            days: extra.days,
            perDay: formatMoney(extra.perDayCents, currency),
          })
        : extra.id === 'top_category'
          ? t('dashboard.amigo_extra_top_category', {
              category: t(`categories.${extra.categoryKey}` as never),
              amount: formatMoney(extra.amountCents, currency),
              percent: extra.percent,
            })
          : t('dashboard.amigo_extra_receivable', { amount: formatMoney(extra.amountCents, currency) });

  return <p className="text-[13px] mt-1 leading-snug font-semibold text-on-surface">{text}</p>;
}
