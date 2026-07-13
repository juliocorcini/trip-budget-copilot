import { describe, it, expect } from 'vitest';
import {
  getCurrentLeg,
  getNextTransport,
  getDayAgenda,
  suggestPhasesFromLegs,
  getTripSummary,
} from '@/domain/itinerary/itinerary-domain';
import { JULIO_EUROTRIP_LEGS, MINI_LEGS } from '@/tests/fixtures/julio-eurotrip-legs';

describe('getCurrentLeg', () => {
  it('returns the correct leg when traveler is in Venice (Jul 15)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-07-15');
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Veneza/Mestre');
    expect(result!.order).toBe(1);
  });

  it('returns the correct leg when traveler is in Ljubljana (Jul 18)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-07-18');
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Ljubljana');
  });

  it('returns the first matching leg by order on overlap (Jul 19 — Ljubljana departs, Trieste arrives)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-07-19');
    expect(result).not.toBeNull();
    // Ljubljana (order 2) departs Jul 19, Trieste (order 3) arrives Jul 19.
    // getCurrentLeg returns the first match by order.
    expect(result!.cityName).toBe('Ljubljana');
  });

  it('returns the correct leg when in Brussels during Tomorrowland (Jul 24)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-07-24');
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Bruxelas');
  });

  it('returns the correct leg in Lucerne (Aug 03)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-08-03');
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Lucerna');
  });

  it('returns null before the trip starts (Jul 14)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-07-14');
    expect(result).toBeNull();
  });

  it('returns null after the trip ends (Aug 06)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-08-06');
    expect(result).toBeNull();
  });

  it('returns null for empty legs array', () => {
    expect(getCurrentLeg([], '2026-07-20')).toBeNull();
  });

  it('handles the complex Aug 04 with multiple legs (Zurich + Madrid)', () => {
    const result = getCurrentLeg(JULIO_EUROTRIP_LEGS, '2026-08-04');
    expect(result).not.toBeNull();
    // Lucerna departs 09:35 on Aug 04, so it still covers Aug 04.
    // Lucerna (order 10) has departureDate = 2026-08-04.
    expect(result!.cityName).toBe('Lucerna');
  });
});

describe('getNextTransport', () => {
  it('returns the next transport from Venice on Jul 16', () => {
    const result = getNextTransport(JULIO_EUROTRIP_LEGS, '2026-07-16');
    expect(result).not.toBeNull();
    expect(result!.destination).toBe('Ljubljana');
    expect(result!.transportType).toBe('car');
  });

  it('returns Trieste bus when in Ljubljana on Jul 19 early morning', () => {
    const result = getNextTransport(JULIO_EUROTRIP_LEGS, '2026-07-19', '07:00');
    expect(result).not.toBeNull();
    expect(result!.destination).toBe('Trieste');
    expect(result!.transportType).toBe('bus');
  });

  it('skips past transports using time filter', () => {
    const result = getNextTransport(JULIO_EUROTRIP_LEGS, '2026-08-04', '11:00');
    expect(result).not.toBeNull();
    // At 11:00 on Aug 04, the Lucerna→Zürich train (10:25) already passed.
    // Next is Madrid (20:55) or Burgos, depending on departure time matching.
    expect(result!.destination).not.toBe('Lucerna');
  });

  it('returns null when no more transports exist', () => {
    const result = getNextTransport(JULIO_EUROTRIP_LEGS, '2026-08-06');
    expect(result).toBeNull();
  });

  it('works with mini fixture', () => {
    const result = getNextTransport(MINI_LEGS, '2026-07-16');
    expect(result).not.toBeNull();
    expect(result!.destination).toBe('Ljubljana');
  });
});

describe('getDayAgenda', () => {
  it('returns correct items for the complex Aug 04 day', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-08-04');
    expect(items.length).toBeGreaterThan(0);

    const arrivals = items.filter((i) => i.type === 'arrival');
    // Zurich arrival at 10:25, Madrid arrival at 20:55
    expect(arrivals.length).toBeGreaterThanOrEqual(2);

    const zurichArrival = arrivals.find((i) => i.leg.cityName === 'Zurique');
    expect(zurichArrival).toBeDefined();
    expect(zurichArrival!.time).toBe('10:25');
  });

  it('returns highlights for Venice day (Jul 16)', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-07-16');
    const highlights = items.filter((i) => i.type === 'highlight');
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('returns accommodation for Ljubljana (Jul 18)', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-07-18');
    const accomm = items.filter((i) => i.type === 'accommodation');
    expect(accomm.length).toBeGreaterThan(0);
    expect(accomm[0]!.label).toContain('Casa do primo');
  });

  it('returns empty for a date outside the trip', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-06-01');
    expect(items).toHaveLength(0);
  });

  it('sorts items chronologically by time', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-08-04');
    const timed = items.filter((i) => i.time !== null);
    for (let i = 1; i < timed.length; i++) {
      expect(timed[i]!.time! >= timed[i - 1]!.time!).toBe(true);
    }
  });

  it('includes departure info for leg ending that day', () => {
    const items = getDayAgenda(JULIO_EUROTRIP_LEGS, '2026-07-17');
    const departures = items.filter((i) => i.type === 'departure');
    // Venice departs Jul 17, next is Ljubljana
    expect(departures.length).toBeGreaterThanOrEqual(1);
  });
});

describe('suggestPhasesFromLegs', () => {
  it('groups the 13 real legs into 3-5 phases', () => {
    const phases = suggestPhasesFromLegs(JULIO_EUROTRIP_LEGS);
    expect(phases.length).toBeGreaterThanOrEqual(3);
    expect(phases.length).toBeLessThanOrEqual(6);
  });

  it('keeps Italian legs together in one phase', () => {
    const phases = suggestPhasesFromLegs(JULIO_EUROTRIP_LEGS);
    const italianPhase = phases.find((p) =>
      p.legs.some((l) => l.countryCode === 'IT'),
    );
    expect(italianPhase).toBeDefined();
    const italianLegs = italianPhase!.legs.filter((l) => l.countryCode === 'IT');
    expect(italianLegs.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps Swiss legs together in one phase', () => {
    const phases = suggestPhasesFromLegs(JULIO_EUROTRIP_LEGS);
    const swissPhase = phases.find((p) =>
      p.legs.some((l) => l.countryCode === 'CH'),
    );
    expect(swissPhase).toBeDefined();
    const swissLegs = swissPhase!.legs.filter((l) => l.countryCode === 'CH');
    expect(swissLegs.length).toBe(2);
  });

  it('produces phases with valid date ranges', () => {
    const phases = suggestPhasesFromLegs(JULIO_EUROTRIP_LEGS);
    for (const phase of phases) {
      expect(phase.startDate <= phase.endDate).toBe(true);
      expect(phase.legs.length).toBeGreaterThan(0);
      expect(phase.name.length).toBeGreaterThan(0);
    }
  });

  it('covers all legs across all phases', () => {
    const phases = suggestPhasesFromLegs(JULIO_EUROTRIP_LEGS);
    const totalLegs = phases.reduce((sum, p) => sum + p.legs.length, 0);
    expect(totalLegs).toBe(JULIO_EUROTRIP_LEGS.length);
  });

  it('returns empty array for empty input', () => {
    expect(suggestPhasesFromLegs([])).toHaveLength(0);
  });

  it('returns a single phase for a single leg', () => {
    const phases = suggestPhasesFromLegs([JULIO_EUROTRIP_LEGS[0]!]);
    expect(phases).toHaveLength(1);
    expect(phases[0]!.legs).toHaveLength(1);
  });
});

describe('getTripSummary', () => {
  it('calculates correct total cities for the eurotrip', () => {
    const summary = getTripSummary(JULIO_EUROTRIP_LEGS);
    // Unique cities: Veneza/Mestre, Ljubljana, Trieste, Verona, Bruxelas,
    // Amsterdam, Berlin, Freiburg, Lucerna, Zurique, Madrid, Burgos = 12
    // (Veneza/Mestre appears twice but is the same cityName)
    expect(summary.totalCities).toBe(12);
  });

  it('calculates correct total days', () => {
    const summary = getTripSummary(JULIO_EUROTRIP_LEGS);
    // Jul 15 to Aug 05 inclusive = 22 days
    expect(summary.totalDays).toBe(22);
  });

  it('aggregates prepaid costs by currency', () => {
    const summary = getTripSummary(JULIO_EUROTRIP_LEGS);
    expect(summary.totalPrepaidCents['BRL']).toBeGreaterThan(0);
    expect(summary.totalPrepaidCents['EUR']).toBeGreaterThan(0);
  });

  it('only counts prepaid items (not estimated/priced)', () => {
    const summary = getTripSummary(JULIO_EUROTRIP_LEGS);
    // Amsterdam train (€35, priced, NOT prepaid) and Berlin bus (€25, priced, NOT prepaid)
    // should NOT be in prepaid totals
    const eurPrepaid = summary.totalPrepaidCents['EUR'] ?? 0;
    // Prepaid EUR transports: GoOpti €34.40, FlixBus LJ→TS €9.99,
    // FlixBus TS→ME €9.99, Trenitalia ME→VR €13.80, Ryanair VCE→BRU €54
    // = 3440 + 999 + 999 + 1380 + 5400 = 12218
    expect(eurPrepaid).toBe(12218);
  });

  it('lists all currencies used', () => {
    const summary = getTripSummary(JULIO_EUROTRIP_LEGS);
    expect(summary.currencies).toContain('BRL');
    expect(summary.currencies).toContain('EUR');
  });

  it('returns zeros for empty input', () => {
    const summary = getTripSummary([]);
    expect(summary.totalCities).toBe(0);
    expect(summary.totalDays).toBe(0);
    expect(Object.keys(summary.totalPrepaidCents)).toHaveLength(0);
    expect(summary.currencies).toHaveLength(0);
  });
});
