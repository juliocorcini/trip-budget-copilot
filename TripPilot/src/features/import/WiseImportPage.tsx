import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { parseWiseCsv } from '@/domain/import/wise-csv';
import { classifyWiseRows } from '@/domain/import/wise-import';
import type { WiseImportPlan, WiseImportDraft, WiseDraftStatus } from '@/domain/import';
import { commitWiseImport, softDeleteTransactionsBatch } from '@/domain/orchestrators';
import { resolveActivePhase, formatShortDate } from '@/domain/dates';
import { getDefaultWallet } from '@/domain/wallets';
import { formatMoney, sumCents } from '@/domain/money';
import { walletRepository } from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import { getCategoryIcon } from '@/utils/category-icons';
import type { Wallet } from '@/domain/types/wallet';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';

type TargetWallet = string | 'new';

const STATUS_STYLE: Record<WiseDraftStatus, { bg: string; color: string }> = {
  new: { bg: 'rgba(124,160,255,0.16)', color: 'var(--primary)' },
  possible_manual_dup: { bg: 'var(--warning-surface, rgba(212,160,80,0.18))', color: 'var(--warning)' },
  duplicate_import: { bg: 'var(--surface-high)', color: 'var(--on-surface-faint)' },
};

export function WiseImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, wallets, transactions, loading, error, retry, reload } = useAppData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<WiseImportPlan | null>(null);
  const [parsing, setParsing] = useState(false);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<TargetWallet | null>(null);
  const [busy, setBusy] = useState(false);

  const baseCurrency = trip?.baseCurrency ?? 'EUR';

  const selectedDrafts = useMemo(
    () =>
      plan
        ? plan.drafts.filter(
            (d) => included.has(d.rowId) && d.importable && d.status !== 'duplicate_import',
          )
        : [],
    [plan, included],
  );
  const selectedTotalCents = useMemo(
    () => sumCents(selectedDrafts.map((d) => d.amountCents)),
    [selectedDrafts],
  );

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setParsing(true);
    try {
      const texts = await Promise.all(files.map((f) => f.text()));
      const rows = texts.flatMap((text) => parseWiseCsv(text));
      const built = classifyWiseRows(rows, { existingTransactions: transactions, phases });
      setPlan(built);
      setIncluded(new Set(built.drafts.filter((d) => d.includeByDefault).map((d) => d.rowId)));
      const preferred =
        wallets.find((w) => /wise/i.test(w.name)) ?? getDefaultWallet(wallets) ?? wallets[0] ?? null;
      setTarget(preferred ? preferred.id : 'new');
    } catch (err) {
      console.error('[wise-import] parse failed', err);
      showToast(t('wiseImport.parse_error'), 'danger');
    } finally {
      setParsing(false);
    }
  };

  const toggle = (rowId: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const includeAllNew = () => {
    if (!plan) return;
    setIncluded(
      new Set(plan.drafts.filter((d) => d.importable && d.status === 'new').map((d) => d.rowId)),
    );
  };
  const excludeAll = () => setIncluded(new Set());

  const handleCommit = async () => {
    if (!trip || busy) return;
    if (selectedDrafts.length === 0) {
      showToast(t('wiseImport.commit_empty'), 'warning');
      return;
    }
    const operationalPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0];
    const fallbackPhase = resolveActivePhase(phases);
    if (!operationalPool || !fallbackPhase) {
      showToast(t('backup.operation_failed'), 'danger');
      return;
    }

    setBusy(true);
    try {
      let walletId = target;
      if (walletId === 'new' || walletId === null) {
        const wallet: Wallet = {
          ...createSyncMetadata(),
          tripId: trip.id,
          name: t('wiseImport.wise_wallet_name'),
          walletType: 'digital',
          currency: 'EUR',
          initialBalanceCents: 0,
          isDefault: wallets.length === 0,
          notes: null,
        };
        await walletRepository.create(wallet);
        walletId = wallet.id;
      }

      const result = await commitWiseImport({
        drafts: selectedDrafts,
        tripId: trip.id,
        budgetPoolId: operationalPool.id,
        walletId,
        fallbackPhaseId: fallbackPhase.id,
      });
      await reload();

      const ids = result.transactionIds;
      showToast(t('wiseImport.imported_toast', { count: ids.length }), 'success', {
        durationMs: 8000,
        actionLabel: t('common.undo'),
        onTap: () => {
          void softDeleteTransactionsBatch(ids).then(() => {
            notifyAppDataChanged();
            showToast(t('common.undo_done'), 'info');
          });
        },
      });
      navigate('/expenses');
    } catch (err) {
      console.error('[wise-import] commit failed', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const hasDrafts = plan !== null && plan.drafts.length > 0;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5 pt-2 pb-28">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div>
          <h1 className="text-heading font-bold text-on-surface leading-tight">
            {t('wiseImport.title')}
          </h1>
          <p className="text-[11px] text-on-surface-faint">{t('wiseImport.subtitle')}</p>
        </div>
      </div>

      {/* File picker — shown until a statement is parsed, then collapses to a link. */}
      {!hasDrafts && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="rounded-2xl border border-dashed p-6 flex flex-col items-center gap-2 btn-press disabled:opacity-50"
          style={{ borderColor: 'var(--surface-high)', background: 'var(--surface-container)' }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,160,255,0.16)' }}
          >
            <Icon name="upload_file" size={24} className="text-primary" />
          </div>
          <span className="text-sm font-bold text-on-surface">{t('wiseImport.pick_files')}</span>
          <span className="text-[11px] text-on-surface-faint text-center leading-relaxed">
            {parsing ? t('wiseImport.parsing') : t('wiseImport.pick_hint')}
          </span>
        </button>
      )}

      {plan !== null && !hasDrafts && (
        <EmptyState
          icon="receipt_long"
          title={t('wiseImport.no_rows_title')}
          body={t('wiseImport.no_rows_body')}
          cta={{ label: t('wiseImport.pick_files'), icon: 'upload_file', onClick: () => fileRef.current?.click() }}
        />
      )}

      {hasDrafts && plan && (
        <>
          {/* Summary */}
          <div className="bg-surface-container rounded-2xl p-4 grid grid-cols-2 gap-y-2.5 gap-x-3">
            <Stat label={t('wiseImport.found')} value={plan.summary.uniqueRows} />
            <Stat label={t('wiseImport.new')} value={plan.summary.newCount} accent />
            {plan.summary.duplicateImportCount > 0 && (
              <Stat label={t('wiseImport.already_imported')} value={plan.summary.duplicateImportCount} />
            )}
            {plan.summary.possibleManualDupCount > 0 && (
              <Stat label={t('wiseImport.possible_dup')} value={plan.summary.possibleManualDupCount} />
            )}
            {plan.summary.feeCount > 0 && (
              <Stat label={t('wiseImport.fees')} value={plan.summary.feeCount} />
            )}
            {plan.summary.creditCount > 0 && (
              <Stat label={t('wiseImport.credits')} value={plan.summary.creditCount} />
            )}
          </div>

          {/* Target wallet */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-on-surface">{t('wiseImport.target_wallet')}</p>
            <div className="flex gap-2 flex-wrap">
              {wallets.map((w) => (
                <WalletChip
                  key={w.id}
                  active={target === w.id}
                  label={`${w.name} · ${w.currency}`}
                  onClick={() => setTarget(w.id)}
                />
              ))}
              <WalletChip
                active={target === 'new'}
                label={t('wiseImport.create_wise_wallet')}
                icon="add"
                onClick={() => setTarget('new')}
              />
            </div>
            <p className="text-[11px] text-on-surface-faint">{t('wiseImport.target_wallet_hint')}</p>
          </div>

          {/* Review list */}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-semibold text-on-surface">{t('wiseImport.review_title')}</p>
            <div className="flex gap-3">
              <button onClick={includeAllNew} className="text-[11px] font-semibold text-primary btn-press">
                {t('wiseImport.include_all')}
              </button>
              <button onClick={excludeAll} className="text-[11px] font-semibold text-on-surface-faint btn-press">
                {t('wiseImport.exclude_all')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {plan.drafts.map((draft) => (
              <DraftRow
                key={draft.rowId}
                draft={draft}
                checked={included.has(draft.rowId)}
                onToggle={() => toggle(draft.rowId)}
                baseCurrency={baseCurrency}
              />
            ))}
          </div>
        </>
      )}

      {hasDrafts && (
        <div
          className="fixed inset-x-0 bottom-0 px-5"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)', paddingTop: 12, background: 'linear-gradient(to top, var(--surface-base) 70%, transparent)' }}
        >
          <div className="max-w-[430px] mx-auto">
            <button
              onClick={handleCommit}
              disabled={busy || selectedDrafts.length === 0}
              className="w-full py-3.5 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-40"
            >
              {busy
                ? t('common.loading')
                : selectedDrafts.length === 0
                  ? t('wiseImport.commit_empty')
                  : t('wiseImport.commit', {
                      count: selectedDrafts.length,
                      total: formatMoney(selectedTotalCents, baseCurrency),
                    })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-on-surface-faint">{label}</span>
      <span className={`text-sm font-extrabold tabular ${accent ? 'text-primary' : 'text-on-surface'}`}>
        {value}
      </span>
    </div>
  );
}

function WalletChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-medium btn-press flex items-center gap-1.5 ${
        active ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
      }`}
    >
      {icon && <Icon name={icon} size={14} />}
      {label}
    </button>
  );
}

function DraftRow({
  draft,
  checked,
  onToggle,
  baseCurrency,
}: {
  draft: WiseImportDraft;
  checked: boolean;
  onToggle: () => void;
  baseCurrency: string;
}) {
  const { t } = useTranslation();
  const canToggle = draft.importable && draft.status !== 'duplicate_import';
  const statusStyle = STATUS_STYLE[draft.status];
  const sign = draft.kind === 'credit' ? '+' : '−';
  const showStatusChip = draft.status !== 'new' || draft.kind === 'fee' || draft.kind === 'credit';

  const chipLabel =
    draft.kind === 'credit'
      ? t('wiseImport.status_credit')
      : draft.status === 'duplicate_import'
        ? t('wiseImport.status_duplicate_import')
        : draft.status === 'possible_manual_dup'
          ? t('wiseImport.status_possible_manual_dup')
          : draft.kind === 'fee'
            ? t('wiseImport.kind_fee')
            : t('wiseImport.status_new');

  return (
    <button
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={`w-full text-left bg-surface-container rounded-xl p-3 flex items-center gap-3 btn-press ${
        canToggle ? '' : 'opacity-55'
      }`}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border"
        style={{
          background: checked ? 'var(--primary)' : 'transparent',
          borderColor: checked ? 'var(--primary)' : 'var(--surface-high)',
        }}
      >
        {checked && <Icon name="check" size={15} className="text-on-surface" />}
      </span>

      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--surface-high)' }}
      >
        <Icon name={getCategoryIcon(draft.category)} size={18} className="text-on-surface-dim" />
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-on-surface truncate">
          {draft.description}
        </span>
        <span className="block text-[11px] text-on-surface-faint truncate">
          {formatShortDate(draft.localDay)}
          {draft.city ? ` · ${draft.city}` : ''}
        </span>
      </span>

      <span className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`text-sm font-extrabold tabular ${draft.kind === 'credit' ? 'text-success' : 'text-on-surface'}`}
        >
          {sign}
          {formatMoney(draft.amountCents, draft.currency || baseCurrency).replace(/^[-−+]/, '')}
        </span>
        {showStatusChip && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: statusStyle.bg, color: statusStyle.color }}
          >
            {chipLabel}
          </span>
        )}
      </span>
    </button>
  );
}
