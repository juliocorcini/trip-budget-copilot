import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { analyzeImport } from '@/domain/backup';
import type { BackupData, ImportAnalysis } from '@/domain/backup';
import { buildFullBackup, importBackup } from '@/domain/orchestrators';
import {
  parseMigrationPayload,
  parseStatementPayload,
  decodeQrPayload,
  extractQrEnvelope,
} from '@/domain/sync';
import type { StatementQrPayload } from '@/domain/sync';
import { storeMirroredStatement, markResponsesSent } from '@/domain/orchestrators/sync-orchestrators';
import { sendResponses } from '@/data/sync';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { SyncTransferFlow } from './SyncTransferFlow';
import type { SyncFlowResult } from './SyncTransferFlow';

/**
 * Generic receiver (/sync): scans a session/offer QR and routes by payload
 * kind — a backup goes through the existing import preview (DEC-104), a
 * statement is stored as a mirrored statement (DEC-106).
 */
export function SyncReceivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, reload } = useAppData();
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [flowKey, setFlowKey] = useState(0);

  const actorName = settings?.deviceName ?? 'TripPilot';

  const handleReceived = async ({ kind, payload, session }: SyncFlowResult) => {
    if (kind === 'backup') {
      const migration = parseMigrationPayload(payload);
      if (!migration) throw new Error('invalid_backup_payload');
      const localBackup = settings ? await buildFullBackup(settings) : null;
      setImportData(migration.data);
      setImportAnalysis(localBackup ? analyzeImport(localBackup, migration.data) : null);
      return;
    }
    const statement = parseStatementPayload(payload);
    if (!statement) throw new Error('invalid_statement_payload');
    const stored = await storeMirroredStatement(statement);

    // Flush queued confirm/reject answers on the same live session (P2P-13).
    // An empty list still unblocks the owner, who is waiting for responses.
    sendResponses(session, stored.pendingResponses);
    if (stored.pendingResponses.length > 0) {
      try {
        const ack = await session.expect('ack', 15_000);
        if (ack.ok) {
          await markResponsesSent(stored.id, stored.pendingResponses.map((r) => r.shareId));
        }
      } catch {
        // Owner went away before acking — responses stay queued for next time.
      }
    }

    await reload();
    showToast(t('sync.statement_received', { name: statement.owner.name }), 'success');
  };

  /** Single-QR offline statement (DEC-103 level 1): store, answers queue for later. */
  const handleStatementQr = useCallback(
    async (qr: StatementQrPayload) => {
      await storeMirroredStatement(qr.data);
      await reload();
      showToast(t('sync.statement_received', { name: qr.data.owner.name }), 'success');
    },
    [reload, t],
  );

  // DEC-351 (F16): a default phone camera that scans the statement QR opens
  // `/sync#<payload>`. Decode the fragment once on mount, store the statement, and
  // land the user on the settle-up surface. In-app camera scans use the flow below.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const envelope = extractQrEnvelope(location.hash);
    if (!envelope) return;
    const decoded = decodeQrPayload(envelope);
    if (decoded?.kind !== 'statement') return;
    deepLinkHandledRef.current = true;
    // Clear the fragment so a reload/back doesn't re-import the same statement.
    window.history.replaceState(null, '', location.pathname + location.search);
    void handleStatementQr(decoded).then(() => navigate('/shared', { replace: true }));
  }, [location.hash, location.pathname, location.search, handleStatementQr, navigate]);

  const handleImport = async () => {
    if (!importData) return;
    await importBackup(importData, mergeMode);
    showToast(t('backup.import_done'), 'success');
    setImportData(null);
    setImportAnalysis(null);
    await reload();
    navigate('/dashboard');
  };

  if (importData) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6 pt-4 max-w-[430px] mx-auto min-h-screen">
        <h1 className="text-heading font-bold text-on-surface">{t('backup.import_preview')}</h1>
        {importAnalysis && (
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2 text-xs">
            <PreviewRow label={t('backup.new_records')} value={String(importAnalysis.newRecords)} />
            <PreviewRow
              label={t('backup.updated_records')}
              value={String(importAnalysis.updatedRecords)}
            />
            <PreviewRow label={t('backup.conflicts')} value={String(importAnalysis.conflicts)} />
          </div>
        )}
        <div className="flex gap-2">
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
          className="w-full py-3 rounded-xl bg-primary text-on-surface font-medium btn-press"
        >
          {t('common.confirm')}
        </button>
        <button
          onClick={() => {
            setImportData(null);
            setImportAnalysis(null);
          }}
          className="text-xs text-on-surface-dim btn-press mx-auto"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4 max-w-[430px] mx-auto min-h-screen">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label={t('common.back')} className="btn-press">
          <Icon name="arrow_back" size={22} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('sync.receive_title')}</h1>
      </div>
      <SyncTransferFlow
        key={flowKey}
        mode="receive"
        purpose="migration"
        actorName={actorName}
        onPayloadReceived={handleReceived}
        onStatementQr={handleStatementQr}
        onDone={() => setFlowKey((k) => k + 1)}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-on-surface-dim">{label}</span>
      <span className="text-on-surface font-semibold tabular">{value}</span>
    </div>
  );
}
