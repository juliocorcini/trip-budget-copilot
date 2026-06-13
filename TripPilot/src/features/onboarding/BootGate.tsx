import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { tripRepository } from '@/data/repositories';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TripRecoveryScreen } from './TripRecoveryScreen';

type OrphanCheck = 'idle' | 'checking' | 'has-trips' | 'empty' | 'error';

/**
 * BUG-001: boot guard for `/`. `start_url:"/"` means every cold start of the
 * installed PWA lands here, so this decides where to go BEFORE any onboarding
 * screen renders:
 *   - active trip on disk   → /dashboard (never the Welcome/onboarding screen)
 *   - DB read failed/hung   → DataErrorScreen (never a destructive re-import)
 *   - no active trip but
 *     trips exist on disk    → recovery screen (BUG-003 orphan scenario)
 *   - genuinely empty DB     → /welcome
 */
export function BootGate() {
  const { trip, loading, error, retry, reload } = useAppData();
  const [orphan, setOrphan] = useState<OrphanCheck>('idle');

  const noActiveTrip = !loading && !error && !trip;

  useEffect(() => {
    if (!noActiveTrip) {
      setOrphan('idle');
      return;
    }
    let cancelled = false;
    setOrphan('checking');
    tripRepository
      .count()
      .then((count) => {
        if (!cancelled) setOrphan(count > 0 ? 'has-trips' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setOrphan('error');
      });
    return () => {
      cancelled = true;
    };
  }, [noActiveTrip]);

  if (loading) return <LoadingScreen />;
  if (error) return <DataErrorScreen onRetry={retry} />;
  if (trip) return <Navigate to="/dashboard" replace />;

  // No active trip — decide between recovery (trips on disk) and onboarding.
  if (orphan === 'error') return <DataErrorScreen onRetry={retry} />;
  if (orphan === 'idle' || orphan === 'checking') return <LoadingScreen />;
  if (orphan === 'has-trips') return <TripRecoveryScreen onRecovered={reload} />;
  return <Navigate to="/welcome" replace />;
}
