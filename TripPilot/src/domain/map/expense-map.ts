import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-416 (G11) — "spends on the map". The PURE aggregator behind the `/mapa`
 * screen: it turns the trip's transactions into map points, one per place, each
 * carrying how many spends landed there and their combined total. The UI (a lazy
 * Leaflet + markercluster page) only draws these points and clusters them by
 * zoom — all the "which spends, how much, where" truth lives here so it is
 * deterministic and unit-testable, with no map/DOM dependency.
 *
 * Rules that keep the map honest:
 *  - only `expense` transactions (a transfer/settlement/income is not a spend);
 *  - only REAL coordinates (never an invented point — Â-PLACE-REAL);
 *  - soft-deleted rows are ignored;
 *  - the total is summed in BASE currency (`baseCurrencyAmountCents`) so points
 *    that mix currencies still add up to one comparable number.
 */
export interface ExpenseMapPoint {
  /** Representative coordinate for the place (the first spend's real coords). */
  lat: number;
  lng: number;
  /** How many spends happened here. */
  count: number;
  /** Combined spend at this place, in BASE-currency cents (cross-currency safe). */
  totalCents: number;
  /** The spends' transaction ids, newest first — feeds the tap → list sheet. */
  txIds: string[];
  /** A place name to show, preferring a user-confirmed one; null when unknown. */
  label: string | null;
}

/** A transaction is mappable only with finite, present coordinates. */
function hasRealCoords(tx: Transaction): tx is Transaction & { latitude: number; longitude: number } {
  return (
    tx.latitude != null &&
    tx.longitude != null &&
    Number.isFinite(tx.latitude) &&
    Number.isFinite(tx.longitude)
  );
}

interface PointAccumulator {
  lat: number;
  lng: number;
  totalCents: number;
  entries: { id: string; date: string }[];
  userLabel: string | null;
  anyLabel: string | null;
}

/**
 * Group key: spends at the SAME resolved place (`placeId`) collapse into one
 * point; without a placeId they collapse only when the exact coordinate matches
 * (a manually dropped pin). Nearby-but-distinct points are then merged visually
 * by the marker cluster at each zoom level — not here.
 */
function groupKey(tx: Transaction & { latitude: number; longitude: number }): string {
  return tx.placeId ?? `${tx.latitude},${tx.longitude}`;
}

export function buildExpenseMapPoints(transactions: Transaction[]): ExpenseMapPoint[] {
  const groups = new Map<string, PointAccumulator>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.deletedAt != null) continue;
    if (!hasRealCoords(tx)) continue;

    const key = groupKey(tx);
    const existing = groups.get(key);
    if (existing) {
      existing.totalCents += tx.baseCurrencyAmountCents;
      existing.entries.push({ id: tx.id, date: tx.date });
      if (tx.placeLabel) {
        existing.anyLabel ??= tx.placeLabel;
        if (tx.placeNameSource === 'user') existing.userLabel ??= tx.placeLabel;
      }
    } else {
      groups.set(key, {
        lat: tx.latitude,
        lng: tx.longitude,
        totalCents: tx.baseCurrencyAmountCents,
        entries: [{ id: tx.id, date: tx.date }],
        userLabel: tx.placeLabel && tx.placeNameSource === 'user' ? tx.placeLabel : null,
        anyLabel: tx.placeLabel ?? null,
      });
    }
  }

  const points: ExpenseMapPoint[] = [];
  for (const acc of groups.values()) {
    const txIds = [...acc.entries]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((e) => e.id);
    points.push({
      lat: acc.lat,
      lng: acc.lng,
      count: acc.entries.length,
      totalCents: acc.totalCents,
      txIds,
      label: acc.userLabel ?? acc.anyLabel,
    });
  }

  // Biggest spend first (then most spends, then a stable geographic tiebreak) so
  // the list and any "top places" read the same way on every render.
  points.sort(
    (a, b) =>
      b.totalCents - a.totalCents ||
      b.count - a.count ||
      a.lat - b.lat ||
      a.lng - b.lng,
  );
  return points;
}
