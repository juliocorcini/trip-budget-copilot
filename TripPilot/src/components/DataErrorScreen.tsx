import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { hardReloadApp } from '@/data/db/db-recovery';
import { downloadEmergencyBackup } from '@/utils/emergency-backup';
import { collectDiagnostics } from '@/utils/diagnostics';

interface DataErrorScreenProps {
  onRetry: () => Promise<void>;
}

// DEC-170/DEC-176: keep reconnecting on its own while the user reads the
// screen. The moment the OS frees the IndexedDB process (or a bfcache restore
// settles) the close+reopen succeeds and this screen disappears with no action
// needed. Backoff cadence: try quickly first (most transient wedges clear in a
// couple seconds) then ease off so the loader does not flicker forever.
const AUTO_RETRY_BACKOFF_MS = [1500, 3000, 6000, 10000];

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
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
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
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const schedule = () => {
      const delay = AUTO_RETRY_BACKOFF_MS[Math.min(attempt, AUTO_RETRY_BACKOFF_MS.length - 1)]!;
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await runRetry();
        attempt += 1;
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [runRetry]);

  const handleExport = async () => {
    setExportState('working');
    const ok = await downloadEmergencyBackup();
    setExportState(ok ? 'done' : 'failed');
  };

  // DEC-176: surface real evidence from the wedged state. Reads only localStorage
  // + Storage API + a read-only IDB probe, so it works while the DB is wedged.
  // Always reveals a selectable textarea (clipboard is often blocked on mobile
  // PWAs), and best-effort copies to the clipboard on top of that.
  const handleDiagnostics = async () => {
    const text = await collectDiagnostics();
    setDiagnostics(text);
    try {
      await navigator.clipboard.writeText(text);
      setDiagnosticsCopied(true);
    } catch {
      setDiagnosticsCopied(false);
    }
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
        <button
          onClick={handleDiagnostics}
          className="btn-press px-6 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'transparent', color: 'var(--on-surface-faint)' }}
        >
          {diagnosticsCopied ? t('data_error.diagnostics_copied') : t('data_error.diagnostics')}
        </button>
      </div>

      {diagnostics !== null && (
        <div className="w-full max-w-xs flex flex-col gap-1">
          <p className="text-[11px] text-on-surface-faint leading-relaxed">
            {t('data_error.diagnostics_hint')}
          </p>
          <textarea
            readOnly
            value={diagnostics}
            onFocus={(e) => e.currentTarget.select()}
            rows={8}
            className="w-full text-[10px] font-mono rounded-lg p-2 outline-none"
            style={{
              background: 'var(--surface-container)',
              color: 'var(--on-surface-dim)',
              border: '1px solid var(--surface-container-high)',
            }}
          />
        </div>
      )}
    </div>
  );
}
