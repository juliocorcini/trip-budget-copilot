import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import { calculateTotalBudget, calculateTotalSpent } from '@/domain/budget';
import { transactionBasePersonalCostCents, formatMoney } from '@/domain/money';

/**
 * E6 (M18): a read-only trip summary exported as a self-contained HTML
 * "infographic". It opens in any browser with no app install and no network
 * (CSS is inlined; there are zero external references). Every money figure is in
 * the trip's base currency, using the same base-aware basis as the in-app budget
 * (transactionBasePersonalCostCents), so the totals match what the user sees.
 */

export interface ReportLineTotal {
  label: string;
  totalCents: number;
}

export interface TripReport {
  tripName: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalSpentCents: number;
  totalBudgetCents: number;
  percentUsed: number;
  expenseCount: number;
  outingCount: number;
  outingTotalCents: number;
  byPhase: ReportLineTotal[];
  byCategory: ReportLineTotal[];
  byPlace: ReportLineTotal[];
}

export interface BuildTripReportInput {
  trip: { name: string; baseCurrency: string; startDate: string; endDate: string };
  transactions: Transaction[];
  pools: BudgetPool[];
  phases: { id: string; name: string }[];
  sessions: { id: string; deletedAt: string | null }[];
  generatedAt?: string;
}

function isActiveExpense(tx: Transaction): boolean {
  return tx.deletedAt === null && tx.type === 'expense';
}

function addTo(map: Map<string, number>, key: string, cents: number): void {
  map.set(key, (map.get(key) ?? 0) + cents);
}

function toSortedLines(map: Map<string, number>): ReportLineTotal[] {
  return [...map.entries()]
    .map(([label, totalCents]) => ({ label, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Pure aggregation of a trip into the figures shown in the HTML report. */
export function buildTripReport(input: BuildTripReportInput): TripReport {
  const phaseNames = new Map(input.phases.map((p) => [p.id, p.name]));
  const activeSessionIds = new Set(
    input.sessions.filter((s) => s.deletedAt === null).map((s) => s.id),
  );

  const byCategory = new Map<string, number>();
  const byPlace = new Map<string, number>();
  const byPhase = new Map<string, number>();
  let outingTotalCents = 0;
  let expenseCount = 0;

  for (const tx of input.transactions) {
    if (!isActiveExpense(tx)) continue;
    const baseCents = transactionBasePersonalCostCents(tx);
    expenseCount += 1;

    if (tx.category) addTo(byCategory, tx.category, baseCents);

    const placeLabel = tx.placeLabel?.trim();
    if (placeLabel) addTo(byPlace, placeLabel, baseCents);

    const phaseName = phaseNames.get(tx.phaseId);
    if (phaseName) addTo(byPhase, phaseName, baseCents);

    if (tx.sessionId && activeSessionIds.has(tx.sessionId)) {
      outingTotalCents += baseCents;
    }
  }

  const totalSpentCents = calculateTotalSpent(input.transactions);
  const totalBudgetCents = calculateTotalBudget(input.pools);
  const percentUsed =
    totalBudgetCents > 0 ? Math.round((totalSpentCents / totalBudgetCents) * 100) : 0;

  return {
    tripName: input.trip.name,
    baseCurrency: input.trip.baseCurrency,
    startDate: input.trip.startDate,
    endDate: input.trip.endDate,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    totalSpentCents,
    totalBudgetCents,
    percentUsed,
    expenseCount,
    outingCount: activeSessionIds.size,
    outingTotalCents,
    // Phases keep the chronological order they came in; spend lists go by size.
    byPhase: input.phases
      .map((p) => ({ label: p.name, totalCents: byPhase.get(p.name) ?? 0 }))
      .filter((line) => line.totalCents > 0),
    byCategory: toSortedLines(byCategory),
    byPlace: toSortedLines(byPlace),
  };
}

export interface TripReportLabels {
  documentTitle: string;
  generatedAt: string;
  spent: string;
  budget: string;
  used: string;
  expenses: string;
  byPhase: string;
  byCategory: string;
  byPlace: string;
  outings: string;
  outingsSummary: string;
  noData: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRows(lines: ReportLineTotal[], currency: string, emptyLabel: string): string {
  if (lines.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }
  const rows = lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label)}</td><td class="num">${escapeHtml(
          formatMoney(line.totalCents, currency),
        )}</td></tr>`,
    )
    .join('');
  return `<table>${rows}</table>`;
}

/**
 * Renders the report as a single self-contained HTML document. No network, no
 * scripts — safe to open or email anywhere. Labels are injected so the export
 * follows the user's language (ÂNCORA 16).
 */
export function renderTripReportHtml(report: TripReport, labels: TripReportLabels): string {
  const c = report.baseCurrency;
  const title = escapeHtml(report.tripName || labels.documentTitle);
  const dateRange = `${escapeHtml(report.startDate)} — ${escapeHtml(report.endDate)}`;
  const generated = escapeHtml(report.generatedAt.slice(0, 16).replace('T', ' '));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0f1115; color: #e8eaed; }
  .wrap { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #9aa0a6; font-size: 13px; margin: 0 0 24px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  .card { flex: 1; min-width: 150px; background: #1b1e24; border: 1px solid #2a2e36; border-radius: 14px; padding: 16px; }
  .card .k { color: #9aa0a6; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .card .v { font-size: 22px; font-weight: 700; margin-top: 6px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #9aa0a6; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid #2a2e36; font-size: 15px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .empty { color: #9aa0a6; font-size: 14px; }
  footer { color: #6b7077; font-size: 12px; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${title}</h1>
  <p class="sub">${dateRange}</p>

  <div class="cards">
    <div class="card"><div class="k">${escapeHtml(labels.spent)}</div><div class="v">${escapeHtml(formatMoney(report.totalSpentCents, c))}</div></div>
    <div class="card"><div class="k">${escapeHtml(labels.budget)}</div><div class="v">${escapeHtml(formatMoney(report.totalBudgetCents, c))}</div></div>
    <div class="card"><div class="k">${escapeHtml(labels.used)}</div><div class="v">${report.percentUsed}%</div></div>
    <div class="card"><div class="k">${escapeHtml(labels.expenses)}</div><div class="v">${report.expenseCount}</div></div>
  </div>

  <section>
    <h2>${escapeHtml(labels.byPhase)}</h2>
    ${renderRows(report.byPhase, c, labels.noData)}
  </section>

  <section>
    <h2>${escapeHtml(labels.byCategory)}</h2>
    ${renderRows(report.byCategory, c, labels.noData)}
  </section>

  <section>
    <h2>${escapeHtml(labels.byPlace)}</h2>
    ${renderRows(report.byPlace, c, labels.noData)}
  </section>

  <section>
    <h2>${escapeHtml(labels.outings)}</h2>
    <p class="empty">${escapeHtml(
      labels.outingsSummary
        .replace('{{count}}', String(report.outingCount))
        .replace('{{total}}', formatMoney(report.outingTotalCents, c)),
    )}</p>
  </section>

  <footer>${escapeHtml(labels.generatedAt)}: ${generated}</footer>
</div>
</body>
</html>`;
}
