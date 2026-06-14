import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { hardReloadApp } from '@/data/db/db-recovery';
import { downloadEmergencyBackup } from '@/utils/emergency-backup';

interface DataErrorScreenProps {
  onRetry: () => Promise<void>;
}

// DEC-170: keep reconnecting on its own while the user reads the screen. The
// moment the OS frees the IndexedDB process the close+reopen succeeds and this
// screen disappears with no action needed. Calm cadence so the loader does not
// flicker constantly.
const AUTO_RETRY_INTERVAL_MS = 10000;

type ExportState = 'idle' | 'working' | 'done' | 'failed';

/**
 * DEC-109/DEC-170: shown only after the automatic recovery ladder
 * (close+reopen, then a bounded reload) could not heal the connection. Makes it
 * explicit that the data is SAFE and is NEVER a dead end: it keeps retrying on
 * its own, offers a full reload (the reliable WebKit fix), and an emergency
 * export so the user can always rescue their data. It never routes to the
 * destructive onboarding/welcome flow.
 */
export function DataErrorScreen({ onRetry }: DataErrorScreenProps) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const retryingRef = useRef(false);

  const runRetry = useCallback(async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  }, [onRetry]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void runRetry();
    }, AUTO_RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runRetry]);

  const handleExport = async () => {
    setExportState('working');
    const ok = await downloadEmergencyBackup();
    setExportState(ok ? 'done' : 'failed');
  };

  const exportLabel: Record<ExportState, string> = {
    idle: t('data_error.export'),
    working: t('data_error.exporting'),
    done: t('data_error.exported'),
    failed: t('data_error.export_failed'),
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface-container)' }}
      >
        <Icon name="database" size={32} className="text-warning" />
      </div>
      <h1 className="text-lg font-bold text-on-surface">{t('data_error.title')}</h1>
      <p className="text-sm text-on-surface-dim leading-relaxed">{t('data_error.body')}</p>
      <p className="text-xs text-on-surface-dim leading-relaxed">
        {retrying ? t('data_error.reconnecting') : t('data_error.auto_hint')}
      </p>

      <div className="mt-2 flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={runRetry}
          disabled={retrying}
          className="btn-press px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold disabled:opacity-40"
        >
          {retrying ? t('common.loading') : t('data_error.retry')}
        </button>
        <button
          onClick={hardReloadApp}
          className="btn-press px-6 py-3 rounded-xl font-semibold"
          style={{ background: 'var(--surface-container)', color: 'var(--on-surface)' }}
        >
          {t('data_error.reload')}
        </button>
        <button
          onClick={handleExport}
          disabled={exportState === 'working' || exportState === 'done'}
          className="btn-press px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: 'transparent', color: 'var(--on-surface-dim)' }}
        >
          {exportLabel[exportState]}
        </button>
      </div>
    </div>
  );
}
