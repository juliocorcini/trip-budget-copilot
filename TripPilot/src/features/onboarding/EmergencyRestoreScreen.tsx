import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { logger } from '@/utils/logger';
import { importBackup } from '@/domain/orchestrators';
import { formatDate } from '@/domain/dates';
import {
  readEmergencySnapshot,
  readEmergencySnapshotMeta,
  clearEmergencySnapshot,
} from '@/utils/emergency-snapshot';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';

interface EmergencyRestoreScreenProps {
  /** Called after a successful restore so the boot guard re-evaluates. */
  onRestored: () => Promise<void> | void;
}

/**
 * BUG-002: shown at boot when the database is genuinely empty but a local
 * emergency snapshot exists — the classic iOS WebKit eviction case. Instead of
 * dropping the user on onboarding (their data feels lost), we offer a one-tap
 * restore from the snapshot kept in localStorage. "Start fresh" discards the
 * snapshot, since choosing it means they no longer want the old data.
 */
export function EmergencyRestoreScreen({ onRestored }: EmergencyRestoreScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meta = useMemo(() => readEmergencySnapshotMeta(), []);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (restoring) return;
    const snapshot = readEmergencySnapshot();
    if (!snapshot) {
      navigate('/welcome', { replace: true });
      return;
    }
    setRestoring(true);
    try {
      await importBackup(snapshot, 'replace');
      await onRestored();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      logger.error('emergency_restore_failed', { module: 'onboarding' }, err);
      showToast(t('recovery.restore_error'), 'danger');
      setRestoring(false);
    }
  };

  const handleStartFresh = () => {
    if (restoring) return;
    clearEmergencySnapshot();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <div className="text-center">
        <Icon name="cloud_download" size={48} className="text-primary mb-4" />
        <h1 className="text-display font-bold text-on-surface">{t('recovery.snapshot_title')}</h1>
        <p className="text-sm text-on-surface-dim mt-2 max-w-sm">{t('recovery.snapshot_body')}</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {meta && (
          <div
            className="w-full px-4 py-3 rounded-2xl text-left"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
          >
            <p className="text-xs text-on-surface-faint">{t('recovery.snapshot_from')}</p>
            <p className="text-sm font-semibold text-on-surface mt-0.5">
              {formatDate(meta.exportedAt.slice(0, 10))}
            </p>
            <p className="text-xs text-on-surface-dim mt-1">
              {t('recovery.snapshot_contents', {
                trips: meta.tripCount,
                expenses: meta.transactionCount,
              })}
            </p>
          </div>
        )}

        <button
          onClick={handleRestore}
          disabled={restoring}
          className="w-full py-4 rounded-2xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-40"
        >
          {restoring ? t('common.loading') : t('recovery.snapshot_restore')}
        </button>

        <button
          onClick={handleStartFresh}
          disabled={restoring}
          className="w-full py-3 rounded-2xl text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
        >
          {t('recovery.start_fresh')}
        </button>
      </div>
    </div>
  );
}
