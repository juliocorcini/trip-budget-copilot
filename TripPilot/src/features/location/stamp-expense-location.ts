import { resolveSaveLocation } from '@/domain/location';
import { transactionRepository } from '@/data/repositories';
import { notifyAppDataChanged } from '@/hooks/useAppData';
import { getCurrentFix } from '@/utils/geolocation';
import { isOnline, reverseGeocodePlace, searchPlaceByName } from '@/utils/places';
import type { Transaction } from '@/domain/types/transaction';

/** DEC-419 (G3): Nominatim asks for ≤1 request/second; keep a safe margin. */
const IMPORT_GEOCODE_INTERVAL_MS = 1100;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * DEC-367 (G8) + DEC-389 (G5): the shared, best-effort BACKGROUND location stamp
 * for a just-saved expense, used by BOTH the manual QuickAdd save and the AI
 * dispatch flow so they behave identically (QuickAdd parity).
 *
 * Captures the current GPS fix; when the expense already carries a NAME (AI- or
 * user-captured) it FORWARD-geocodes that name to the exact venue coordinates
 * (biased by the fix), so the spend lands on the real place rather than just the
 * GPS reading — a miss falls back to the GPS point and keeps the name. When the
 * expense has NO name yet, it REVERSE-geocodes a PROBABLE name from the fix.
 * Patches the saved record and signals the app. Never throws / never blocks the
 * save (the network boundary itself resolves null on offline/timeout/error), so
 * the #1 action stays instant (A5). Coordinates leave the device only for these
 * explicit lookups (ÂNCORA 8).
 */
export async function stampExpenseLocation(saved: Transaction, detailsOpen: boolean): Promise<void> {
  const fix = await getCurrentFix();
  const hasName = saved.placeLabel !== null && saved.placeLabel.trim() !== '';

  // DEC-389 (G5): resolve the captured name to its real coordinates, biased by
  // the current fix. A hit pins the venue; a miss leaves coords null → the GPS
  // fix below stamps the point instead (fallback), keeping the name as-is.
  let chosen = {
    placeLabel: saved.placeLabel,
    latitude: null as number | null,
    longitude: null as number | null,
    placeId: saved.placeId,
  };
  if (hasName) {
    const named = await searchPlaceByName(saved.placeLabel!, fix ? { lat: fix.lat, lng: fix.lng } : null);
    if (named) {
      chosen = {
        placeLabel: saved.placeLabel,
        latitude: named.lat,
        longitude: named.lng,
        placeId: named.placeId,
      };
    }
  }

  // Nothing to stamp when neither the name resolved to coords nor a GPS fix was
  // captured (keeps the manual name untouched).
  if (chosen.latitude === null && !fix) return;

  const autoName = !hasName && fix ? await reverseGeocodePlace({ lat: fix.lat, lng: fix.lng }) : null;
  const loc = resolveSaveLocation({
    detailsOpen,
    chosen,
    fix,
    autoName,
  });
  await transactionRepository.update({ ...saved, ...loc });
  notifyAppDataChanged();
}

/**
 * DEC-395 (G5 · W-PLACE): forward-geocode just-imported Wise expenses to their
 * venue, reusing the SAME Nominatim forward geocoder as the manual/AI save
 * (`searchPlaceByName`, DEC-389) so the import gains place parity. The query is
 * the merchant DESCRIPTION (the Wise statement names the merchant — e.g.
 * "MERCADONA LISBOA" — far more reliably than the extracted city), falling back
 * to the city label when there is no description.
 *
 * Best-effort and honest: opt-in only, online-only (the geocoder resolves null
 * offline), never throws, and runs in the BACKGROUND so the import never blocks
 * (A5). Unlike the live save it does NOT fall back to the current GPS fix — a
 * statement is imported later and elsewhere, so the device's "now" location is
 * not the venue; a miss simply leaves the row unlocated (it never wrong-pins a
 * historical purchase at home). Only un-located expenses are touched; the stored
 * label is kept, and a resolved name fills in only when the row had none.
 */
export async function stampImportedExpenseLocations(
  transactions: Transaction[],
  locationEnabled: boolean,
): Promise<void> {
  if (!locationEnabled || !isOnline()) return;
  let changed = false;
  let requested = false;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.latitude !== null) continue;
    const query = (tx.description ?? '').trim() || (tx.placeLabel ?? '').trim();
    if (query === '') continue;
    // DEC-419 (G3): space the lookups out so a multi-row import is not throttled or
    // blocked by Nominatim's ~1 req/s policy. Background-only — the import already
    // returned, so the pause is invisible to the user (A5, never blocks).
    if (requested) await sleep(IMPORT_GEOCODE_INTERVAL_MS);
    requested = true;
    const place = await searchPlaceByName(query, null);
    if (!place) continue;
    const hadLabel = tx.placeLabel !== null && tx.placeLabel.trim() !== '';
    await transactionRepository.update({
      ...tx,
      latitude: place.lat,
      longitude: place.lng,
      placeId: place.placeId,
      placeLabel: hadLabel ? tx.placeLabel : place.label,
      placeNameSource: hadLabel ? tx.placeNameSource ?? null : 'auto',
    });
    changed = true;
  }
  if (changed) notifyAppDataChanged();
}
