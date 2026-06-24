import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { isOngoing } from '@/domain/spaces/spaces';
import type { Trip } from '@/domain/types/trip';

/**
 * DEC-249 — the active-space chip. Shows the current space name (Julio: "é
 * clicando no nome da viagem mesmo") with a switch affordance and opens the
 * `/spaces` switcher. Additive: it does not replace the header's name → trip
 * overview navigation.
 *
 * M09: the chip now leads with the space KIND ("Viagem" / "Dia a dia") so the
 * user always knows which mode they're in — "modo" was a system concept with no
 * on-screen anchor. The kind label is always visible (shrink-0); the name
 * truncates beside it, and is dropped when it would only echo the kind (the
 * default "Dia a dia" space name).
 */
export function SpaceSwitcherChip({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ongoing = isOngoing(trip);
  const modeLabel = t(ongoing ? 'spaces.kind_ongoing_title' : 'spaces.kind_trip_title');
  const showName = trip.name.trim().toLowerCase() !== modeLabel.toLowerCase();

  return (
    <button
      onClick={() => navigate('/spaces')}
      className="btn-press self-start mt-3 max-w-full flex items-center gap-1.5 rounded-full pl-2.5 pr-2 py-1.5 bg-surface-container"
      aria-label={showName ? `${modeLabel}: ${trip.name}` : modeLabel}
    >
      <Icon name={ongoing ? 'sync' : 'place'} size={14} className="text-primary shrink-0" />
      <span className="text-xs font-bold text-primary shrink-0">{modeLabel}</span>
      {showName && (
        <>
          <span className="text-xs text-on-surface-faint shrink-0">·</span>
          <span className="text-xs font-semibold text-on-surface truncate">{trip.name}</span>
        </>
      )}
      <Icon name="unfold_more" size={14} className="text-on-surface-faint shrink-0" />
    </button>
  );
}
