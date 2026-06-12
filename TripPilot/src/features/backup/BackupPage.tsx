import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  parseBackupFileSafe,
  analyzeImport,
  generateBackupFilename,
  transactionsToCsvRows,
  rowsToCsv,
  downloadFile,
} from '@/domain/backup';
import { buildFullBackup, importBackup } from '@/domain/orchestrators';
import { appSettingsRepository, participantShareRepository } from '@/data/repositories';
import { sessionRepository } from '@/data/repositories/session-repository';
import type { BackupData, ImportAnalysis } from '@/domain/backup';
import { formatDate } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { BottomSheet } from '@/components/BottomSheet';
import { HelpButton } from '@/components/HelpMode';
import { buildMigrationPayload } from '@/domain/sync';
import { SyncTransferFlow } from '@/features/sync/SyncTransferFlow';

export function BackupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, transactions, wallets, participants, settings, reload } = useAppData();
  const csvAutoTriggered = useRef(false);
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null);
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [csvAdvanced, setCsvAdvanced] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // DEC-110: every async backup action gets a busy flag + error toast — a
  // failure can never leave the app in a stuck state.
  const [busy, setBusy] = useState(false);

  const exportCsv = async (advanced: boolean) => {
    if (!trip || busy) return;
    setBusy(true);
    try {
      const sharedTxIds = transactions.filter((tx) => tx.isShared).map((tx) => tx.id);
      const [sessions, shares] = await Promise.all([
        sessionRepository.getByTripId(trip.id),
        participantShareRepository.getAllForTrip(sharedTxIds),
      ]);
      const rows = transactionsToCsvRows({
        transactions,
        pools,
        wallets,
        phases,
        trips: [trip],
        sessions,
        participants,
        shares,
        currency: trip.baseCurrency,
        advanced,
      });
      const csv = rowsToCsv(rows, advanced);
      await downloadFile(
        csv,
        `trippilot-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8',
      );
    } catch (err) {
      console.error('[backup] CSV export failed:', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('csv') === 'true' && trip && !csvAutoTriggered.current) {
      csvAutoTriggered.current = true;
      exportCsv(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, trip]);

  const handleExport = async () => {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const data = await buildFullBackup(settings);
      const json = JSON.stringify(data, null, 2);
      await downloadFile(json, generateBackupFilename(), 'application/json');
      // D-J: persist last backup date so the dashboard reminder works.
      await appSettingsRepository.update({ lastBackupDate: new Date().toISOString() });
      await reload();
    } catch (err) {
      console.error('[backup] JSON export failed:', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const parsed = parseBackupFileSafe(reader.result as string);
      if (!parsed.data) {
        showToast(t('backup.invalid_file', { error: parsed.error ?? '' }), 'danger');
        return;
      }
      if (!settings) return;
      setImportData(parsed.data);
      const localBackup = await buildFullBackup(settings);
      setImportAnalysis(analyzeImport(localBackup, parsed.data));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importData || busy) return;
    setBusy(true);
    try {
      await importBackup(importData, mergeMode);
      showToast(t('backup.import_done'), 'success');
      setImportAnalysis(null);
      setImportData(null);
      await reload();
    } catch (err) {
      console.error('[backup] import failed:', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      {/* R5-08: same back-button header pattern as the other "More" subpages. */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('backup.title')}</h1>
        <HelpButton screenId="backup" />
      </div>

      {settings?.lastBackupDate && (
        <p className="text-xs text-on-surface-faint">
          {t('backup.last_backup', { date: formatDate(settings.lastBackupDate) })}
        </p>
      )}

      <button onClick={handleExport} disabled={busy} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left disabled:opacity-40" data-help-anchor="backup-export">
        <Icon name="cloud_upload" size={24} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.export_json')}</p>
        </div>
      </button>

      <div className="bg-surface-container rounded-xl p-4">
        <button onClick={() => exportCsv(csvAdvanced)} className="flex items-center gap-3 btn-press text-left w-full">
          <Icon name="table_chart" size={24} className="text-success" />
          <div>
            <p className="text-sm font-medium text-on-surface">{t('backup.export_csv')}</p>
          </div>
        </button>
        <button
          onClick={() => setCsvAdvanced((v) => !v)}
          className="w-full flex items-center justify-between mt-3 btn-press"
        >
          <span className="text-xs text-on-surface-dim">{t('backup.csv_advanced')}</span>
          <span
            className="w-10 h-6 rounded-full relative transition-colors"
            style={{ background: csvAdvanced ? 'var(--primary)' : 'var(--surface-high)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-all"
              style={{ left: csvAdvanced ? '18px' : '2px' }}
            />
          </span>
        </button>
      </div>

      <label className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press cursor-pointer" data-help-anchor="backup-import">
        <Icon name="cloud_download" size={24} className="text-warning" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.import_json')}</p>
        </div>
        <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
      </label>

      {/* DEC-104: device-to-device migration over the P2P channel */}
      <button
        onClick={() => setSendOpen(true)}
        className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left"
      >
        <Icon name="phonelink_ring" size={24} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('sync.send_to_device')}</p>
          <p className="text-xs text-on-surface-faint">{t('sync.send_to_device_desc')}</p>
        </div>
      </button>

      <button
        onClick={() => navigate('/sync')}
        className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left"
      >
        <Icon name="qr_code_scanner" size={24} className="text-success" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('sync.receive_from_device')}</p>
          <p className="text-xs text-on-surface-faint">{t('sync.receive_from_device_desc')}</p>
        </div>
      </button>

      <BottomSheet open={sendOpen} onClose={() => setSendOpen(false)} title={t('sync.send_to_device')}>
        {sendOpen && settings && (
          <SyncTransferFlow
            mode="send"
            purpose="migration"
            actorName={settings.deviceName}
            buildPayload={async () => {
              const backup = await buildFullBackup(settings);
              return { kind: 'backup', payload: buildMigrationPayload(backup) };
            }}
            onSent={async () => {
              // Receiving device now holds a full copy — counts as a backup.
              await appSettingsRepository.update({ lastBackupDate: new Date().toISOString() });
              await reload();
            }}
            onDone={() => setSendOpen(false)}
            onCancel={() => setSendOpen(false)}
          />
        )}
      </BottomSheet>

      {importAnalysis && (
        <div className="bg-surface-container rounded-xl p-4">
          <p className="text-sm font-semibold text-on-surface mb-3">{t('backup.import_preview')}</p>
          <div className="flex flex-col gap-2 text-xs">
            <Row label={t('backup.new_records')} value={String(importAnalysis.newRecords)} />
            <Row label={t('backup.updated_records')} value={String(importAnalysis.updatedRecords)} />
            <Row label={t('backup.conflicts')} value={String(importAnalysis.conflicts)} />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setMergeMode('merge')}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${mergeMode === 'merge' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'}`}
            >
              {t('backup.import_mode_merge')}
            </button>
            <button
              onClick={() => setMergeMode('replace')}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${mergeMode === 'replace' ? 'bg-error text-on-surface' : 'bg-surface-high text-on-surface-dim'}`}
            >
              {t('backup.import_mode_replace')}
            </button>
          </div>

          <button
            onClick={handleImport}
            disabled={busy}
            className="w-full mt-3 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('common.confirm')}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-on-surface-dim">{label}</span>
      <span className="text-on-surface font-semibold tabular">{value}</span>
    </div>
  );
}
