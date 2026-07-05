import type { FrozenExchangeRates } from '@/domain/types/common';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { Transaction } from '@/domain/types/transaction';
import type { OccasionCounterItem } from '@/domain/dashboard';
import { transactionBasePersonalCostCents, formatMoney } from '@/domain/money';
import { localDayOf } from '@/domain/dates';

/**
 * DEC-468 — home-screen widget suite. ONE JSON payload carries every widget's
 * data from the web layer (the only place the numbers exist — ÂNCORA 10: the
 * native side never re-computes money) to the Android providers. This module
 * is PURE: the caller (DashboardPage effect) supplies raw model slices plus
 * already-localized labels/formatters, and gets back the exact object the
 * native `WidgetStore` parses. Testable without Capacitor.
 *
 * Contract notes (native side reads these — keep field names stable):
 * - All money/labels arrive as FINAL strings (web owns locale + currency).
 * - `converter` is the exception: it needs RAW rates because the widget's
 *   calculator converts live on-device between pushes.
 */

/** Emoji per category — RemoteViews cannot render Material icon fonts. */
export const CATEGORY_EMOJI: Record<string, string> = {
  bar: '🍺',
  market: '🛒',
  restaurant: '🍽️',
  outing: '🥾',
  transport: '🚌',
  festival: '🎉',
  accommodation: '🛏️',
  health: '🩺',
  communication: '📶',
  clothing: '👕',
  gifts: '🎁',
  entertainment: '🎬',
  home_day: '🏠',
  special: '⭐',
  cash_adjustment: '🏧',
  reconciliation: '⚖️',
  other: '💸',
};

export function categoryEmoji(category: string | null): string {
  if (!category) return '💸';
  return CATEGORY_EMOJI[category] ?? '💸';
}

export interface WidgetMetaItem {
  emoji: string;
  name: string;
  /** Big number on the card: remaining (planned) or occasion count (activity). */
  count: number;
  /** Secondary line, already localized ("0 feitas · 14 antigas" / "gastos"). */
  detail: string;
}

export interface WidgetTodayItem {
  emoji: string;
  /** "Cerveja · € 4,50" — description + personal cost, already formatted. */
  text: string;
}

export interface WidgetPayload {
  freeToday: {
    value: string;
    label: string;
    addHint: string;
    /** "Gasto hoje · € 12,00" or null when nothing was spent yet. */
    spentLine: string | null;
    /** "Dia 5 de 21" or null when the phase has no usable dates. */
    dayLine: string | null;
    /** Phase progress 0-100 or null. */
    progressPct: number | null;
  } | null;
  actions: { add: string; scan: string; outing: string; convert: string } | null;
  metas: { label: string; items: WidgetMetaItem[] } | null;
  piggy: {
    label: string;
    value: string;
    /** "Meta: € 200" or null when no savings goal is set. */
    goalLine: string | null;
    /** Goal progress 0-100 or null without a goal. */
    progressPct: number | null;
  } | null;
  nextEvent: {
    label: string;
    name: string;
    /** "em 7 dias" / "amanhã" / "hoje" — pre-localized by the caller. */
    countdown: string;
    /** Raw day count — the 1x1 bucket renders "7d" from this. */
    daysUntil: number;
    /** "12/07 · € 150 reservados" or null. */
    detailLine: string | null;
  } | null;
  today: { label: string; totalLine: string; items: WidgetTodayItem[] } | null;
  converter: {
    /** Initial pair (native persists the user's own choice after first use). */
    from: string;
    to: string;
    /** Cycle order for the FROM/TO chips — most relevant first. */
    currencies: string[];
    base: string;
    ratesToBase: Record<string, number>;
    /** "câmbio de 04/07" — honesty stamp, pre-localized. */
    rateStamp: string;
  } | null;
}

export interface BuildWidgetPayloadInput {
  baseCurrency: string;
  todayIso: string;
  freeToday: {
    freeTodayCents: number;
    todaySpentCents: number;
  } | null;
  phase: { startDate: string; endDate: string } | null;
  occasionCounters: OccasionCounterItem[];
  piggyBankCents: number;
  savingsGoal: { goalCents: number; progressRatio: number } | null;
  upcomingEvents: PlannedOccurrence[];
  /** Expense transactions of today (caller pre-scopes phase + deleted). */
  transactions: Transaction[];
  frozenRates: FrozenExchangeRates | null;
  converterPair: { from: string; to: string; currencies: string[] } | null;
  labels: {
    freeToday: string;
    addHint: string;
    spentToday: (amount: string) => string;
    dayOf: (day: number, total: number) => string;
    metas: string;
    metaDetailPlanned: (done: number, before: number) => string;
    metaDetailActivity: string;
    piggy: string;
    piggyGoal: (amount: string) => string;
    nextEvent: string;
    countdown: (daysUntil: number) => string;
    eventReserve: (amount: string) => string;
    today: string;
    rateStamp: string;
    actionAdd: string;
    actionScan: string;
    actionOuting: string;
    actionConvert: string;
    categoryName: (category: string) => string;
  };
}

/** Whole days from `todayIso` to `dateIso` (both local YYYY-MM-DD). */
export function daysUntil(todayIso: string, dateIso: string): number {
  const today = new Date(`${todayIso}T12:00:00`);
  const target = new Date(`${dateIso}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function clampPct(ratio: number): number {
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function buildFreeToday(input: BuildWidgetPayloadInput): WidgetPayload['freeToday'] {
  if (!input.freeToday) return null;
  const { labels } = input;
  let dayLine: string | null = null;
  let progressPct: number | null = null;
  if (input.phase) {
    const total = daysUntil(input.phase.startDate, input.phase.endDate) + 1;
    const day = daysUntil(input.phase.startDate, input.todayIso) + 1;
    if (total >= 1 && day >= 1 && day <= total) {
      dayLine = labels.dayOf(day, total);
      progressPct = clampPct(day / total);
    }
  }
  return {
    value: formatMoney(input.freeToday.freeTodayCents, input.baseCurrency),
    label: labels.freeToday,
    addHint: labels.addHint,
    spentLine:
      input.freeToday.todaySpentCents > 0
        ? labels.spentToday(formatMoney(input.freeToday.todaySpentCents, input.baseCurrency))
        : null,
    dayLine,
    progressPct,
  };
}

/** Up to 6 counters, planned metas first — same order as the home carousel. */
function buildMetas(input: BuildWidgetPayloadInput): WidgetPayload['metas'] {
  const items: WidgetMetaItem[] = input.occasionCounters.slice(0, 6).map((counter) => {
    if (counter.kind === 'planned') {
      return {
        emoji: categoryEmoji(counter.category),
        name: counter.name,
        count: counter.remaining,
        detail: input.labels.metaDetailPlanned(counter.done, counter.beforePlanCount),
      };
    }
    return {
      emoji: categoryEmoji(counter.category),
      name: input.labels.categoryName(counter.category),
      count: counter.occasionCount,
      detail: input.labels.metaDetailActivity,
    };
  });
  if (items.length === 0) return null;
  return { label: input.labels.metas, items };
}

function buildPiggy(input: BuildWidgetPayloadInput): WidgetPayload['piggy'] {
  if (input.piggyBankCents <= 0) return null;
  const goal = input.savingsGoal;
  return {
    label: input.labels.piggy,
    value: formatMoney(input.piggyBankCents, input.baseCurrency),
    goalLine:
      goal && goal.goalCents > 0
        ? input.labels.piggyGoal(formatMoney(goal.goalCents, input.baseCurrency))
        : null,
    progressPct: goal && goal.goalCents > 0 ? clampPct(goal.progressRatio) : null,
  };
}

/**
 * The soonest upcoming event with a date. The absolute date is always shown
 * next to the countdown (Critic: a pushed-only widget can go stale — "em 2
 * dias" must never be the only truth on screen).
 */
function buildNextEvent(input: BuildWidgetPayloadInput): WidgetPayload['nextEvent'] {
  const dated = input.upcomingEvents
    .filter((o) => o.plannedDate !== null && o.deletedAt === null)
    .sort((a, b) => (a.plannedDate! < b.plannedDate! ? -1 : 1));
  const next = dated[0];
  if (!next) return null;
  // plannedDate is usually a plain LOCAL day already — only a real timestamp
  // needs the local-day projection (running localDayOf on a plain date would
  // shift it a day west of UTC).
  const eventDay = next.plannedDate!.includes('T')
    ? localDayOf(next.plannedDate!)
    : next.plannedDate!;
  const days = daysUntil(input.todayIso, eventDay);
  if (days < 0) return null;
  const [, month, day] = eventDay.split('-');
  const dateLabel = `${day}/${month}`;
  const reserveCents = next.reservedCents ?? next.estimatedCostCents;
  const reservePart =
    reserveCents > 0
      ? ` · ${input.labels.eventReserve(formatMoney(reserveCents, input.baseCurrency))}`
      : '';
  return {
    label: input.labels.nextEvent,
    name: next.name,
    countdown: input.labels.countdown(days),
    daysUntil: days,
    detailLine: `${dateLabel}${reservePart}`,
  };
}

/** Today's expenses, newest first, capped at 5 rows (the tall bucket shows 5). */
function buildToday(input: BuildWidgetPayloadInput): WidgetPayload['today'] {
  const todayTxs = input.transactions
    .filter(
      (tx) =>
        tx.type === 'expense' && tx.deletedAt === null && localDayOf(tx.date) === input.todayIso,
    )
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  if (todayTxs.length === 0) return null;
  const totalCents = todayTxs.reduce((sum, tx) => sum + transactionBasePersonalCostCents(tx), 0);
  return {
    label: input.labels.today,
    totalLine: formatMoney(totalCents, input.baseCurrency),
    items: todayTxs.slice(0, 5).map((tx) => ({
      emoji: categoryEmoji(tx.category),
      text: `${tx.description} · ${formatMoney(transactionBasePersonalCostCents(tx), tx.currency || input.baseCurrency)}`,
    })),
  };
}

function buildConverter(input: BuildWidgetPayloadInput): WidgetPayload['converter'] {
  if (!input.converterPair) return null;
  const rates = input.frozenRates;
  return {
    from: input.converterPair.from,
    to: input.converterPair.to,
    currencies: input.converterPair.currencies.slice(0, 12),
    base: rates?.baseCurrency ?? input.baseCurrency,
    ratesToBase: rates?.ratesToBase ?? {},
    rateStamp: input.labels.rateStamp,
  };
}

export function buildWidgetPayload(input: BuildWidgetPayloadInput): WidgetPayload {
  return {
    freeToday: buildFreeToday(input),
    actions: {
      add: input.labels.actionAdd,
      scan: input.labels.actionScan,
      outing: input.labels.actionOuting,
      convert: input.labels.actionConvert,
    },
    metas: buildMetas(input),
    piggy: buildPiggy(input),
    nextEvent: buildNextEvent(input),
    today: buildToday(input),
    converter: buildConverter(input),
  };
}
