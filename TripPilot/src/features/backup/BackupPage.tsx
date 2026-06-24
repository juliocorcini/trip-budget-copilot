import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  parseBackupFileSafe,
  analyzeImport,
  generateBackupFilename,
  isBackupReminderDue,
  transactionsToCsvRows,
  rowsToCsv,
  downloadFile,
  saveFile,
} from '@/domain/backup';
import { buildTripReport, renderTripReportHtml } from '@/domain/sharing';
import type { TripReportLabels } from '@/domain/sharing';
import {
  buildFullBackup,
  importBackup,
  sendPayloadToPeerMailbox,
  getInboxBackups,
  applyInboxBackup,
  dismissInboxItem,
} from '@/domain/orchestrators';
import {
  appSettingsRepository,
  participantShareRepository,
  peerLinkRepository,
} from '@/data/repositories';
import { sessionRepository } from '@/data/repositories/session-repository';
import type { BackupData, ImportAnalysis } from '@/domain/backup';
import type { PeerLink } from '@/domain/types/peer-link';
import type { MailboxQueueItem } from '@/domain/types/mailbox';
import { formatDate } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { BottomSheet } from '@/components/BottomSheet';
import { HelpButton } from '@/components/HelpMode';
import { buildMigrationPayload } from '@/domain/sync';
import { MAILBOX_DRAINED_EVENT } from '@/utils/mailbox-boot';
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
  // FIELD item 8: paired devices that can receive an async backup, and the
  // backups already drained into this device's inbox awaiting a confirm.
  const [mailboxPeers, setMailboxPeers] = useState<PeerLink[]>([]);
  const [inbox, setInbox] = useState<MailboxQueueItem[]>([]);

  const loadMailbox = async () => {
    const [links, items] = await Promise.all([peerLinkRepository.getAll(), getInboxBackups()]);
    setMailboxPeers(links.filter((link) => !!link.publicKey));
    setInbox(items);
  };

  useEffect(() => {
    void loadMailbox();
    const onDrained = () => void loadMailbox();
    window.addEventListener(MAILBOX_DRAINED_EVENT, onDrained);
    return () => window.removeEventListener(MAILBOX_DRAINED_EVENT, onDrained);
  }, []);

  const handleSendBackupToPeer = async (peer: PeerLink) => {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const backup = await buildFullBackup(settings);
      const { delivered } = await sendPayloadToPeerMailbox(
        peer,
        'backup',
        buildMigrationPayload(backup),
      );
      await appSettingsRepository.update({ lastBackupDate: new Date().toISOString() });
      setSendOpen(false);
      showToast(delivered ? t('mailbox.sent') : t('mailbox.queued'), delivered ? 'success' : 'info');
      await reload();
    } catch {
      showToast(t('mailbox.send_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyInbox = async (item: MailboxQueueItem) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await applyInboxBackup(item.id, mergeMode);
      showToast(ok ? t('backup.import_done') : t('backup.operation_failed'), ok ? 'success' : 'danger');
      await loadMailbox();
      await reload();
    } catch {
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleDismissInbox = async (item: MailboxQueueItem) => {
    await dismissInboxItem(item.id);
    await loadMailbox();
  };

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

  // FIELD item 7: "salvar o backup no aparelho" — write the JSON straight to the
  // device Documents folder (native) instead of opening the share sheet. On the
  // web this falls back to a normal download. Still records lastBackupDate so the
  // dashboard reminder treats it as a real backup.
  const handleSaveToDevice = async () => {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const data = await buildFullBackup(settings);
      const json = JSON.stringify(data, null, 2);
      const uri = await saveFile(json, generateBackupFilename(), 'application/json');
      await appSettingsRepository.update({ lastBackupDate: new Date().toISOString() });
      await reload();
      showToast(uri ? t('backup.save_device_done') : t('backup.save_device_web'), 'success');
    } catch (err) {
      console.error('[backup] save to device failed:', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  // M18: export a self-contained, read-only HTML summary of the trip. Opens in
  // any browser offline — no app install, no network. Reuses the report
  // aggregation + the share-first downloadFile boundary.
  const handleExportHtml = async () => {
    if (!trip || busy) return;
    setBusy(true);
    try {
      const sessions = await sessionRepository.getByTripId(trip.id);
      const report = buildTripReport({
        trip,
        transactions,
        pools,
        phases,
        sessions,
        generatedAt: new Date().toISOString(),
      });
      const labels: TripReportLabels = {
        documentTitle: t('sharing.report_title'),
        generatedAt: t('sharing.report_generated_at'),
        spent: t('sharing.report_spent'),
        budget: t('sharing.report_budget'),
        used: t('sharing.report_used'),
        expenses: t('sharing.report_expenses'),
        byPhase: t('sharing.report_by_phase'),
        byCategory: t('sharing.report_by_category'),
        byPlace: t('sharing.report_by_place'),
        outings: t('sharing.report_outings'),
        outingsSummary: t('sharing.report_outings_summary'),
        noData: t('sharing.report_no_data'),
      };
      const html = renderTripReportHtml(report, labels);
      await downloadFile(
        html,
        `trippilot-summary-${new Date().toISOString().slice(0, 10)}.html`,
        'text/html;charset=utf-8',
      );
    } catch (err) {
      console.error('[backup] HTML summary export failed:', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const backupDue = settings ? isBackupReminderDue(settings, Date.now()) : false;

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

      {/* M17: surface the existing backup reminder right where the action is. */}
      {backupDue && (
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'var(--highlight-subtle)' }}
        >
          <Icon name="cloud_off" size={20} className="text-warning shrink-0" />
          <p className="text-xs text-on-surface">{t('backup.reminder_due')}</p>
        </div>
      )}

      {/* FIELD item 8: backups that arrived through the encrypted mailbox. Never
          applied automatically — the traveler picks merge/replace and confirms. */}
      {inbox.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="mark_email_unread" size={20} className="text-primary" />
            <p className="text-sm font-semibold text-on-surface">{t('mailbox.inbox_title')}</p>
          </div>
          {inbox.map((item) => (
            <div key={item.id} className="rounded-xl bg-surface-high p-3 flex flex-col gap-2">
              <p className="text-sm text-on-surface">
                {t('mailbox.inbox_from', { name: item.fromName ?? t('mailbox.unknown_sender') })}
              </p>
              <p className="text-xs text-on-surface-faint">{formatDate(item.createdAt)}</p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setMergeMode('merge')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${mergeMode === 'merge' ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'}`}
                >
                  {t('backup.import_mode_merge')}
                </button>
                <button
                  onClick={() => setMergeMode('replace')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${mergeMode === 'replace' ? 'bg-error text-on-surface' : 'bg-surface-container text-on-surface-dim'}`}
                >
                  {t('backup.import_mode_replace')}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApplyInbox(item)}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-on-surface text-sm font-semibold btn-press disabled:opacity-40"
                >
                  {t('mailbox.inbox_apply')}
                </button>
                <button
                  onClick={() => handleDismissInbox(item)}
                  className="px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-dim text-sm btn-press"
                >
                  {t('common.dismiss')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* M17: send the full backup to Drive/Files/email via the OS share sheet
          (Web Share API on web, native Share plugin in the APK — FIELD item 6). */}
      <button onClick={handleExport} disabled={busy} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left disabled:opacity-40" data-help-anchor="backup-export">
        <Icon name="ios_share" size={24} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.send_backup')}</p>
          <p className="text-xs text-on-surface-faint">{t('backup.send_backup_desc')}</p>
        </div>
      </button>

      {/* FIELD item 7: save the backup straight to the device (Documents folder
          on native; Downloads on web) without going through the share sheet. */}
      <button onClick={handleSaveToDevice} disabled={busy} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left disabled:opacity-40">
        <Icon name="save" size={24} className="text-primary" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.save_device')}</p>
          <p className="text-xs text-on-surface-faint">{t('backup.save_device_desc')}</p>
        </div>
      </button>

      {/* M18: read-only HTML summary — opens offline in any browser. */}
      <button onClick={handleExportHtml} disabled={busy} className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left disabled:opacity-40">
        <Icon name="summarize" size={24} className="text-success" />
        <div>
          <p className="text-sm font-medium text-on-surface">{t('backup.export_html')}</p>
          <p className="text-xs text-on-surface-faint">{t('backup.export_html_desc')}</p>
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
              className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-[left]"
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
        {/* FIELD item 8: async alternative — drop the backup in a paired device's
            mailbox; it lands in their inbox to confirm whenever they next open. */}
        {sendOpen && mailboxPeers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-high flex flex-col gap-2">
            <p className="text-xs font-semibold text-on-surface-dim">{t('mailbox.send_backup_title')}</p>
            <p className="text-xs text-on-surface-faint">{t('mailbox.send_backup_desc')}</p>
            {mailboxPeers.map((peer) => (
              <button
                key={peer.id}
                onClick={() => handleSendBackupToPeer(peer)}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-surface-high text-on-surface text-sm font-medium btn-press flex items-center gap-2 disabled:opacity-40"
              >
                <Icon name="mail" size={18} className="text-primary" />
                {peer.displayName}
              </button>
            ))}
          </div>
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
