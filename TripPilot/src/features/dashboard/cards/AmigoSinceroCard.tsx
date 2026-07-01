import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import {
  getHonestFriendTone,
  toVoiceBand,
  pickVoiceLineIndex,
  voiceLineKey,
  resolveAmigoSlideCtas,
  verdictLeadsCarousel,
  RHYTHM_EXTRA_IDS,
  DEFAULT_HONEST_FRIEND_VOICE,
  type AmigoSlideKind,
  type HonestFriendExtra,
  type HonestFriendTone,
  type HonestFriendV2,
  type HonestFriendVoice,
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
  /** FB-08 · DEC-279: deep-link from the `piggy_movement` slide to the cofrinho
   * statement (mounted in DashboardCards). Absent → no link is shown. */
  onOpenPiggyStatement?: () => void;
  /** FB-12 · DEC-264: the chosen voice flavoring the verdict's lead line. */
  voice?: HonestFriendVoice;
  /** FB-12 · DEC-264: stable seed (trip day number) for the daily phrase pick. */
  daySeed?: number;
  /** FB-12 · DEC-264: opens Settings at the voice picker. When present, a
   * discovery "reveal" slide is appended PAST the last dot — reachable only by
   * swiping to the very end, never shown by auto-rotation. */
  onOpenVoiceSettings?: () => void;
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
  piggy_movement: 'savings',
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
  onOpenPiggyStatement,
  voice = DEFAULT_HONEST_FRIEND_VOICE,
  daySeed = 0,
  onOpenVoiceSettings,
  marginClass = 'mt-5',
  hideOnPlan = false,
}: AmigoSinceroCardProps) {
  const { t } = useTranslation();

  // F21: on the Home, the reassuring "you're on plan" read is just noise — keep
  // the verdict off the carousel there (but its extras can still stand on their own).
  const verdictShown =
    amigo.kind !== 'none' && !(hideOnPlan && amigo.kind === 'on_plan');

  // The carousel = the verdict followed by each extra. Each slide is the friend
  // saying ONE honest thing; they swipe like the insights.
  // DEC-417 (G5): a plain `no_plan` verdict ("this expense took X%") yields the
  // LEAD to a rhythm read when one exists, so the friend opens with the fresher
  // daily pace and the expense-impact becomes just one rotating slide — never the
  // fixed hero Julio flagged. Every stronger verdict still leads (slide 0).
  const extraSlides = extras.map((extra) => ({ kind: 'extra' as const, extra }));
  const hasRhythmExtra = extras.some((extra) => RHYTHM_EXTRA_IDS.includes(extra.id));
  const verdictSlide = { kind: 'verdict' as const };
  const realSlides: ({ kind: 'verdict' } | { kind: 'extra'; extra: HonestFriendExtra })[] =
    !verdictShown
      ? extraSlides
      : verdictLeadsCarousel(amigo.kind, hasRhythmExtra)
        ? [verdictSlide, ...extraSlides]
        : [...extraSlides, verdictSlide];
  // FB-12 · DEC-264: a discovery slide for the voice picker, appended PAST the
  // last dot. It is reachable only by swiping to the very end and is excluded
  // from both the dots and the auto-rotation (`realCount` below), so the friend
  // never interrupts itself to advertise — exactly the "pull a bit more and it
  // tells you" behavior Julio asked for.
  const revealShown = Boolean(onOpenVoiceSettings) && realSlides.length >= 1;
  const slides: (
    | { kind: 'verdict' }
    | { kind: 'extra'; extra: HonestFriendExtra }
    | { kind: 'reveal' }
  )[] = revealShown ? [...realSlides, { kind: 'reveal' as const }] : realSlides;
  const count = slides.length;
  const realCount = realSlides.length;

  // Device-test 2026-06-20: this is a SWIPE carousel now (drag to pass between the
  // friend's reads), mirroring the dashboard insights carousel — not dot-only taps.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Auto-advance pauses for a beat after any manual interaction so the friend
  // never yanks the slide away mid-read (same pattern as the insights carousel).
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    if (realCount <= 1) return;
    const timer = window.setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      // Wrap within the REAL slides only — auto-rotation never lands on the
      // reveal slide (FB-12 · DEC-264).
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % realCount;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [realCount]);

  if (count === 0) return null;

  const safeIndex = Math.min(activeIndex, count - 1);
  const verdictTone = getHonestFriendTone(amigo);
  // F21 kept: the card is tinted by the VERDICT meaning and stays STABLE while the
  // reads swipe (no background jump mid-drag) — only each slide's own icon carries
  // its per-read accent. With no verdict (Home "on plan") the tint is calm/neutral.
  const baseTone: HonestFriendTone = verdictShown ? verdictTone : 'neutral';
  const style = TONE_STYLE[baseTone];

  const pause = () => {
    pausedUntilRef.current = Date.now() + 6000;
  };
  const goTo = (i: number) => {
    pause();
    scrollRef.current?.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  type Slide = (typeof slides)[number];
  const slideIcon = (slide: Slide): string =>
    slide.kind === 'verdict'
      ? TONE_STYLE[verdictTone].icon
      : slide.kind === 'reveal'
        ? 'record_voice_over'
        : EXTRA_ICON[slide.extra.id];
  const slideColor = (slide: Slide): string =>
    slide.kind === 'reveal'
      ? 'var(--primary)'
      : TONE_STYLE[slide.kind === 'verdict' ? verdictTone : slide.extra.tone].color;
  const renderSlideBody = (slide: Slide) =>
    slide.kind === 'verdict'
      ? renderVerdict(amigo, TONE_STYLE[verdictTone].color, currency, t, voice, daySeed)
      : slide.kind === 'reveal'
        ? renderReveal(t, onOpenVoiceSettings)
        : renderExtra(slide.extra, currency, t, onOpenPiggyStatement);

  // C07 · DEC-301: the action row follows the ACTIVE slide, not a fixed verdict
  // CTA. Slides whose own body already carries a CTA (piggy statement, voice
  // reveal) suppress the row; slides with no useful action hide it entirely.
  const activeSlide = slides[safeIndex]!;
  const activeSlideKind: AmigoSlideKind =
    activeSlide.kind === 'extra' ? activeSlide.extra.id : activeSlide.kind;
  const activeHasInlineCta =
    (activeSlide.kind === 'extra' &&
      activeSlide.extra.id === 'piggy_movement' &&
      Boolean(onOpenPiggyStatement)) ||
    (activeSlide.kind === 'reveal' && Boolean(onOpenVoiceSettings));
  const slideCtas = resolveAmigoSlideCtas({
    slideKind: activeSlideKind,
    isAlertVerdict: verdictShown && verdictTone === 'alert',
    hasInlineCta: activeHasInlineCta,
  });
  const showRescue = slideCtas.includes('rescue') && Boolean(onRescue);
  const showSimulate = slideCtas.includes('simulate') && Boolean(onSimulate);
  const showImpact = slideCtas.includes('impact');

  return (
    <div
      className={`${marginClass} p-3.5 rounded-2xl`}
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] font-bold" style={{ color: style.color }}>
          {t('dashboard.amigo_sincero')}
        </p>
        {realCount > 1 && (
          <div
            className="flex items-center gap-1.5 shrink-0"
            role="tablist"
            aria-label={t('dashboard.amigo_sincero')}
          >
            {realSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}/${realCount}`}
                aria-selected={i === safeIndex}
                role="tab"
                className="btn-press rounded-full transition-[width,transform]"
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

      {/* Swipe carousel of the friend's reads — same snap technique as the
          dashboard insights carousel (drag to pass between them). */}
      {count > 1 ? (
        <div
          ref={scrollRef}
          className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
          onPointerDown={pause}
          onWheel={pause}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth === 0) return;
            const idx = Math.round(el.scrollLeft / el.clientWidth);
            if (idx !== activeIndex) setActiveIndex(idx);
          }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full shrink-0 snap-center snap-always flex items-start gap-2.5">
              <Icon
                name={slideIcon(slide)}
                size={18}
                className="mt-0.5 shrink-0"
                style={{ color: slideColor(slide) }}
              />
              <div className="flex-1 min-w-0">{renderSlideBody(slide)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <Icon
            name={slideIcon(slides[0]!)}
            size={18}
            className="mt-0.5 shrink-0"
            style={{ color: slideColor(slides[0]!) }}
          />
          <div className="flex-1 min-w-0">{renderSlideBody(slides[0]!)}</div>
        </div>
      )}

      {/* C07 · DEC-301: per-slide action row — only the CTA(s) that explain the
          read on screen; nothing when the slide has no useful action. */}
      {(showRescue || showSimulate || showImpact) && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {showRescue && onRescue && (
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
          {showSimulate && onSimulate && (
            <button
              onClick={onSimulate}
              className="btn-press px-3.5 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: style.color, color: '#fff' }}
            >
              {t('copilot.amigo_simulate')}
            </button>
          )}
          {showImpact && (
            <button
              onClick={onSeeImpact}
              className="btn-press px-3.5 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
            >
              {t('dashboard.amigo_see_impact')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** The rich, kind-specific verdict body (DEC-236). FB-12 · DEC-264 adds a short
 *  voice-flavored lead line on top — same data, different tone. */
function renderVerdict(
  amigo: HonestFriendV2,
  color: string,
  currency: string,
  t: Translate,
  voice: HonestFriendVoice,
  daySeed: number,
) {
  if (amigo.kind === 'none') return null;
  const voiceBand = toVoiceBand(getHonestFriendTone(amigo));
  const voiceLine = t(
    `dashboard.${voiceLineKey(voice, voiceBand, pickVoiceLineIndex(daySeed))}` as never,
  );
  // G6: over the category pace but the phase still covers the overflow → reconcile
  // both truths; otherwise the reserve-date warning applies (the tight case).
  const showPhaseSlack = amigo.kind === 'over_pace' && amigo.overflowFitsPhase;
  const showReserveDate =
    (amigo.kind === 'over_pace' || amigo.kind === 'over_plan') &&
    amigo.reserveStartDate !== null &&
    !showPhaseSlack;

  return (
    <>
      {/* FB-12 · DEC-264: the chosen voice speaks first, in its own tone. */}
      <p className="text-[11px] mt-1 -mb-0.5 italic font-medium" style={{ color }}>
        {voiceLine}
      </p>
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
function renderExtra(
  extra: HonestFriendExtra,
  currency: string,
  t: Translate,
  onOpenPiggyStatement?: () => void,
) {
  // FB-08 · DEC-279: the cofrinho movement reads its own way (gain vs cover) and
  // offers a tappable door to the full statement.
  if (extra.id === 'piggy_movement') {
    const deposit = extra.deltaCents > 0;
    return (
      <>
        <p className="text-[13px] mt-1 leading-snug font-semibold text-on-surface">
          {t(deposit ? 'dashboard.amigo_extra_piggy_in' : 'dashboard.amigo_extra_piggy_out', {
            amount: formatMoney(Math.abs(extra.deltaCents), currency),
            balance: formatMoney(extra.balanceCents, currency),
          })}
        </p>
        {onOpenPiggyStatement && (
          <button
            onClick={onOpenPiggyStatement}
            className="btn-press mt-1.5 text-[11px] font-bold text-primary flex items-center gap-0.5"
          >
            {t('dashboard.amigo_extra_piggy_cta')}
            <Icon name="chevron_right" size={13} className="text-primary" />
          </button>
        )}
      </>
    );
  }

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

/**
 * FB-12 · DEC-264: the discovery slide past the last dot. Auto-rotation never
 * lands here; the user finds it only by swiping to the very end ("pull a bit
 * more and it tells you about voices"). Tapping opens Settings at the picker.
 */
function renderReveal(t: Translate, onOpenVoiceSettings?: () => void) {
  return (
    <>
      <p className="text-[13px] mt-1 leading-snug font-semibold text-on-surface">
        {t('dashboard.amigo_voice_reveal')}
      </p>
      {onOpenVoiceSettings && (
        <button
          onClick={onOpenVoiceSettings}
          className="btn-press mt-1.5 text-[11px] font-bold text-primary flex items-center gap-0.5"
        >
          {t('dashboard.amigo_voice_reveal_cta')}
          <Icon name="chevron_right" size={13} className="text-primary" />
        </button>
      )}
    </>
  );
}
