import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createBackup, parseBackupFile, analyzeImport, generateBackupFilename } from '@/domain/backup';
import { transactionsToCsvRows, rowsToCsv, downloadFile } from '@/domain/backup';
import { appSettingsRepository, tripRepository, phaseRepository, budgetPoolRepository, budgetPoolPhaseLinkRepository, envelopeRepository, transactionRepository, walletRepository, participantRepository } from '@/data/repositories';
import type { BackupData, ImportAnalysis } from '@/domain/backup';
import { formatDate } from '@/domain/dates';
import { Icon } from '@/components/Icon';

export function BackupPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions, wallets, participants, settings, reload } = useAppData();
  const csvAutoTriggered = useRef(false);
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null);
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (searchParams.get('csv') === 'true' && trip && !csvAutoTriggered.current) {
      csvAutoTriggered.current = true;
      const rows = transactionsToCsvRows(transactions, pools, wallets, phases, trip.baseCurrency);
      const csv = rowsToCsv(rows);
      downloadFile(csv, `trippilot-expenses-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    }
  }, [searchParams, trip, transactions, pools, wallets, phases]);

  const handleExport = async () => {
    if (!settings) return;
    const data = createBackup({
      deviceId: settings.deviceName,
      appSettings: settings,
      trips: trip ? [trip] : [],
      phases,
      budgetPools: pools,
      budgetPoolPhaseLinks: links,
      envelopes,
      participants,
      wallets,
      transactions,
      participantShares: [],
      activityProfiles: [],
    });
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, generateBackupFilename(), 'application/json');
    await appSettingsRepository.update({ lastBackupDate: new Date().toISOString() });
    await reload();
  };

  const handleCsvExport = () => {
    if (!trip) return;
    const rows = transactionsToCsvRows(transactions, pools, wallets, phases, trip.baseCurrency);
    const csv = rowsToCsv(rows);
    downloadFile(csv, `trippilot-expenses-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBackupFile(reader.result as string);
      if (!parsed || !settings) return;
      setImportData(parsed);
      const localBackup = createBackup({
        deviceId: settings.deviceName,
        appSettings: settings,
        trips: trip ? [trip] : [],
        phases, budgetPools: pools, budgetPoolPhaseLinks: links,
        envelopes, participants, wallets, transactions,
        participantShares: [], activityProfiles: [],
      });
      setImportAnalysis(analyzeImport(localBackup, parsed));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importData) return;
    if (mergeMode === 'replace') {
      await Promise.all([
        tripRepository.clear(), phaseRepository.clear(), budgetPoolRepository.clear(),
        budgetPoolPhaseLinkRepository.clear(), envelopeRepository.clear(),
        transactionRepository.clear(), walletRepository.clear(), participantRepository.clear(),
      ]);
    }

    for (const t of importData.trips) await tripRepository.create(t).catch(() => {});
    for (const p of importData.phases) await phaseRepository.create(p).catch(() => {});
    for (const p of importData.budgetPools) await budgetPoolRepository.create(p).catch(() => {});
    for (const l of importData.budgetPoolPhaseLinks) await budgetPoolPhaseLinkRepository.create(l).catch(() => {});
    for (const e of importData.envelopes) await envelopeRepository.create(e).catch(() => {});
    for (const tx of importData.transactions) await transactionRepository.create(tx).catch(() => {});
    for (const w of importData.wallets) await walletRepository.create(w).catch(() => {});
    for (const p of importData.participants) await participantRepository.create(p).catch(() => {});

    if (importData.appSettings.activeTrip) {
      await appSettingsRepository.update({
        activeTrip: importData.appSettings.activeTrip,
        onboardingCompleted: true,
      });
    }

    setImportAnalysis(null);
    setImportData(null);
    await reload();
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">{t('backup.title')}</h1>

      {settings?.lastBackupDate && (
        <p className="text-xs text-on-surface-faint">
          {t('backup.last_backup', { date: formatDate(settings.lastBackupDate) })}
        </p>
      )}

      <button onClick={handleExport} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left">
        <Icon name="cloud_upload" size={24} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.export_json')}</p>
        </div>
      </button>

      <button onClick={handleCsvExport} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left">
        <Icon name="table_chart" size={24} className="text-success" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.export_csv')}</p>
        </div>
      </button>

      <label className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press cursor-pointer">
        <Icon name="cloud_download" size={24} className="text-warning" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.import_json')}</p>
        </div>
        <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
      </label>

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
            className="w-full mt-3 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press"
          >
            {t('common.confirm')}
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
