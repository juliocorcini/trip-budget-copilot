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
  points.sort(compareMapPoints);
  return points;
}

/**
 * Stable ordering shared by the place list and the cluster aggregator: biggest
 * spend first, then most spends, then a geographic tiebreak. Keeping it in one
 * place means a combined cluster reads its spends in the same order as the map.
 */
function compareMapPoints(a: ExpenseMapPoint, b: ExpenseMapPoint): number {
  return b.totalCents - a.totalCents || b.count - a.count || a.lat - b.lat || a.lng - b.lng;
}

/**
 * DEC-429 (Field v2 D04) — the PURE cluster aggregator. When the traveler HOLDS a
 * cluster bubble (long-press), Leaflet hands us that bubble's child markers; this
 * folds their `ExpenseMapPoint`s into ONE so the exact same paginated sheet can
 * list every spend under the bubble with a combined total. Kept map/DOM-free so it
 * is deterministic and unit-testable.
 *
 * Honesty rules:
 *  - the combined coordinate REUSES a real child's coords (the top place), never a
 *    synthetic midpoint — Â-PLACE-REAL (the map never invents a location);
 *  - money is a plain SUM of the children's base-currency totals (no re-derivation);
 *  - `txIds` concatenate in the shared order (child groups are disjoint, so no dupes);
 *  - a cluster spans multiple places, so it carries no single place `label` (null →
 *    the sheet shows its neutral fallback title).
 */
export function combineMapPoints(points: ExpenseMapPoint[]): ExpenseMapPoint | null {
  if (points.length === 0) return null;
  const ordered = [...points].sort(compareMapPoints);
  if (ordered.length === 1) return ordered[0]!;

  const representative = ordered[0]!;
  let totalCents = 0;
  let count = 0;
  const txIds: string[] = [];
  for (const point of ordered) {
    totalCents += point.totalCents;
    count += point.count;
    txIds.push(...point.txIds);
  }

  return {
    lat: representative.lat,
    lng: representative.lng,
    count,
    totalCents,
    txIds,
    label: null,
  };
}
