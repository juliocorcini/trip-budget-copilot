import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@/i18n';
import { HeatmapGrid } from '@/features/dashboard/cards/HeatmapGrid';
import type { MonthHeatmap } from '@/domain/dashboard';

/**
 * D-BUG-22 — the month/calendar cells used to render the day's spend as a bare,
 * currency-less number ("46"). They must now carry the currency symbol ("€46"),
 * regardless of locale, because `currency` is threaded into `formatMoneyCompact`.
 */
function heatmap(): MonthHeatmap {
  return {
    monthIso: '2026-06',
    firstWeekday: 0,
    monthTotalCents: 4600,
    maxDayCents: 4600,
    days: [
      { dayIso: '2026-06-01', dayOfMonth: 1, totalCents: 4600, byCategory: [], intensity: 4, isFuture: false },
      { dayIso: '2026-06-02', dayOfMonth: 2, totalCents: 0, byCategory: [], intensity: 0, isFuture: false },
    ],
  };
}

describe('HeatmapGrid — calendar cells carry the currency symbol (D-BUG-22)', () => {
  afterEach(() => cleanup());

  it('renders the day spend with the EUR symbol, not a bare number', () => {
    render(<HeatmapGrid heatmap={heatmap()} currency="EUR" todayIso="2026-06-15" onSelectDay={() => {}} />);
    expect(screen.getByText('€46')).toBeInTheDocument();
  });

  it('renders the day spend with the BRL symbol for a BRL trip', () => {
    render(<HeatmapGrid heatmap={heatmap()} currency="BRL" todayIso="2026-06-15" onSelectDay={() => {}} />);
    expect(screen.getByText('R$46')).toBeInTheDocument();
  });
});
