import type { Transaction } from '@/domain/types/transaction';
import { transactionBasePersonalCostCents, formatMoney } from '@/domain/money';

/**
 * DEC-460 — Trip Diary V1: the trip retold as a day-by-day timeline (spends +
 * places + photos), readable in-app and exportable as a self-contained HTML
 * document. Pure aggregation here; photos and i18n stay at the UI boundary.
 *
 * Money basis matches the rest of the app: base currency via
 * transactionBasePersonalCostCents (the traveler's real share).
 */

export interface DiaryEntry {
  id: string;
  description: string;
  /** Base-currency personal cost — the same basis as every in-app total. */
  amountCents: number;
  category: string | null;
  placeLabel: string | null;
  notes: string | null;
  /** ISO creation timestamp — drives intra-day ordering only. */
  createdAt: string;
}

export interface DiaryDay {
  /** Local calendar day (YYYY-MM-DD). */
  date: string;
  entries: DiaryEntry[];
  totalCents: number;
  /** Unique place labels, in first-seen order — the day's "route". */
  places: string[];
  photoCount: number;
}

export interface TripDiary {
  tripName: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  /** Chronological (a diary reads oldest → newest). */
  days: DiaryDay[];
  totalSpentCents: number;
  expenseCount: number;
  photoCount: number;
  /** Unique places across the whole trip. */
  placeCount: number;
}

export interface BuildTripDiaryInput {
  trip: { name: string; baseCurrency: string; startDate: string; endDate: string };
  transactions: Transaction[];
  /** Attachment count per transaction id (repo lookup done by the caller). */
  photoCountByTransactionId?: ReadonlyMap<string, number>;
}

function isDiaryExpense(tx: Transaction): boolean {
  return tx.deletedAt === null && tx.type === 'expense';
}

/** Pure aggregation of the trip into a chronological day-by-day diary. */
export function buildTripDiary(input: BuildTripDiaryInput): TripDiary {
  const photoCounts = input.photoCountByTransactionId ?? new Map<string, number>();
  const byDay = new Map<string, DiaryEntry[]>();
  const dayPhotoCounts = new Map<string, number>();

  for (const tx of input.transactions) {
    if (!isDiaryExpense(tx)) continue;
    const entry: DiaryEntry = {
      id: tx.id,
      description: tx.description,
      amountCents: transactionBasePersonalCostCents(tx),
      category: tx.category,
      placeLabel: tx.placeLabel?.trim() || null,
      notes: tx.notes?.trim() || null,
      createdAt: tx.createdAt,
    };
    const list = byDay.get(tx.date);
    if (list) list.push(entry);
    else byDay.set(tx.date, [entry]);
    const photos = photoCounts.get(tx.id) ?? 0;
    if (photos > 0) dayPhotoCounts.set(tx.date, (dayPhotoCounts.get(tx.date) ?? 0) + photos);
  }

  const allPlaces = new Set<string>();
  const days: DiaryDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => {
      entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const places: string[] = [];
      let totalCents = 0;
      for (const entry of entries) {
        totalCents += entry.amountCents;
        if (entry.placeLabel && !places.includes(entry.placeLabel)) {
          places.push(entry.placeLabel);
          allPlaces.add(entry.placeLabel);
        }
      }
      return { date, entries, totalCents, places, photoCount: dayPhotoCounts.get(date) ?? 0 };
    });

  return {
    tripName: input.trip.name,
    baseCurrency: input.trip.baseCurrency,
    startDate: input.trip.startDate,
    endDate: input.trip.endDate,
    days,
    totalSpentCents: days.reduce((sum, d) => sum + d.totalCents, 0),
    expenseCount: days.reduce((sum, d) => sum + d.entries.length, 0),
    photoCount: days.reduce((sum, d) => sum + d.photoCount, 0),
    placeCount: allPlaces.size,
  };
}

// ---------------------------------------------------------------------------
// HTML export — one self-contained document (inline CSS, embedded photos as
// data URLs, zero external references). Same contract as the trip report
// (E6/M18): opens anywhere, offline, no scripts.
// ---------------------------------------------------------------------------

export interface TripDiaryLabels {
  documentTitle: string;
  days: string;
  expenses: string;
  totalSpent: string;
  places: string;
  dayTotal: string;
  noEntries: string;
  madeWith: string;
}

export interface RenderTripDiaryOptions {
  labels: TripDiaryLabels;
  /** Localized heading for a day, e.g. "sáb, 12 de julho". */
  dayHeading: (date: string) => string;
  /** Localized category name, or null to omit the chip. */
  categoryName: (category: string) => string | null;
  /** Photo data URLs per entry id (already sized for embedding). */
  photosByEntry?: Record<string, string[]>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEntry(
  entry: DiaryEntry,
  currency: string,
  options: RenderTripDiaryOptions,
): string {
  const category = entry.category ? options.categoryName(entry.category) : null;
  const photos = options.photosByEntry?.[entry.id] ?? [];
  const metaBits = [
    category ? `<span class="chip">${escapeHtml(category)}</span>` : '',
    entry.placeLabel ? `<span class="place">${escapeHtml(entry.placeLabel)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="entry">
  <div class="entry-row">
    <div class="entry-main">
      <p class="desc">${escapeHtml(entry.description)}</p>
      ${metaBits ? `<div class="meta">${metaBits}</div>` : ''}
      ${entry.notes ? `<p class="notes">${escapeHtml(entry.notes)}</p>` : ''}
    </div>
    <p class="amount">${escapeHtml(formatMoney(entry.amountCents, currency))}</p>
  </div>
  ${
    photos.length > 0
      ? `<div class="photos">${photos
          .map((src) => `<img src="${src}" alt="" loading="lazy">`)
          .join('')}</div>`
      : ''
  }
</div>`;
}

function renderDay(day: DiaryDay, currency: string, options: RenderTripDiaryOptions): string {
  return `<section class="day">
  <div class="day-head">
    <h2>${escapeHtml(options.dayHeading(day.date))}</h2>
    <span class="day-total">${escapeHtml(formatMoney(day.totalCents, currency))}</span>
  </div>
  ${day.places.length > 0 ? `<p class="route">${escapeHtml(day.places.join(' · '))}</p>` : ''}
  ${day.entries.map((entry) => renderEntry(entry, currency, options)).join('\n')}
</section>`;
}

/** Renders the diary as one beautiful, self-contained HTML document. */
export function renderTripDiaryHtml(diary: TripDiary, options: RenderTripDiaryOptions): string {
  const { labels } = options;
  const c = diary.baseCurrency;
  const title = escapeHtml(diary.tripName || labels.documentTitle);
  const dateRange = `${escapeHtml(diary.startDate)} — ${escapeHtml(diary.endDate)}`;

  const body =
    diary.days.length === 0
      ? `<p class="empty">${escapeHtml(labels.noEntries)}</p>`
      : diary.days.map((day) => renderDay(day, c, options)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 48px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0b1220; color: #e8eaed; }
  .wrap { max-width: 560px; margin: 0 auto; }
  header.hero { text-align: center; padding: 24px 0 8px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -.01em; }
  .sub { color: #94a3b8; font-size: 13px; margin: 0 0 20px; }
  .stats { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
  .stat { background: #111826; border: 1px solid #1e293b; border-radius: 14px; padding: 10px 16px; min-width: 96px; }
  .stat .k { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  .stat .v { font-size: 18px; font-weight: 700; margin-top: 4px; }
  section.day { margin-top: 28px; border-left: 2px solid #1e293b; padding-left: 16px; position: relative; }
  section.day::before { content: ''; position: absolute; left: -7px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: #2dd4bf; }
  .day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .day-head h2 { font-size: 16px; margin: 0; text-transform: capitalize; }
  .day-total { color: #2dd4bf; font-weight: 700; font-size: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .route { color: #94a3b8; font-size: 12px; margin: 4px 0 0; }
  .entry { background: #111826; border: 1px solid #1e293b; border-radius: 14px; padding: 12px 14px; margin-top: 10px; }
  .entry-row { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; }
  .desc { margin: 0; font-size: 15px; font-weight: 600; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .chip { background: #1e293b; color: #cbd5e1; border-radius: 999px; padding: 2px 10px; font-size: 11px; }
  .place { color: #94a3b8; font-size: 11px; padding: 2px 0; }
  .place::before { content: '📍 '; }
  .notes { color: #94a3b8; font-size: 12px; font-style: italic; margin: 6px 0 0; }
  .amount { margin: 0; font-weight: 700; font-size: 15px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .photos { display: flex; gap: 8px; margin-top: 10px; overflow-x: auto; }
  .photos img { height: 140px; border-radius: 10px; flex: 0 0 auto; max-width: 100%; object-fit: cover; }
  .empty { color: #94a3b8; text-align: center; padding: 40px 0; }
  footer { color: #64748b; font-size: 12px; margin-top: 40px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${title}</h1>
    <p class="sub">${dateRange}</p>
    <div class="stats">
      <div class="stat"><div class="k">${escapeHtml(labels.days)}</div><div class="v">${diary.days.length}</div></div>
      <div class="stat"><div class="k">${escapeHtml(labels.expenses)}</div><div class="v">${diary.expenseCount}</div></div>
      <div class="stat"><div class="k">${escapeHtml(labels.totalSpent)}</div><div class="v">${escapeHtml(formatMoney(diary.totalSpentCents, c))}</div></div>
      <div class="stat"><div class="k">${escapeHtml(labels.places)}</div><div class="v">${diary.placeCount}</div></div>
    </div>
  </header>
  ${body}
  <footer>${escapeHtml(labels.madeWith)}</footer>
</div>
</body>
</html>`;
}
