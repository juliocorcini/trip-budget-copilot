import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { isOngoing } from '@/domain/spaces/spaces';
import type { Trip } from '@/domain/types/trip';

/**
 * DEC-249 — the active-space chip. Shows the current space name (Julio: "é
 * clicando no nome da viagem mesmo") with a switch affordance and opens the
 * `/spaces` switcher. Additive: it does not replace the header's name → trip
 * overview navigation.
 */
export function SpaceSwitcherChip({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/spaces')}
      className="btn-press self-start mt-3 max-w-full flex items-center gap-1.5 rounded-full pl-2.5 pr-2 py-1.5 bg-surface-container"
      aria-label={trip.name}
    >
      <Icon
        name={isOngoing(trip) ? 'sync' : 'place'}
        size={14}
        className="text-primary shrink-0"
      />
      <span className="text-xs font-semibold text-on-surface truncate">{trip.name}</span>
      <Icon name="unfold_more" size={14} className="text-on-surface-faint shrink-0" />
    </button>
  );
}
