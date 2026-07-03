import type { TransactionPlaceFields } from './location';

/**
 * DEC-367 (G8) — pure location resolution for the expense save + detail.
 *
 * Two responsibilities, both pure (the UI does the async GPS/reverse-geocode and
 * passes the results in):
 *  - `resolveSaveLocation`: decide the stored place fields at save time. A point
 *    is stamped on EVERY expense (even with "detalhes" closed); a name the app
 *    reverse-geocoded automatically is kept as PROBABLE (`placeNameSource:'auto'`,
 *    rendered "provavelmente {name}"), while a name the traveler chose in
 *    "detalhes" is `'user'` (verified). Coords never leave the device.
 *  - `resolveLocationDisplay`: decide what the detail screen shows — whether a
 *    map renders and which caption (probable / confirmed / approximate / none).
 */

export interface SaveLocationFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: string;
}

export interface SaveLocationInput {
  /** Whether the traveler had "detalhes" open (i.e. could confirm the place). */
  detailsOpen: boolean;
  /** The place chosen/inherited via the UI, mapped to transaction fields. */
  chosen: TransactionPlaceFields;
  /** A best-effort GPS fix captured on the save path (null when unavailable). */
  fix: SaveLocationFix | null;
  /** A best-effort PROBABLE reverse-geocoded name (null when none/offline). */
  autoName: { label: string; placeId: string | null } | null;
}

export interface SaveLocationFields {
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  placeNameSource: 'auto' | 'user' | null;
  locationAccuracy: number | null;
  locationCapturedAt: string | null;
}

/** A name is verified only when the traveler saw "detalhes" and a label exists. */
function sourceForChosenLabel(label: string | null, detailsOpen: boolean): 'auto' | 'user' | null {
  if (!label || label.trim() === '') return null;
  return detailsOpen ? 'user' : 'auto';
}

export function resolveSaveLocation(input: SaveLocationInput): SaveLocationFields {
  const { detailsOpen, chosen, fix, autoName } = input;

  // 1) The traveler chose/inherited a place WITH coordinates → keep it as-is.
  if (chosen.latitude !== null && chosen.longitude !== null) {
    return {
      placeLabel: chosen.placeLabel,
      latitude: chosen.latitude,
      longitude: chosen.longitude,
      placeId: chosen.placeId,
      placeNameSource: sourceForChosenLabel(chosen.placeLabel, detailsOpen),
      locationAccuracy: null,
      locationCapturedAt: null,
    };
  }

  // 2) No chosen coords, but a fresh fix was captured on save → stamp the point
  //    and attach a PROBABLE name when one was reverse-geocoded.
  if (fix) {
    const hasAutoName = autoName !== null && autoName.label.trim() !== '';
    return {
      placeLabel: hasAutoName ? autoName!.label : chosen.placeLabel,
      latitude: fix.lat,
      longitude: fix.lng,
      placeId: hasAutoName ? autoName!.placeId : chosen.placeId,
      placeNameSource: hasAutoName ? 'auto' : sourceForChosenLabel(chosen.placeLabel, detailsOpen),
      locationAccuracy: fix.accuracy,
      locationCapturedAt: fix.capturedAt,
    };
  }

  // 3) No coordinates at all — a manual name (or nothing).
  return {
    placeLabel: chosen.placeLabel,
    latitude: null,
    longitude: null,
    placeId: chosen.placeId,
    placeNameSource: sourceForChosenLabel(chosen.placeLabel, detailsOpen),
    locationAccuracy: null,
    locationCapturedAt: null,
  };
}

/**
 * Field v2.1 (DEC-434): after a background forward-geocode resolves a spend to a
 * real venue, decide the stored label. A name the TRAVELER verified in "detalhes"
 * (`placeNameSource:'user'`) is sacred and kept; anything app-derived (an imported
 * merchant/city label, `'auto'`, or none) is UPGRADED to the resolved OSM venue
 * name — so a Wise row that read "Burgos" (the city) becomes the actual place.
 * Pure; the async lookup + persistence stay in the caller (stamp boundary).
 */
export function chooseGeocodedLabel(input: {
  currentLabel: string | null;
  currentSource: 'auto' | 'user' | null;
  resolvedLabel: string;
}): { placeLabel: string; placeNameSource: 'auto' | 'user' } {
  const userVerified = input.currentSource === 'user' && (input.currentLabel ?? '').trim() !== '';
  return userVerified
    ? { placeLabel: input.currentLabel!.trim(), placeNameSource: 'user' }
    : { placeLabel: input.resolvedLabel, placeNameSource: 'auto' };
}

export interface LocationDisplayInput {
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  placeNameSource?: 'auto' | 'user' | null;
}

export type LocationCaption =
  | { kind: 'probable'; name: string }
  | { kind: 'named'; name: string }
  | { kind: 'approx' }
  | { kind: 'none' };

export interface LocationDisplay {
  hasMap: boolean;
  caption: LocationCaption;
}

export function resolveLocationDisplay(input: LocationDisplayInput): LocationDisplay {
  const hasMap = input.latitude !== null && input.longitude !== null;
  const name = (input.placeLabel ?? '').trim();

  let caption: LocationCaption;
  if (name !== '') {
    caption =
      input.placeNameSource === 'auto' ? { kind: 'probable', name } : { kind: 'named', name };
  } else if (hasMap) {
    caption = { kind: 'approx' };
  } else {
    caption = { kind: 'none' };
  }

  return { hasMap, caption };
}
