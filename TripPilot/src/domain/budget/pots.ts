import { addDaysIso } from '@/domain/dates';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Phase } from '@/domain/types/phase';

/** GATE 3 default visibility window (D8 / master §10.1: V1 = D-7 fixed). */
export const POT_VISIBILITY_WINDOW_DAYS = 7;

/** YYYY-MM-DD (a stored date may carry a time component — compare by day). */
function day(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * GATE 3 (D8): is a Pote relevant enough to surface on the Home right now?
 *
 * - A DATELESS pot is ambient ("dinheiro à parte" with no moment) — it is always
 *   relevant and stays on the Home exactly as before (no regression for pots that
 *   predate the date field).
 * - A DATED pot follows the canonical rule: it rises on the Home only when the
 *   ACTIVE trecho is the one that "owns" it (its `dateStart` falls inside that
 *   trecho) OR when today is within the D-7 window up to its end. It never shows
 *   in a trecho that is not its owner before that window — so a festival in the
 *   Eurotrip does not pollute the Burgos days.
 *
 * Pure: callers pass the active phase + today; the dedicated "Potes e planejados"
 * section lists EVERY pot regardless (D9) — this rule is only for the Home.
 */
export function isPotVisibleOnHome(
  pot: BudgetPool,
  activePhase: Phase | null,
  today: string,
  windowDays: number = POT_VISIBILITY_WINDOW_DAYS,
): boolean {
  const start = pot.dateStart ?? null;
  if (start === null) return true; // ambient

  const startDay = day(start);
  if (
    activePhase !== null &&
    day(activePhase.startDate) <= startDay &&
    startDay <= day(activePhase.endDate)
  ) {
    return true; // owner trecho is active
  }

  const windowOpens = addDaysIso(startDay, -windowDays);
  const windowCloses = day(pot.dateEnd ?? start);
  const todayDay = day(today);
  return todayDay >= windowOpens && todayDay <= windowCloses;
}

/**
 * F3 (D9 scoping): does a pot belong to a given trecho when the "Viagem" tab is
 * focused on a SPECIFIC phase? The "Potes e planejados" list shows EVERY pot in
 * the cross-phase ("Todas") view, but when the user drills into one phase a pot
 * dated for a LATER trecho appearing there is confusing. Rule (mirrors the Home
 * owner-trecho clause): a DATELESS pot is ambient ("dinheiro à parte" with no
 * moment) and belongs to every phase view; a DATED pot belongs ONLY to the
 * trecho whose range holds its `dateStart`. Pure.
 */
export function isPotInPhase(pot: BudgetPool, phase: Phase): boolean {
  const start = pot.dateStart ?? null;
  if (start === null) return true; // ambient — belongs to every phase view
  const startDay = day(start);
  return day(phase.startDate) <= startDay && startDay <= day(phase.endDate);
}

/**
 * GATE 3 (D8): the subset of pots that should surface on the Home today. Only
 * `global` pots are candidates; soft-deleted pots are dropped. Order is
 * preserved so the caller controls the display order.
 */
export function selectVisiblePots(
  pots: BudgetPool[],
  activePhase: Phase | null,
  today: string,
  windowDays: number = POT_VISIBILITY_WINDOW_DAYS,
): BudgetPool[] {
  return pots.filter(
    (pot) =>
      pot.scope === 'global' &&
      pot.deletedAt === null &&
      isPotVisibleOnHome(pot, activePhase, today, windowDays),
  );
}

/**
 * GATE 5 (D15 / DEC-314): the dated pots that belong to ANOTHER phase than the one
 * in focus — global pots with a date that are not relevant on the Home right now
 * (their owner trecho is not active and the D-7 window is closed). They are kept
 * OUT of the Home focus so a future festival does not pollute the current phase,
 * but they stay discoverable in a collapsed "Potes de outras fases" area and remain
 * fully selectable when logging an expense (`getAvailablePoolsForPhase`). A DATELESS
 * ("ambient") pot is never "other phase" — it has no moment to belong to. Pure: the
 * exact complement of `selectVisiblePots` among dated global pots.
 */
export function selectOtherPhasePots(
  pots: BudgetPool[],
  activePhase: Phase | null,
  today: string,
  windowDays: number = POT_VISIBILITY_WINDOW_DAYS,
): BudgetPool[] {
  return pots.filter(
    (pot) =>
      pot.scope === 'global' &&
      pot.deletedAt === null &&
      (pot.dateStart ?? null) !== null &&
      !isPotVisibleOnHome(pot, activePhase, today, windowDays),
  );
}
