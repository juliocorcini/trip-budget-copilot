import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { tripRepository, appSettingsRepository } from '@/data/repositories';
import type { Trip } from '@/domain/types/trip';
import { formatDate } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { LoadingScreen } from '@/components/LoadingScreen';

interface TripRecoveryScreenProps {
  /** Called after the active trip is restored so the boot guard re-evaluates. */
  onRecovered: () => Promise<void> | void;
}

/**
 * BUG-001/BUG-003: shown at boot when the settings row has no active trip but
 * real trips still exist on disk (the "orphan" scenario after eviction, a lost
 * settings row, or an interrupted flow). Instead of dropping the user on the
 * Welcome screen — which invites a destructive new trip — we let them pick the
 * surviving trip and continue. Their data is never offered for deletion here.
 */
export function TripRecoveryScreen({ onRecovered }: TripRecoveryScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tripRepository
      .getAll()
      .then((all) => {
        if (!cancelled) setTrips(all);
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async (trip: Trip) => {
    if (restoringId) return;
    setRestoringId(trip.id);
    try {
      await appSettingsRepository.update({
        activeTrip: trip.id,
        onboardingCompleted: true,
      });
      await onRecovered();
      navigate('/dashboard', { replace: true });
    } finally {
      setRestoringId(null);
    }
  };

  if (trips === null) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <div className="text-center">
        <Icon name="restore" size={48} className="text-primary mb-4" />
        <h1 className="text-display font-bold text-on-surface">{t('recovery.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-2 max-w-sm">{t('recovery.body')}</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {trips.map((trip) => (
          <button
            key={trip.id}
            onClick={() => handleContinue(trip)}
            disabled={restoringId !== null}
            className="w-full px-4 py-4 rounded-2xl bg-primary text-on-surface font-semibold text-sm btn-press text-left disabled:opacity-40"
          >
            <span className="block">{trip.name}</span>
            <span className="block text-xs font-normal text-on-surface/70 mt-0.5">
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </span>
          </button>
        ))}

        <button
          onClick={() => navigate('/welcome', { replace: true })}
          disabled={restoringId !== null}
          className="w-full py-3 rounded-2xl text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
        >
          {t('recovery.start_fresh')}
        </button>
      </div>
    </div>
  );
}
