import type { ItineraryLeg, DayType } from '@/domain/types/itinerary-leg';

export interface DayTypeStyle {
  bg: string;
  bgFaint: string;
  text: string;
  border: string;
  dot: string;
}

const DAY_TYPE_STYLES: Record<DayType, DayTypeStyle> = {
  full: { bg: 'bg-green-100 dark:bg-green-900/30', bgFaint: 'bg-green-50 dark:bg-green-950/20', text: 'text-green-700 dark:text-green-300', border: 'border-l-green-500', dot: 'bg-green-500' },
  transit: { bg: 'bg-blue-100 dark:bg-blue-900/30', bgFaint: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  festival: { bg: 'bg-purple-100 dark:bg-purple-900/30', bgFaint: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-l-purple-500', dot: 'bg-purple-500' },
  rest: { bg: 'bg-gray-100 dark:bg-gray-800/30', bgFaint: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400', border: 'border-l-gray-400', dot: 'bg-gray-400' },
  day_trip: { bg: 'bg-amber-100 dark:bg-amber-900/30', bgFaint: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-l-amber-500', dot: 'bg-amber-500' },
};

export function getDayTypeStyle(dayType: DayType): DayTypeStyle {
  return DAY_TYPE_STYLES[dayType] ?? DAY_TYPE_STYLES.full;
}

export interface NextTransport {
  leg: ItineraryLeg;
  departingFrom: string;
  destination: string;
  transportType: ItineraryLeg['arrivalTransport'] extends infer T
    ? T extends { type: infer U }
      ? U
      : never
    : never;
  time: string | null;
  date: string;
}

export interface DayAgendaItem {
  type: 'arrival' | 'departure' | 'accommodation' | 'highlight';
  time: string | null;
  label: string;
  leg: ItineraryLeg;
  detail: string | null;
}

export interface SuggestedPhase {
  name: string;
  startDate: string;
  endDate: string;
  legs: ItineraryLeg[];
}

export interface TripSummary {
  totalCities: number;
  totalDays: number;
  totalPrepaidCents: Record<string, number>;
  currencies: string[];
}

/**
 * Returns the leg where the traveler is on `today`.
 * A leg covers [arrivalDate, departureDate] inclusive.
 */
export function getCurrentLeg(
  legs: ItineraryLeg[],
  today: string,
): ItineraryLeg | null {
  const sorted = [...legs].sort((a, b) => a.order - b.order);
  for (const leg of sorted) {
    if (leg.arrivalDate <= today && leg.departureDate >= today) {
      return leg;
    }
  }
  return null;
}

/**
 * Returns the next transport the traveler needs to take from `today`/`now`
 * forward. Looks at the NEXT leg's arrivalTransport (the transport TO that leg).
 *
 * If `now` is provided (HH:MM), skips transports whose departure time has
 * already passed today.
 */
export function getNextTransport(
  legs: ItineraryLeg[],
  today: string,
  now?: string,
): NextTransport | null {
  const sorted = [...legs].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sorted.length; i++) {
    const leg = sorted[i]!;
    if (!leg.arrivalTransport) continue;

    const prevLeg = i > 0 ? sorted[i - 1]! : null;
    const departureDate = prevLeg?.departureDate ?? leg.arrivalDate;

    if (departureDate < today) continue;
    if (departureDate > today) {
      return {
        leg,
        departingFrom: prevLeg?.cityName ?? '?',
        destination: leg.cityName,
        transportType: leg.arrivalTransport.type,
        time: leg.arrivalTime,
        date: departureDate,
      };
    }

    // departureDate === today — check time if provided
    if (now && leg.arrivalTime && leg.arrivalTime <= now) continue;

    return {
      leg,
      departingFrom: prevLeg?.cityName ?? '?',
      destination: leg.cityName,
      transportType: leg.arrivalTransport.type,
      time: leg.arrivalTime,
      date: departureDate,
    };
  }

  return null;
}

/**
 * Builds a chronological agenda for a specific date, gathering arrival
 * transports, departures, accommodation info, and highlights from all legs
 * that overlap that date.
 */
export function getDayAgenda(
  legs: ItineraryLeg[],
  date: string,
): DayAgendaItem[] {
  const items: DayAgendaItem[] = [];
  const sorted = [...legs].sort((a, b) => a.order - b.order);

  for (const leg of sorted) {
    if (leg.arrivalDate > date || leg.departureDate < date) continue;

    if (leg.arrivalDate === date && leg.arrivalTransport) {
      items.push({
        type: 'arrival',
        time: leg.arrivalTime,
        label: `${leg.arrivalTransport.type === 'flight' ? '✈️' : '🚂'} ${leg.arrivalTransport.route ?? `→ ${leg.cityName}`}`,
        leg,
        detail: leg.arrivalTransport.company,
      });
    }

    if (leg.accommodation && leg.arrivalDate <= date && leg.departureDate >= date) {
      items.push({
        type: 'accommodation',
        time: null,
        label: `🏠 ${leg.accommodation.name}`,
        leg,
        detail: leg.accommodation.type,
      });
    }

    for (const highlight of leg.highlights) {
      items.push({
        type: 'highlight',
        time: null,
        label: highlight,
        leg,
        detail: null,
      });
    }

    if (leg.departureDate === date) {
      const nextLeg = sorted.find((l) => l.order === leg.order + 1);
      if (nextLeg?.arrivalTransport) {
        items.push({
          type: 'departure',
          time: leg.departureTime,
          label: `Departure → ${nextLeg.cityName}`,
          leg,
          detail: nextLeg.arrivalTransport.type,
        });
      }
    }
  }

  items.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  return items;
}

/**
 * Groups legs into suggested phases based on geographic/temporal proximity.
 *
 * Algorithm:
 * 1. Split on country changes → many small groups.
 * 2. Merge small groups (≤ 2 legs) into the adjacent group they touch
 *    temporally, until every group has ≥ 3 legs or no more merges are possible.
 */
export function suggestPhasesFromLegs(legs: ItineraryLeg[]): SuggestedPhase[] {
  if (legs.length === 0) return [];

  const sorted = [...legs].sort((a, b) => a.order - b.order);

  // Step 1: group consecutive same-country legs
  const groups: ItineraryLeg[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const sameCountry =
      prev.countryCode !== null &&
      curr.countryCode !== null &&
      prev.countryCode === curr.countryCode;

    if (sameCountry) {
      groups[groups.length - 1]!.push(curr);
    } else {
      groups.push([curr]);
    }
  }

  // Step 2: iteratively merge the smallest group into its smaller neighbor
  while (groups.length > 1) {
    let smallestIdx = -1;
    let smallestSize = Infinity;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i]!.length < smallestSize) {
        smallestSize = groups[i]!.length;
        smallestIdx = i;
      }
    }
    if (smallestSize >= 3) break;

    const leftSize = smallestIdx > 0 ? groups[smallestIdx - 1]!.length : Infinity;
    const rightSize = smallestIdx < groups.length - 1 ? groups[smallestIdx + 1]!.length : Infinity;

    if (leftSize === Infinity && rightSize === Infinity) break;

    if (leftSize <= rightSize) {
      groups[smallestIdx - 1]!.push(...groups[smallestIdx]!);
      groups.splice(smallestIdx, 1);
    } else {
      groups[smallestIdx + 1]!.unshift(...groups[smallestIdx]!);
      groups.splice(smallestIdx, 1);
    }
  }

  return groups.map(buildPhase);
}

function buildPhase(groupLegs: ItineraryLeg[]): SuggestedPhase {
  const cities = [...new Set(groupLegs.map((l) => l.cityName))];
  const countries = [...new Set(groupLegs.map((l) => l.countryCode).filter(Boolean))];
  const startDate = groupLegs[0]!.arrivalDate;
  const endDate = groupLegs[groupLegs.length - 1]!.departureDate;

  let name: string;
  if (cities.length <= 2) {
    name = cities.join(' + ');
  } else {
    name = countries.length === 1 && countries[0]
      ? countries[0]
      : cities.slice(0, 2).join(', ') + ` +${cities.length - 2}`;
  }

  return { name, startDate, endDate, legs: groupLegs };
}

export interface LegSpendSummary {
  totalSpentCents: number;
  budgetCents: number | null;
  currency: string | null;
  percent: number | null;
}

/**
 * Computes how much was spent during a leg's date range.
 * Transactions are matched by date overlap [arrivalDate, departureDate].
 */
export function getLegSpend(
  leg: ItineraryLeg,
  transactions: { date: string; amountCents: number; currency: string }[],
  baseCurrency: string,
): LegSpendSummary {
  const spent = transactions
    .filter((tx) => tx.date >= leg.arrivalDate && tx.date <= leg.departureDate && tx.currency === baseCurrency)
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  const days = Math.max(
    1,
    Math.round((new Date(leg.departureDate).getTime() - new Date(leg.arrivalDate).getTime()) / 86400000) + 1,
  );
  const budgetCents = leg.dailyBudgetCents !== null ? leg.dailyBudgetCents * days : null;
  const percent = budgetCents !== null && budgetCents > 0 ? Math.round((spent / budgetCents) * 100) : null;

  return {
    totalSpentCents: spent,
    budgetCents,
    currency: leg.dailyBudgetCurrency ?? baseCurrency,
    percent,
  };
}

// ---------------------------------------------------------------------------
// P14 — Transport reminder scheduling
// ---------------------------------------------------------------------------

export interface SchedulableTransport {
  legId: string;
  departureIso: string;
  destination: string;
  departingFrom: string;
  transportType: string;
  time: string;
}

/**
 * Returns future transports that have a concrete departure datetime (date + time),
 * suitable for scheduling reminder notifications. Past transports are excluded.
 */
export function getSchedulableTransports(
  legs: ItineraryLeg[],
  nowIso: string,
): SchedulableTransport[] {
  const sorted = [...legs].sort((a, b) => a.order - b.order);
  const results: SchedulableTransport[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const leg = sorted[i]!;
    if (!leg.arrivalTransport) continue;

    const prevLeg = i > 0 ? sorted[i - 1]! : null;
    const departureDate = prevLeg?.departureDate ?? leg.arrivalDate;
    const departureTime = prevLeg?.departureTime ?? leg.arrivalTime;

    if (!departureTime) continue;

    const departureIso = `${departureDate}T${departureTime}`;
    if (departureIso <= nowIso) continue;

    results.push({
      legId: leg.id,
      departureIso,
      destination: leg.cityName,
      departingFrom: prevLeg?.cityName ?? '?',
      transportType: leg.arrivalTransport.type,
      time: departureTime,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// P15 — Itinerary share text
// ---------------------------------------------------------------------------

const TRANSPORT_EMOJI: Record<string, string> = {
  flight: '✈️',
  train: '🚂',
  bus: '🚌',
  car: '🚗',
  ferry: '⛴️',
  walk: '🚶',
  other: '🚀',
};

const ACCOMMODATION_EMOJI: Record<string, string> = {
  hotel: '🏨',
  hostel: '🏠',
  apartment: '🏢',
  friend: '🏡',
  airbnb: '🏠',
  camping: '⛺',
  other: '🏠',
};

function formatDateRange(arrival: string, departure: string): string {
  const a = new Date(arrival + 'T00:00:00');
  const d = new Date(departure + 'T00:00:00');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const aDay = a.getDate();
  const dDay = d.getDate();
  const aMonth = months[a.getMonth()]!;
  const dMonth = months[d.getMonth()]!;
  if (aMonth === dMonth) return `${aDay}-${dDay} ${aMonth}`;
  return `${aDay} ${aMonth}-${dDay} ${dMonth}`;
}

export function formatItineraryShareText(
  tripName: string,
  legs: ItineraryLeg[],
): string {
  const sorted = [...legs].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return '';

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const headerRange = formatDateRange(first.arrivalDate, last.departureDate);
  const lines: string[] = [`🗺️ ${tripName} — ${headerRange}`, ''];

  for (const leg of sorted) {
    const range = formatDateRange(leg.arrivalDate, leg.departureDate);
    let line = `📍 ${leg.cityName} (${range})`;

    if (leg.arrivalTransport) {
      const emoji = TRANSPORT_EMOJI[leg.arrivalTransport.type] ?? '🚀';
      const parts = [emoji];
      if (leg.arrivalTransport.company) parts.push(leg.arrivalTransport.company);
      if (leg.arrivalTransport.route) parts.push(leg.arrivalTransport.route);
      line += ` · ${parts.join(' ')}`;
    }

    if (leg.accommodation) {
      const emoji = ACCOMMODATION_EMOJI[leg.accommodation.type] ?? '🏠';
      line += ` · ${emoji} ${leg.accommodation.name}`;
    }

    lines.push(line);
  }

  lines.push('');
  lines.push('Gerado por TripPilot · trippilot.pages.dev');

  return lines.join('\n');
}

/**
 * Computes a quick summary of the full itinerary.
 */
export function getTripSummary(legs: ItineraryLeg[]): TripSummary {
  if (legs.length === 0) {
    return { totalCities: 0, totalDays: 0, totalPrepaidCents: {}, currencies: [] };
  }

  const sorted = [...legs].sort((a, b) => a.order - b.order);
  const cities = new Set(sorted.map((l) => l.cityName));
  const currencySet = new Set<string>();
  const prepaid: Record<string, number> = {};

  const firstDate = new Date(sorted[0]!.arrivalDate).getTime();
  const lastDate = new Date(sorted[sorted.length - 1]!.departureDate).getTime();
  const totalDays = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  for (const leg of sorted) {
    if (leg.dailyBudgetCurrency) currencySet.add(leg.dailyBudgetCurrency);

    if (leg.arrivalTransport) {
      if (leg.arrivalTransport.costCurrency) currencySet.add(leg.arrivalTransport.costCurrency);
      if (leg.arrivalTransport.isPrepaid && leg.arrivalTransport.costCents !== null && leg.arrivalTransport.costCurrency) {
        prepaid[leg.arrivalTransport.costCurrency] =
          (prepaid[leg.arrivalTransport.costCurrency] ?? 0) + leg.arrivalTransport.costCents;
      }
    }

    if (leg.accommodation) {
      if (leg.accommodation.costCurrency) currencySet.add(leg.accommodation.costCurrency);
      if (leg.accommodation.isPrepaid && leg.accommodation.costCents !== null && leg.accommodation.costCurrency) {
        prepaid[leg.accommodation.costCurrency] =
          (prepaid[leg.accommodation.costCurrency] ?? 0) + leg.accommodation.costCents;
      }
    }
  }

  return {
    totalCities: cities.size,
    totalDays,
    totalPrepaidCents: prepaid,
    currencies: [...currencySet].sort(),
  };
}
