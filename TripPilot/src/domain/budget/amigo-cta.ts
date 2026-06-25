import type { HonestFriendExtra } from './honest-friend-extras';

/**
 * C07 / DEC-301 — the Amigo Sincero CTA must be a function of the ACTIVE slide,
 * not a fixed "Ver impacto" anchored to the verdict on every read. A button that
 * never changes (and points nowhere useful for the read on screen) is a dead /
 * fake affordance. This pure decision table maps the active slide to the action
 * row it deserves; slides with no useful action return an empty list so the card
 * simply hides the row (DEC-301: "sem ação útil → ocultar botão").
 *
 * Slides that already render their OWN in-body CTA (the cofrinho movement → the
 * statement; the voice reveal → settings) pass `hasInlineCta` so the row never
 * duplicates a button that is already right there in the slide body.
 */
export type AmigoSlideKind = 'verdict' | 'reveal' | HonestFriendExtra['id'];

export type AmigoCta = 'rescue' | 'simulate' | 'impact';

export interface ResolveAmigoSlideCtasInput {
  slideKind: AmigoSlideKind;
  /** The verdict is the dire `alert` tone (reserve at risk) — the rescue door. */
  isAlertVerdict: boolean;
  /** The active slide already shows its own in-body CTA — skip the row entirely. */
  hasInlineCta: boolean;
}

export function resolveAmigoSlideCtas(input: ResolveAmigoSlideCtasInput): AmigoCta[] {
  if (input.hasInlineCta) return [];
  switch (input.slideKind) {
    case 'verdict':
      // The verdict explains the overall standing → see the full impact; in the
      // dire alert tone it also keeps the rescue door reachable.
      return input.isAlertVerdict ? ['rescue', 'impact'] : ['impact'];
    case 'top_category':
      // "esta categoria custou X" → the impact breakdown is the matching read.
      return ['impact'];
    case 'daily_left':
      // "te sobra X por dia" → simulate a spend against that daily room.
      return ['simulate'];
    default:
      // phase_progress / receivable / piggy_movement (no handler) / reveal (no
      // handler): no single action explains the read → hide the row.
      return [];
  }
}
