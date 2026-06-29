import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  shouldReaskPlace,
  coordsLabel,
  deriveRecentPlaces,
  toCurrentPlace,
} from '@/domain/location';
import type { RecentPlace, NearbyPlace, Coords } from '@/domain/location';
import { getCurrentCoords } from '@/utils/geolocation';
import { reverseGeocodePlace, searchNearbyPlaces, searchPlacesByName, isOnline } from '@/utils/places';
import type { NamedPlaceResult } from '@/utils/places';
import { NearbyPlaceList } from '@/components/NearbyPlaceList';
import { Icon } from '@/components/Icon';
import type { CurrentPlace } from '@/domain/types/common';
import type { Transaction } from '@/domain/types/transaction';

export interface PlaceFieldProps {
  /** The chosen place — owned by the parent (controlled). */
  value: CurrentPlace | null;
  onChange: (place: CurrentPlace | null) => void;
  /** Category drives the nearby-establishment search. */
  category: string;
  /** Trip history — the source of the offline "recent places" chips. */
  transactions: Transaction[];
  /**
   * QuickAdd (true): capture the current GPS fix once on open and seed the place
   * — "now" is "then" for a fresh expense. Edit (false): never auto-capture (the
   * expense happened elsewhere/earlier); the traveler opts in with "use my
   * location", and any saved coordinates still power nearby + find-online.
   */
  autoCapture: boolean;
  /**
   * Gates the GPS/online features (auto-capture, the use-my-location button,
   * nearby search, find-name-online). Rename / clear / recents always work so
   * the field fully replaces a plain text input even with location off.
   */
  locationFeaturesEnabled: boolean;
  /** QuickAdd's sticky place — used only by the on-open capture comparison. */
  rememberedPlace?: CurrentPlace | null;
}

/**
 * D-BUG-08: the place selector lifted out of QuickAdd so the expense-edit screen
 * gets the same apparatus (use my location, nearby, find online, recents) instead
 * of a bare text box. Controlled — the parent owns the {@link CurrentPlace}; this
 * component owns only the transient GPS/nearby/edit UI state. The raw GPS fix
 * never leaves the device (ÂNCORA 8); only the chosen name is persisted upstream.
 */
export function PlaceField({
  value,
  onChange,
  category,
  transactions,
  autoCapture,
  locationFeaturesEnabled,
  rememberedPlace = null,
}: PlaceFieldProps) {
  const { t } = useTranslation();
  const [editingPlace, setEditingPlace] = useState(false);
  const [placeLabelInput, setPlaceLabelInput] = useState('');
  const [findingName, setFindingName] = useState(false);
  const [locating, setLocating] = useState(false);
  // Edit mode seeds the GPS fix from the saved coordinates so nearby/find-online
  // work immediately; QuickAdd starts empty and captures the live fix on open.
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(() =>
    !autoCapture && locationFeaturesEnabled && value?.lat != null && value?.lng != null
      ? { lat: value.lat, lng: value.lng }
      : null,
  );
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  // DEC-405 (G5): forward-geocode the typed name to real venues.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NamedPlaceResult[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const placeCapturedRef = useRef(false);
  const nearbyKeyRef = useRef<string | null>(null);
  // The one-shot capture effect reads the freshest place without re-running.
  const valueRef = useRef(value);
  valueRef.current = value;

  // M2/M3: capture coordinates once on open (QuickAdd only). Best-effort — never
  // blocks; keeps the current place while still in the area, re-asks after a move.
  useEffect(() => {
    if (!autoCapture || !locationFeaturesEnabled || placeCapturedRef.current) return;
    placeCapturedRef.current = true;
    let active = true;
    void getCurrentCoords().then((coords) => {
      if (!active || coords === null) return;
      setGpsCoords(coords);
      const current = valueRef.current ?? rememberedPlace ?? null;
      if (!shouldReaskPlace(current, coords)) {
        if (current !== valueRef.current) onChange(current);
        return;
      }
      onChange({ label: coordsLabel(coords), lat: coords.lat, lng: coords.lng, placeId: null });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCapture, locationFeaturesEnabled]);

  // M4 (nearby): with a GPS fix + a connection, auto-list the category's nearby
  // establishments (online-only). The closest is pre-selected ONLY while the place
  // is still the raw coordinate placeholder, so a typed/picked name is never lost.
  useEffect(() => {
    if (!locationFeaturesEnabled || gpsCoords === null || !isOnline()) {
      setNearbyPlaces([]);
      return;
    }
    const key = `${gpsCoords.lat.toFixed(4)},${gpsCoords.lng.toFixed(4)}:${category}`;
    if (nearbyKeyRef.current === key) return;
    nearbyKeyRef.current = key;

    let active = true;
    setLoadingNearby(true);
    void searchNearbyPlaces(gpsCoords, category)
      .then((list) => {
        if (!active) return;
        setNearbyPlaces(list);
        if (list.length === 0) return;
        const placeholderLabel = coordsLabel(gpsCoords);
        const prev = valueRef.current;
        const isPlaceholder =
          prev === null || (prev.placeId === null && prev.label === placeholderLabel);
        if (!isPlaceholder) return;
        const closest = list[0]!;
        onChange({
          label: closest.label,
          lat: closest.lat,
          lng: closest.lng,
          placeId: closest.placeId,
        });
      })
      .finally(() => {
        if (active) setLoadingNearby(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFeaturesEnabled, gpsCoords, category]);

  // DEC-405 (G5): forward-geocode the typed name to real venues (debounced,
  // opt-in, online-only). Best-effort — never blocks; offline/empty/short query
  // simply yields no results. Biased to the current fix (or the saved coords) so
  // a common name resolves to the local venue.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!locationFeaturesEnabled || !isOnline() || query.length < 3) {
      setSearchResults([]);
      setSearchingPlace(false);
      return;
    }
    let active = true;
    setSearchingPlace(true);
    const handle = setTimeout(() => {
      const current = valueRef.current;
      const near =
        gpsCoords ??
        (current?.lat != null && current?.lng != null
          ? { lat: current.lat, lng: current.lng }
          : null);
      void searchPlacesByName(query, near, 6)
        .then((list) => {
          if (active) setSearchResults(list);
        })
        .finally(() => {
          if (active) setSearchingPlace(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, locationFeaturesEnabled, gpsCoords]);

  // M4: recent places derived purely from history (offline), nearest first when
  // the current place has coordinates, else by recency.
  const placeCoords =
    value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null;
  const recentPlaces = deriveRecentPlaces(transactions, placeCoords);
  const recentSuggestions = recentPlaces.filter((rp) => rp.label !== value?.label);
  const canFindName = locationFeaturesEnabled && placeCoords !== null && isOnline();
  const nearbySuggestions = nearbyPlaces.filter(
    (np) => np.placeId !== value?.placeId && np.label !== value?.label,
  );

  const startRenamePlace = () => {
    setPlaceLabelInput(value?.label ?? '');
    setEditingPlace(true);
  };

  const confirmRenamePlace = () => {
    const label = placeLabelInput.trim();
    if (label !== '') {
      // Typing a name works even without GPS (coordinates stay null).
      onChange(value ? { ...value, label } : { label, lat: null, lng: null, placeId: null });
    }
    setEditingPlace(false);
  };

  const clearPlace = () => {
    onChange(null);
    setEditingPlace(false);
  };

  const applyRecentPlace = (recent: RecentPlace) => {
    onChange(toCurrentPlace(recent));
    setEditingPlace(false);
  };

  const applyNearbyPlace = (nearby: NearbyPlace) => {
    onChange({ label: nearby.label, lat: nearby.lat, lng: nearby.lng, placeId: nearby.placeId });
    setEditingPlace(false);
  };

  // DEC-405 (G5): a searched venue carries real coordinates — save them so the
  // expense lands on the actual place, not a loose string.
  const applySearchedPlace = (place: NamedPlaceResult) => {
    onChange({ label: place.label, lat: place.lat, lng: place.lng, placeId: place.placeId });
    setSearchQuery('');
    setSearchResults([]);
    setEditingPlace(false);
  };

  // Edit mode: opt into the live location on demand (the expense may be happening
  // where the traveler is right now). Seeds the placeholder, then nearby resolves.
  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      if (coords === null) return;
      setGpsCoords(coords);
      onChange({ label: coordsLabel(coords), lat: coords.lat, lng: coords.lng, placeId: null });
    } finally {
      setLocating(false);
    }
  };

  // M4: resolve a real name for the current coordinates (opt-in, online-only).
  const findNameOnline = async () => {
    if (placeCoords === null || findingName) return;
    setFindingName(true);
    try {
      const result = await reverseGeocodePlace(placeCoords);
      if (result !== null) {
        onChange(value ? { ...value, label: result.label, placeId: result.placeId } : value);
      }
    } finally {
      setFindingName(false);
    }
  };

  const showUseMyLocation = locationFeaturesEnabled && !autoCapture;
  // DEC-405 (G5): name search needs the network; the field itself stays usable
  // offline (rename/recents), so this only gates the search affordance.
  const searchEnabled = locationFeaturesEnabled && isOnline();
  const trimmedQuery = searchQuery.trim();

  return (
    <div className="bg-surface-container rounded-xl p-4">
      <label className="text-xs text-on-surface-faint mb-1 block">
        {t('expenses.location_label')}
      </label>
      {editingPlace ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={placeLabelInput}
            onChange={(e) => setPlaceLabelInput(e.target.value)}
            placeholder={t('expenses.location_name_placeholder')}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none flex-1 min-w-0"
            autoFocus
          />
          <button
            onClick={confirmRenamePlace}
            className="px-3 py-2 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press"
          >
            {t('common.save')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={startRenamePlace}
              className="flex items-center gap-2 min-w-0 btn-press text-left flex-1"
            >
              <Icon name="location_on" size={16} className="text-on-surface-dim shrink-0" />
              <span className="text-sm text-on-surface truncate">
                {value ? value.label : t('expenses.location_add_manual')}
              </span>
              <Icon name="edit" size={14} className="text-on-surface-faint shrink-0" />
            </button>
            {value && (
              <button
                onClick={clearPlace}
                className="btn-press p-1 shrink-0"
                aria-label={t('common.clear')}
              >
                <Icon name="close" size={16} className="text-on-surface-faint" />
              </button>
            )}
          </div>

          {/* DEC-405 (G5): search a place by name → real coordinates. */}
          {searchEnabled && (
            <div className="mt-2">
              <div className="flex items-center gap-2 bg-surface-high rounded-lg px-3 py-2">
                <Icon name="search" size={16} className="text-on-surface-faint shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('expenses.location_search_placeholder')}
                  className="bg-transparent text-on-surface text-sm outline-none flex-1 min-w-0"
                />
              </div>
              {searchingPlace && (
                <p className="text-xs text-on-surface-faint mt-1 px-1">
                  {t('expenses.location_search_searching')}
                </p>
              )}
              {!searchingPlace && searchResults.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {searchResults.map((result) => (
                    <li key={result.placeId ?? `${result.lat},${result.lng}`}>
                      <button
                        onClick={() => applySearchedPlace(result)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-high btn-press text-left"
                      >
                        <Icon
                          name="location_on"
                          size={14}
                          className="text-on-surface-dim shrink-0"
                        />
                        <span className="text-sm text-on-surface truncate">{result.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searchingPlace && trimmedQuery.length >= 3 && searchResults.length === 0 && (
                <p className="text-xs text-on-surface-faint mt-1 px-1">
                  {t('expenses.location_search_empty')}
                </p>
              )}
            </div>
          )}

          {/* Edit mode: opt into the live GPS fix (QuickAdd captures it on open). */}
          {showUseMyLocation && (
            <button
              onClick={useMyLocation}
              disabled={locating}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-high btn-press disabled:opacity-50"
            >
              <Icon name="my_location" size={14} className="text-on-surface-dim" />
              <span className="text-xs text-on-surface-dim">
                {locating ? t('expenses.location_searching') : t('expenses.location_use_my')}
              </span>
            </button>
          )}

          {/* M4 (nearby): the category's nearby establishments, nearest first. */}
          {locationFeaturesEnabled && (
            <div className="mt-2">
              <NearbyPlaceList
                places={nearbySuggestions}
                loading={loadingNearby}
                onPick={applyNearbyPlace}
              />
            </div>
          )}

          {/* M4: resolve a real name from the coordinates (opt-in, online-only). */}
          {canFindName && (
            <button
              onClick={findNameOnline}
              disabled={findingName}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-high btn-press disabled:opacity-50"
            >
              <Icon name="travel_explore" size={14} className="text-on-surface-dim" />
              <span className="text-xs text-on-surface-dim">
                {findingName ? t('expenses.location_searching') : t('expenses.location_find_online')}
              </span>
            </button>
          )}

          {/* M4: places reused from history — fully offline, one tap. */}
          {recentSuggestions.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {recentSuggestions.map((recent) => (
                <button
                  key={recent.placeId ?? recent.label}
                  onClick={() => applyRecentPlace(recent)}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-high text-on-surface-dim btn-press"
                >
                  <Icon name="history" size={12} className="text-on-surface-faint" />
                  <span className="text-xs">{recent.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="text-[10px] text-on-surface-faint mt-1">
        {t('expenses.location_privacy_hint')}
      </p>
    </div>
  );
}
