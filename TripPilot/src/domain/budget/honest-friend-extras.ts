import type { HonestFriendTone } from './honest-friend';

/**
 * DEC-093 follow-up (device-test 2026-06-20): the Amigo Sincero used to surface a
 * SINGLE verdict and got "stuck" on it ("esse gasto levou 1% do dinheiro livre")
 * even when there was clearly more to say. These pure EXTRAS turn the card into a
 * carousel: the rich verdict stays slide 0, and each qualifying extra below adds
 * one more honest, data-grounded slide. Each extra is a small typed record the
 * card renders (currency formatting stays in the card, so the domain is pure and
 * currency-agnostic). Only meaningful extras are returned — nothing to pad.
 */
export type HonestFriendExtra =
  | { id: 'phase_progress'; tone: HonestFriendTone; percent: number }
  | { id: 'daily_left'; tone: HonestFriendTone; days: number; perDayCents: number }
  | { id: 'top_category'; tone: HonestFriendTone; categoryKey: string; amountCents: number; percent: number }
  | { id: 'receivable'; tone: HonestFriendTone; amountCents: number }
  // FB-08 · DEC-279: the cofrinho moved on the latest day — a timely, tappable
  // notification ("+X saved / −X covered, balance now Y"). Deep-links to the
  // statement. Positive delta = deposit (saved); negative = withdrawal (covered).
  | { id: 'piggy_movement'; tone: HonestFriendTone; deltaCents: number; balanceCents: number }
  // 2026-07-09 marketing P0: the cofrinho buffer has accumulated enough for at
  // least one typical occasion AND passes the safety margin — the friend
  // ENCOURAGES spending. Fires only when spending one occasion still leaves
  // meaningful buffer (≥ 1.5× typical, or ≥ 1× AND phase survives without piggy).
  | { id: 'can_afford_more'; tone: HonestFriendTone; profileName: string; occasionCount: number; piggyBalanceCents: number }
  // 2026-07-09: informational variant — the piggy has balance but doesn't pass
  // the safety gates for "go spend it". Celebrates the saving without the CTA.
  | { id: 'piggy_healthy'; tone: HonestFriendTone; piggyBalanceCents: number };

export interface HonestFriendExtrasInput {
  /** Cents spent in the phase so far (personal cost). */
  phaseSpentCents: number;
  /** The phase budget envelope (spent + free), in cents. */
  phaseBudgetCents: number;
  /** Free-to-spend left in the phase, clamped at ≥ 0. */
  freeToSpendCents: number;
  /** Whole days left until the phase ends (≥ 0). */
  daysLeftInPhase: number;
  /** The category with the most spend this phase, or null when there is none. */
  topCategoryKey: string | null;
  /** Cents spent on that top category. */
  topCategoryCents: number;
  /** Money others owe the user (settle-up receivable), in cents. */
  receivableCents: number;
  /**
   * FB-08 · DEC-279 (buffer-aware reading): current cofrinho buffer balance.
   * When positive, the "per day" reading stops inflating with the saved surplus
   * and stays at the plan's base ideal — the surplus is shown in the cofrinho,
   * not spread back into the daily. Optional → callers predating the buffer keep
   * the classic `freeToSpend / daysLeft` reading. The TOTAL is never touched.
   */
  piggyBalanceCents?: number;
  /** The plan's constant base daily ideal (phaseBudget / totalDays), cents. */
  baseDailyIdealCents?: number;
  /**
   * FB-08 · DEC-279: signed balance change of the MOST RECENT day (today): > 0
   * deposited, < 0 withdrawn, 0 = no movement (no notification). Drives the
   * `piggy_movement` slide. Optional → callers without the ledger show nothing.
   */
  piggyLastMovementCents?: number;
  /**
   * 2026-07-09 (marketing P0): profiles with their typical occasion cost, so the
   * friend can say "your piggy covers N bar nights!". Optional → pre-existing
   * callers produce no `can_afford_more` slide and change nothing.
   */
  profileTypicals?: ReadonlyArray<{ name: string; typicalCents: number }>;
}

/**
 * DEC-417 (G5): the extras that read as a "rhythm" (daily pace / phase progress).
 * When the verdict is the weak `no_plan`, `verdictLeadsCarousel` yields the lead to
 * one of these — the pace is fresher and less repetitive than "this expense took
 * X%". Shared here so the card and the domain agree on what counts as rhythm.
 */
export const RHYTHM_EXTRA_IDS: readonly HonestFriendExtra['id'][] = ['daily_left', 'phase_progress'];

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Builds the ordered list of extra insights for the Amigo Sincero carousel. Each
 * is gated on being genuinely informative (positive amounts, a real plan window),
 * so an empty trip yields an empty list and the card just shows its verdict.
 */
export function buildHonestFriendExtras(input: HonestFriendExtrasInput): HonestFriendExtra[] {
  const extras: HonestFriendExtra[] = [];

  // FB-08 · DEC-279: surface a fresh cofrinho movement FIRST — it is the timely
  // "your piggy just moved" notification the user asked for (e.g. a "won't spend
  // today" check-in growing it). A deposit reads positive; a withdrawal is calm.
  const lastMovement = input.piggyLastMovementCents ?? 0;
  if (lastMovement !== 0) {
    extras.push({
      id: 'piggy_movement',
      tone: lastMovement > 0 ? 'positive' : 'steady',
      deltaCents: lastMovement,
      balanceCents: Math.max(0, Math.round(input.piggyBalanceCents ?? 0)),
    });
  }

  if (input.phaseBudgetCents > 0 && input.phaseSpentCents > 0) {
    const percent = clampPercent((input.phaseSpentCents / input.phaseBudgetCents) * 100);
    extras.push({ id: 'phase_progress', tone: percent >= 90 ? 'caution' : 'neutral', percent });
  }

  if (input.daysLeftInPhase > 0 && input.freeToSpendCents > 0) {
    const spreadCents = Math.floor(input.freeToSpendCents / input.daysLeftInPhase);
    // FB-08 · DEC-279: with a live buffer, hold the daily at the base ideal so the
    // saved surplus stays visible in the cofrinho. `min` guarantees the reading
    // never exceeds what `freeToSpend / daysLeft` already permits (safe in every
    // edge), while normally surfacing the stable base ideal (spread > ideal when
    // you have saved). No buffer / no ideal → classic spread, byte-identical.
    const buffered =
      (input.piggyBalanceCents ?? 0) > 0 && (input.baseDailyIdealCents ?? 0) > 0;
    const perDayCents = buffered
      ? Math.min(Math.floor(input.baseDailyIdealCents ?? 0), spreadCents)
      : spreadCents;
    if (perDayCents > 0) {
      extras.push({ id: 'daily_left', tone: 'neutral', days: input.daysLeftInPhase, perDayCents });
    }
  }

  if (input.topCategoryKey && input.topCategoryCents > 0 && input.phaseSpentCents > 0) {
    const percent = clampPercent((input.topCategoryCents / input.phaseSpentCents) * 100);
    extras.push({
      id: 'top_category',
      tone: 'neutral',
      categoryKey: input.topCategoryKey,
      amountCents: input.topCategoryCents,
      percent,
    });
  }

  if (input.receivableCents > 0) {
    extras.push({ id: 'receivable', tone: 'positive', amountCents: input.receivableCents });
  }

  // 2026-07-09 (marketing P0 + safety fix): "the only finance app that also
  // tells you to SPEND" — but ONLY when spending won't destroy the safety
  // buffer. Two-layer model:
  //   Layer 1 (can_afford_more): piggy ≥ 1.5× typical OR (piggy ≥ 1× typical
  //     AND the phase survives 2 days without the piggy). Encouraging "go spend!"
  //   Layer 2 (piggy_healthy): piggy has balance but doesn't pass safety gates.
  //     Celebrates the saving without inciting consumption.
  const piggyBalance = Math.max(0, Math.round(input.piggyBalanceCents ?? 0));
  const profiles = input.profileTypicals ?? [];
  const baseDailyIdeal = Math.max(0, Math.round(input.baseDailyIdealCents ?? 0));

  if (piggyBalance > 0 && profiles.length > 0) {
    const affordable = profiles
      .filter((p) => p.typicalCents > 0 && piggyBalance >= p.typicalCents)
      .sort((a, b) => b.typicalCents - a.typicalCents);

    if (affordable.length > 0) {
      const best = affordable[0]!;
      const remainsAfterOne = piggyBalance - best.typicalCents;
      const phaseWithoutPiggy = input.freeToSpendCents - piggyBalance;

      const safeToEncourage =
        remainsAfterOne >= Math.round(best.typicalCents * 0.5) ||
        (piggyBalance >= best.typicalCents && phaseWithoutPiggy >= baseDailyIdeal * 2);

      if (safeToEncourage) {
        const safeCount = Math.floor(remainsAfterOne / best.typicalCents) + 1;
        extras.push({
          id: 'can_afford_more',
          tone: 'positive',
          profileName: best.name,
          occasionCount: safeCount,
          piggyBalanceCents: piggyBalance,
        });
      } else {
        extras.push({ id: 'piggy_healthy', tone: 'positive', piggyBalanceCents: piggyBalance });
      }
    } else {
      extras.push({ id: 'piggy_healthy', tone: 'positive', piggyBalanceCents: piggyBalance });
    }
  } else if (piggyBalance > 0) {
    extras.push({ id: 'piggy_healthy', tone: 'positive', piggyBalanceCents: piggyBalance });
  }

  return extras;
}

/**
 * C08 / DEC-301 — on the HOME, the Amigo Sincero must not parrot what the
 * insights carousel right above it already says (e.g. both showing the top
 * category, or both showing the phase progress). This pure filter drops any
 * extra whose TOPIC is already covered by a visible insight, so the home card
 * only appears when it adds something actionable/new. The Copiloto tab keeps the
 * full set (that is where the complete read lives) — this is home-only.
 *
 * Coupling stays loose: insight kinds arrive as plain strings, so the budget
 * domain never imports the insights domain.
 */
const HOME_AMIGO_EXTRA_INSIGHT_OVERLAP: Record<HonestFriendExtra['id'], readonly string[]> = {
  phase_progress: ['phase_projection', 'phase_countdown'],
  daily_left: ['end_of_day'],
  top_category: ['category_rhythm'],
  receivable: ['participant_balance'],
  piggy_movement: [],
  can_afford_more: [],
  piggy_healthy: [],
};

/** Extras that are emotional/voice messages — they live ONLY on the Amigo card
 *  and must never be relocated to the insights carousel as factual reads. */
export const VOICE_ONLY_EXTRA_IDS: ReadonlySet<HonestFriendExtra['id']> = new Set([
  'can_afford_more',
  'piggy_healthy',
]);

/** Returns only the voice-only extras that should stay on the Amigo card even
 *  when the Home operates in "voice only" mode (DEC-317). Factual extras move
 *  to the insights carousel; emotional ones remain on the card. */
export function selectVoiceOnlyExtras(
  extras: readonly HonestFriendExtra[],
): HonestFriendExtra[] {
  return extras.filter((extra) => VOICE_ONLY_EXTRA_IDS.has(extra.id));
}

export function filterHomeAmigoExtras(
  extras: readonly HonestFriendExtra[],
  coveredInsightKinds: readonly string[],
): HonestFriendExtra[] {
  const covered = new Set(coveredInsightKinds);
  return extras.filter((extra) => {
    if (VOICE_ONLY_EXTRA_IDS.has(extra.id)) return false;
    const overlap = HOME_AMIGO_EXTRA_INSIGHT_OVERLAP[extra.id];
    return !overlap.some((kind) => covered.has(kind));
  });
}
