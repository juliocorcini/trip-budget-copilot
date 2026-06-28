import { resolveSaveLocation } from '@/domain/location';
import { transactionRepository } from '@/data/repositories';
import { notifyAppDataChanged } from '@/hooks/useAppData';
import { getCurrentFix } from '@/utils/geolocation';
import { reverseGeocodePlace, searchPlaceByName } from '@/utils/places';
import type { Transaction } from '@/domain/types/transaction';

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
