import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatDistanceShort } from '@/domain/location';
import type { NearbyPlace } from '@/domain/location';

interface NearbyPlaceListProps {
  places: NearbyPlace[];
  loading: boolean;
  onPick: (place: NearbyPlace) => void;
  max?: number;
}

/**
 * E8 (M4): the "nearby establishments" picker list — nearest first, with a
 * compact distance. Shared by quick-add and the active outing so the location
 * affordance behaves the same everywhere. Renders nothing when there are no
 * results and nothing is loading (offline / no GPS → caller's manual fallback).
 */
export function NearbyPlaceList({ places, loading, onPick, max = 6 }: NearbyPlaceListProps) {
  const { t } = useTranslation();

  if (loading && places.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-on-surface-faint">
        <Icon name="travel_explore" size={12} className="text-on-surface-faint" />
        {t('expenses.location_searching_nearby')}
      </p>
    );
  }

  if (places.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-on-surface-faint mb-1">{t('expenses.location_nearby_label')}</p>
      <div className="flex flex-col gap-1">
        {places.slice(0, max).map((place) => (
          <button
            key={place.placeId ?? place.label}
            onClick={() => onPick(place)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-high btn-press text-left"
          >
            <Icon name="location_on" size={14} className="text-on-surface-faint shrink-0" />
            <span className="text-xs text-on-surface-dim flex-1 truncate">{place.label}</span>
            <span className="text-[10px] text-on-surface-faint shrink-0 tabular">
              {formatDistanceShort(place.distanceMeters)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
