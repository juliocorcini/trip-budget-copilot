import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { isNativeApp } from '@/utils/native/platform';
import { takePendingSharedCsv } from '@/utils/native/share-target';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { parseWiseCsv } from '@/domain/import/wise-csv';
import { classifyWiseRows } from '@/domain/import/wise-import';
import type {
  WiseImportPlan,
  WiseImportDraft,
  WiseDraftStatus,
  WiseAllocation,
  WiseAllocationKind,
  ReimbursementBridge,
  WiseStatementRow,
} from '@/domain/import';
import {
  matchParticipantByName,
  buildDefaultAllocations,
  transferAllocationStatus,
  newAllocationId,
  detectReimbursementBridges,
  OUTGOING_ALLOCATION_KINDS,
  INCOMING_ALLOCATION_KINDS,
  PARTICIPANT_ALLOCATION_KINDS,
  WALLET_ALLOCATION_KINDS,
  EXPENSE_ALLOCATION_KINDS,
} from '@/domain/import';
import type { WiseExpenseBridge } from '@/domain/orchestrators';
import {
  commitWiseImport,
  commitWiseTransfers,
  undoWiseImportBatch,
  type WiseTransferCommitSpec,
} from '@/domain/orchestrators';
import { resolveActivePhase, formatShortDate, sortPhasesByOrder } from '@/domain/dates';
import { selectActivePhasePool } from '@/domain/budget';
import { getDefaultWallet } from '@/domain/wallets';
import { createPhase, getNextPhaseOrder } from '@/domain/phases';
import { formatMoney, sumCents, toCents } from '@/domain/money';
import { calculateDebts, createParticipant, type DebtSummary } from '@/domain/splitting';
import {
  walletRepository,
  participantRepository,
  participantShareRepository,
  settlementRepository,
  phaseRepository,
} from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import { getCategoryIcon } from '@/utils/category-icons';
import type { Wallet } from '@/domain/types/wallet';
import type { Participant } from '@/domain/types/participant';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { SplitExplainer } from '@/features/shared/SplitExplainer';
import { PhaseChargePicker } from '@/features/shared/PhaseChargePicker';
import { showToast } from '@/components/Toast';

type TargetWallet = string | 'new';

/** Per-transfer classification state (the user's split + matched person). */
interface TransferClassification {
  participantId: string | null;
  allocations: WiseAllocation[];
}

/** Curated categories offered when an allocation slice is an expense. */
const TRANSFER_EXPENSE_CATEGORIES = [
  'restaurant',
  'bar',
  'market',
  'transport',
  'accommodation',
  'entertainment',
  'gifts',
  'other',
];

const STATUS_STYLE: Record<WiseDraftStatus, { bg: string; color: string }> = {
  new: { bg: 'rgba(124,160,255,0.16)', color: 'var(--primary)' },
  possible_manual_dup: { bg: 'var(--warning-surface, rgba(212,160,80,0.18))', color: 'var(--warning)' },
  duplicate_import: { bg: 'var(--surface-high)', color: 'var(--on-surface-faint)' },
};

export function WiseImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, wallets, transactions, participants, loading, error, retry, reload } =
    useAppData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<WiseImportPlan | null>(null);
  // F16b: keep the parsed rows so a freshly created phase can re-classify them.
  const [rows, setRows] = useState<WiseStatementRow[]>([]);
  const [showCreatePhase, setShowCreatePhase] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<TargetWallet | null>(null);
  const [busy, setBusy] = useState(false);
  // FIELD-14: transfer intelligence — debts to suggest, per-transfer split state.
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [transferState, setTransferState] = useState<Record<string, TransferClassification>>({});
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  // F16: reimbursement bridges — purchase.rowId → confirmed split + the transfer
  // that repays it. Built from suggestions, always user-confirmed.
  const [bridgeState, setBridgeState] = useState<
    Record<string, WiseExpenseBridge & { transferRowId: string }>
  >({});
  const [activeBridge, setActiveBridge] = useState<ReimbursementBridge | null>(null);
  // Julio field feedback: optional "force every row into this phase" override.
  // null = AUTO (each row to the phase of its own date — the default).
  const [phaseOverride, setPhaseOverride] = useState<string | null>(null);

  const baseCurrency = trip?.baseCurrency ?? 'EUR';
  const owner = useMemo(() => participants.find((p) => p.isOwner) ?? null, [participants]);

  const sortedPhases = useMemo(
    () => sortPhasesByOrder(phases.filter((p) => p.deletedAt === null)),
    [phases],
  );
  // phaseId → its dedicated operational pool, so each imported row lands in the
  // pool of ITS phase (by date) instead of a single fixed first pool.
  const poolByPhaseId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of sortedPhases) {
      const pool = selectActivePhasePool(pools, links, p.id);
      if (pool) map[p.id] = pool.id;
    }
    return map;
  }, [sortedPhases, pools, links]);

  const transferDrafts = useMemo(
    () =>
      plan
        ? plan.drafts.filter((d) => d.kind === 'transfer' && d.status !== 'duplicate_import')
        : [],
    [plan],
  );

  // Load debts once a statement with transfers is on screen — powers the
  // "you owe X / they owe you Y" suggestions and the default split.
  useEffect(() => {
    if (!trip || !owner || transferDrafts.length === 0) return;
    let cancelled = false;
    void (async () => {
      const txIds = transactions.filter((tx) => tx.isShared).map((tx) => tx.id);
      const [shares, settlements] = await Promise.all([
        participantShareRepository.getAllForTrip(txIds),
        settlementRepository.getByTripId(trip.id),
      ]);
      if (cancelled) return;
      setDebtSummary(calculateDebts(transactions, shares, participants, settlements, owner.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, owner, transactions, participants, transferDrafts.length]);

  const debtFor = (participantId: string | null): { iOweCents: number; theyOweCents: number } => {
    if (!participantId || !debtSummary || !owner) return { iOweCents: 0, theyOweCents: 0 };
    let iOweCents = 0;
    let theyOweCents = 0;
    for (const d of debtSummary.debts) {
      if (d.debtorId === owner.id && d.creditorId === participantId) iOweCents += d.amountCents;
      if (d.debtorId === participantId && d.creditorId === owner.id) theyOweCents += d.amountCents;
    }
    return { iOweCents, theyOweCents };
  };

  // Seed each transfer with a suggested participant + default split the first
  // time we see it (re-seeds after debts arrive so the cap is accurate).
  useEffect(() => {
    if (transferDrafts.length === 0) return;
    setTransferState((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const draft of transferDrafts) {
        if (next[draft.rowId]) continue;
        const match = matchParticipantByName(draft.counterpartyName, participants);
        const participantId = match?.participantId ?? null;
        const debt = debtFor(participantId);
        next[draft.rowId] = {
          participantId,
          allocations: buildDefaultAllocations({
            direction: draft.direction,
            transferAmountCents: draft.amountCents,
            debtToPersonCents: debt.iOweCents,
            debtFromPersonCents: debt.theyOweCents,
            hasParticipant: participantId !== null,
            defaultCategory: draft.category,
          }),
        };
        changed = true;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferDrafts, participants, debtSummary]);

  const isTransferReady = (rowId: string): boolean => {
    const st = transferState[rowId];
    const draft = transferDrafts.find((d) => d.rowId === rowId);
    if (!st || !draft) return false;
    const status = transferAllocationStatus(draft.amountCents, st.allocations);
    if (!status.balanced || !status.amountsValid) return false;
    return st.allocations.every((a) => {
      if (a.kind === 'ignore') return true;
      if (PARTICIPANT_ALLOCATION_KINDS.has(a.kind) && !st.participantId) return false;
      if (WALLET_ALLOCATION_KINDS.has(a.kind) && !a.targetWalletId) return false;
      if (EXPENSE_ALLOCATION_KINDS.has(a.kind) && !a.category) return false;
      return true;
    });
  };

  const readyTransferIds = useMemo(
    () => transferDrafts.filter((d) => isTransferReady(d.rowId)).map((d) => d.rowId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transferDrafts, transferState],
  );

  const patchTransfer = (rowId: string, patch: Partial<TransferClassification>) => {
    setTransferState((prev) => {
      const current = prev[rowId];
      if (!current) return prev;
      return { ...prev, [rowId]: { ...current, ...patch } };
    });
  };

  const createParticipantInline = async (name: string): Promise<string | null> => {
    if (!trip || name.trim().length === 0) return null;
    const participant = createParticipant(trip.id, name.trim(), null);
    await participantRepository.create(participant);
    await reload();
    return participant.id;
  };

  // F16: suggested purchase ↔ incoming-repayment links, minus ones already linked.
  const bridgeSuggestions = useMemo<ReimbursementBridge[]>(
    () => (plan ? detectReimbursementBridges({ drafts: plan.drafts }) : []),
    [plan],
  );

  // F16b: importable rows whose date is outside every phase (only fallback-attached).
  const outOfPhaseDrafts = useMemo(
    () =>
      plan
        ? plan.drafts.filter((d) => !d.inPhase && d.importable && d.status !== 'duplicate_import')
        : [],
    [plan],
  );
  const outOfPhaseRange = useMemo(() => {
    if (outOfPhaseDrafts.length === 0) return null;
    const days = outOfPhaseDrafts.map((d) => d.localDay).sort();
    return { start: days[0]!, end: days[days.length - 1]! };
  }, [outOfPhaseDrafts]);

  /**
   * F16b: creates a phase inline and re-classifies the parsed rows against it, so
   * the out-of-phase purchases (e.g. a festival weekend) land in the new phase.
   * Selection/transfer/bridge state is keyed by rowId, so it survives the rebuild.
   */
  const createPhaseInline = async (name: string, startDate: string, endDate: string) => {
    if (!trip) return;
    const phase = createPhase({
      tripId: trip.id,
      name: name.trim(),
      startDate,
      endDate,
      order: getNextPhaseOrder(phases),
    });
    await phaseRepository.create(phase);
    setPlan(classifyWiseRows(rows, { existingTransactions: transactions, phases: [...phases, phase] }));
    setShowCreatePhase(false);
    showToast(t('wiseImport.phase_created', { name: name.trim() }), 'success');
    await reload();
  };

  /**
   * Applies a confirmed bridge: the purchase becomes a split (the person owes
   * `shareAmountCents`) and the incoming transfer is pre-classified to settle
   * exactly that — so the debt is born and repaid in the same import.
   */
  const applyBridge = (
    bridge: ReimbursementBridge,
    participantId: string,
    shareAmountCents: number,
  ) => {
    const settleCents = Math.min(shareAmountCents, bridge.transferAmountCents);
    const remainder = bridge.transferAmountCents - settleCents;
    const allocations: WiseAllocation[] = [
      { id: newAllocationId(), kind: 'settle_incoming', amountCents: settleCents },
    ];
    if (remainder > 0) {
      allocations.push({ id: newAllocationId(), kind: 'ignore', amountCents: remainder });
    }
    setBridgeState((prev) => ({
      ...prev,
      [bridge.candidate.rowId]: {
        participantId,
        shareAmountCents,
        transferRowId: bridge.transferRowId,
      },
    }));
    setTransferState((prev) => ({
      ...prev,
      [bridge.transferRowId]: { participantId, allocations },
    }));
    setIncluded((prev) => new Set(prev).add(bridge.candidate.rowId));
    setActiveBridge(null);
  };

  const removeBridge = (purchaseRowId: string) => {
    setBridgeState((prev) => {
      const next = { ...prev };
      delete next[purchaseRowId];
      return next;
    });
  };

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

  // Single ingestion path reused by the manual upload AND the native shared
  // CSV (B1 / DEC-215): parse → classify → preselect → pick the target wallet.
  const ingestCsvTexts = useCallback(
    (texts: string[]) => {
      const nonEmpty = texts.filter((text) => text.trim().length > 0);
      if (nonEmpty.length === 0) return;
      setParsing(true);
      try {
        const parsedRows = nonEmpty.flatMap((text) => parseWiseCsv(text));
        const built = classifyWiseRows(parsedRows, { existingTransactions: transactions, phases });
        setRows(parsedRows);
        setPlan(built);
        setIncluded(new Set(built.drafts.filter((d) => d.includeByDefault).map((d) => d.rowId)));
        const preferred =
          wallets.find((w) => /wise/i.test(w.name)) ??
          getDefaultWallet(wallets) ??
          wallets[0] ??
          null;
        setTarget(preferred ? preferred.id : 'new');
      } catch (err) {
        console.error('[wise-import] parse failed', err);
        showToast(t('wiseImport.parse_error'), 'danger');
      } finally {
        setParsing(false);
      }
    },
    [transactions, phases, wallets, t],
  );

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const texts = await Promise.all(files.map((f) => f.text()));
    ingestCsvTexts(texts);
  };

  // B1 (Onda 4 / DEC-215): a `.csv` shared from another app (Wise/Files) into
  // the native shell lands here. RootLayout routes the user to `?shared=1`; we
  // drain the in-memory CSV once the trip data is loaded and reuse the exact
  // same preview path as a manual upload. Native-only; no-op on web/PWA.
  const sharedHandledRef = useRef(false);
  useEffect(() => {
    if (sharedHandledRef.current || loading || !isNativeApp()) return;
    const csv = takePendingSharedCsv();
    if (!csv) return;
    sharedHandledRef.current = true;
    ingestCsvTexts([csv]);
  }, [loading, ingestCsvTexts]);

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
    const hasExpenses = selectedDrafts.length > 0;
    const hasTransfers = readyTransferIds.length > 0;
    if (!hasExpenses && !hasTransfers) {
      showToast(t('wiseImport.commit_empty'), 'warning');
      return;
    }
    // The phase money falls back to when a row has none: the forced phase if the
    // user picked one, else today's active phase.
    const fallbackPhase =
      (phaseOverride ? sortedPhases.find((p) => p.id === phaseOverride) : null) ??
      resolveActivePhase(phases);
    // The fallback pool must be the active phase's pool (DEC-219) — never a fixed
    // first `linked_phases` pool, which dumped imports into the wrong trecho.
    const operationalPool =
      selectActivePhasePool(pools, links, fallbackPhase?.id ?? null) ??
      pools.find((p) => p.scope === 'linked_phases') ??
      pools[0];
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

      const transactionIds: string[] = [];
      const settlementIds: string[] = [];

      if (hasExpenses) {
        // F16: only forward bridges whose purchase is actually being imported.
        const bridges: Record<string, WiseExpenseBridge> = {};
        for (const draft of selectedDrafts) {
          const b = bridgeState[draft.rowId];
          if (b) bridges[draft.rowId] = { participantId: b.participantId, shareAmountCents: b.shareAmountCents };
        }
        const hasBridges = Object.keys(bridges).length > 0;
        const result = await commitWiseImport({
          drafts: selectedDrafts,
          tripId: trip.id,
          budgetPoolId: operationalPool.id,
          walletId,
          fallbackPhaseId: fallbackPhase.id,
          poolByPhaseId,
          forcePhaseId: phaseOverride,
          ...(hasBridges && owner ? { ownerId: owner.id, bridges } : {}),
        });
        transactionIds.push(...result.transactionIds);
      }

      if (hasTransfers && owner) {
        const specs: WiseTransferCommitSpec[] = readyTransferIds.map((rowId) => {
          const st = transferState[rowId]!;
          const draft = transferDrafts.find((d) => d.rowId === rowId)!;
          return { draft, participantId: st.participantId, allocations: st.allocations };
        });
        const result = await commitWiseTransfers({
          specs,
          tripId: trip.id,
          ownerId: owner.id,
          budgetPoolId: operationalPool.id,
          sourceWalletId: walletId,
          fallbackPhaseId: fallbackPhase.id,
          poolByPhaseId,
          forcePhaseId: phaseOverride,
          baseCurrency,
        });
        transactionIds.push(...result.transactionIds);
        settlementIds.push(...result.settlementIds);
      }

      await reload();

      const count = transactionIds.length + settlementIds.length;
      showToast(t('wiseImport.imported_toast', { count }), 'success', {
        durationMs: 8000,
        actionLabel: t('common.undo'),
        onTap: () => {
          void undoWiseImportBatch({ transactionIds, settlementIds }).then(() => {
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
            {plan.summary.transferCount > 0 && (
              <Stat label={t('wiseImport.transfers')} value={plan.summary.transferCount} accent />
            )}
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

          {/* Julio field feedback: by default each row goes to the phase of its
              own date; this override forces ALL imported rows into one phase. */}
          <PhaseChargePicker
            phases={sortedPhases}
            value={phaseOverride}
            onChange={setPhaseOverride}
            label={t('phase_picker.label')}
            autoLabel={t('phase_picker.auto_each')}
          />

          {/* F16b: rows outside every phase — offer to create the missing phase. */}
          {outOfPhaseDrafts.length > 0 && (
            <div
              className="rounded-2xl p-3 flex items-start gap-3"
              style={{ background: 'var(--warning-surface, rgba(212,160,80,0.14))' }}
            >
              <Icon name="event_busy" size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface">
                  {t('wiseImport.out_of_phase_title', { count: outOfPhaseDrafts.length })}
                </p>
                <p className="text-[11px] text-on-surface-faint mt-0.5">
                  {t('wiseImport.out_of_phase_hint')}
                </p>
                <button
                  onClick={() => setShowCreatePhase(true)}
                  className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-on-surface btn-press inline-flex items-center gap-1"
                >
                  <Icon name="add" size={14} />
                  {t('wiseImport.create_phase')}
                </button>
              </div>
            </div>
          )}

          {/* F16: reimbursement bridges — link an incoming repayment to a purchase. */}
          {bridgeSuggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mt-1">
                <Icon name="hub" size={16} className="text-primary" />
                <p className="text-xs font-semibold text-on-surface">{t('wiseImport.bridge_title')}</p>
              </div>
              <p className="text-[11px] text-on-surface-faint -mt-1">{t('wiseImport.bridge_hint')}</p>
              {bridgeSuggestions.map((b) => (
                <BridgeRow
                  key={`${b.candidate.rowId}-${b.transferRowId}`}
                  bridge={b}
                  linkedName={
                    bridgeState[b.candidate.rowId]
                      ? participantName(participants, bridgeState[b.candidate.rowId]!.participantId)
                      : null
                  }
                  baseCurrency={baseCurrency}
                  onOpen={() => setActiveBridge(b)}
                  onRemove={() => removeBridge(b.candidate.rowId)}
                />
              ))}
            </div>
          )}

          {/* FIELD-14: transfers to people — classified, not auto-imported. */}
          {transferDrafts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mt-1">
                <Icon name="swap_horiz" size={16} className="text-primary" />
                <p className="text-xs font-semibold text-on-surface">
                  {t('wiseImport.transfers_title')}
                </p>
              </div>
              <p className="text-[11px] text-on-surface-faint -mt-1">
                {t('wiseImport.transfers_hint')}
              </p>
              {transferDrafts.map((draft) => (
                <TransferRow
                  key={draft.rowId}
                  draft={draft}
                  classification={transferState[draft.rowId]}
                  participants={participants}
                  ready={isTransferReady(draft.rowId)}
                  baseCurrency={baseCurrency}
                  onOpen={() => setActiveTransferId(draft.rowId)}
                />
              ))}
            </div>
          )}

          {/* Review list (plain expenses + fees; transfers/credits handled apart) */}
          {plan.drafts.some((d) => d.kind !== 'transfer') && (
            <>
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
                {plan.drafts
                  .filter((d) => d.kind !== 'transfer')
                  .map((draft) => (
                    <DraftRow
                      key={draft.rowId}
                      draft={draft}
                      checked={included.has(draft.rowId)}
                      onToggle={() => toggle(draft.rowId)}
                      baseCurrency={baseCurrency}
                      linkedName={
                        bridgeState[draft.rowId]
                          ? participantName(participants, bridgeState[draft.rowId]!.participantId)
                          : null
                      }
                    />
                  ))}
              </div>
            </>
          )}
        </>
      )}

      {/* F16b: create-phase sheet (pre-filled with the out-of-phase date range). */}
      {showCreatePhase && outOfPhaseRange && (
        <CreatePhaseSheet
          defaultStart={outOfPhaseRange.start}
          defaultEnd={outOfPhaseRange.end}
          onCreate={createPhaseInline}
          onClose={() => setShowCreatePhase(false)}
        />
      )}

      {/* F16: bridge confirmation sheet (pick/create person + confirm the share). */}
      {activeBridge && (
        <BridgeConfirmSheet
          bridge={activeBridge}
          participants={participants}
          baseCurrency={baseCurrency}
          onApply={applyBridge}
          onCreateParticipant={createParticipantInline}
          onClose={() => setActiveBridge(null)}
        />
      )}

      {/* FIELD-14: transfer classification sheet (match person + split). */}
      {activeTransferId &&
        (() => {
          const draft = transferDrafts.find((d) => d.rowId === activeTransferId);
          const classification = transferState[activeTransferId];
          if (!draft || !classification) return null;
          return (
            <TransferClassifySheet
              draft={draft}
              classification={classification}
              participants={participants}
              wallets={wallets}
              sourceWalletId={typeof target === 'string' && target !== 'new' ? target : null}
              debt={debtFor(classification.participantId)}
              baseCurrency={baseCurrency}
              onPatch={(patch) => patchTransfer(draft.rowId, patch)}
              onCreateParticipant={createParticipantInline}
              onClose={() => setActiveTransferId(null)}
            />
          );
        })()}

      {hasDrafts && (
        <div
          className="fixed inset-x-0 bottom-0 px-5"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)', paddingTop: 12, background: 'linear-gradient(to top, var(--surface-base) 70%, transparent)' }}
        >
          <div className="max-w-[430px] mx-auto">
            <button
              onClick={handleCommit}
              disabled={busy || (selectedDrafts.length === 0 && readyTransferIds.length === 0)}
              className="w-full py-3.5 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-40"
            >
              {busy
                ? t('common.loading')
                : selectedDrafts.length === 0 && readyTransferIds.length === 0
                  ? t('wiseImport.commit_empty')
                  : readyTransferIds.length > 0
                    ? t('wiseImport.commit_items', {
                        count: selectedDrafts.length + readyTransferIds.length,
                      })
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
  linkedName,
}: {
  draft: WiseImportDraft;
  checked: boolean;
  onToggle: () => void;
  baseCurrency: string;
  linkedName?: string | null;
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
        {linkedName && (
          <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(124,160,255,0.16)', color: 'var(--primary)' }}>
            <Icon name="hub" size={10} />
            {t('wiseImport.bridge_split_with', { name: linkedName })}
          </span>
        )}
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

/* ────────────────────── F16b: create-phase-on-import UI ────────────────────── */

function CreatePhaseSheet({
  defaultStart,
  defaultEnd,
  onCreate,
  onClose,
}: {
  defaultStart: string;
  defaultEnd: string;
  onCreate: (name: string, startDate: string, endDate: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const valid = name.trim().length > 0 && start <= end;

  return (
    <BottomSheet open onClose={onClose} title={t('wiseImport.create_phase_title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[11px] text-on-surface-faint">{t('wiseImport.create_phase_hint')}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface">{t('wiseImport.phase_name')}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('wiseImport.phase_name_ph')}
            className="px-3 py-2.5 rounded-xl text-sm bg-surface-high text-on-surface outline-none"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-on-surface">{t('wiseImport.phase_start')}</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm bg-surface-high text-on-surface outline-none"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-on-surface">{t('wiseImport.phase_end')}</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm bg-surface-high text-on-surface outline-none"
            />
          </label>
        </div>
        <button
          onClick={() => valid && onCreate(name, start, end)}
          disabled={!valid}
          className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press mt-1 disabled:opacity-40"
        >
          {t('wiseImport.create_phase')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ────────────────────── F16: reimbursement bridge UI ────────────────────── */

function BridgeRow({
  bridge,
  linkedName,
  baseCurrency,
  onOpen,
  onRemove,
}: {
  bridge: ReimbursementBridge;
  linkedName: string | null;
  baseCurrency: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const linked = linkedName !== null;
  return (
    <div className="w-full bg-surface-container rounded-xl p-3 flex items-center gap-3">
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: linked ? 'rgba(106,196,140,0.18)' : 'rgba(124,160,255,0.16)' }}
      >
        <Icon
          name={linked ? 'check_circle' : 'hub'}
          size={18}
          className={linked ? 'text-success' : 'text-primary'}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-on-surface truncate">
          {bridge.candidate.description}
        </span>
        <span className="block text-[11px] text-on-surface-faint">
          {linked
            ? t('wiseImport.bridge_linked', {
                name: linkedName,
                share: formatMoney(bridge.transferAmountCents, baseCurrency),
              })
            : t('wiseImport.bridge_suggestion', {
                name: bridge.counterpartyName ?? t('wiseImport.bridge_someone'),
                in: formatMoney(bridge.transferAmountCents, baseCurrency),
                total: formatMoney(bridge.candidate.amountCents, baseCurrency),
              })}
        </span>
      </span>
      {linked ? (
        <button onClick={onRemove} className="btn-press p-1 shrink-0" aria-label={t('common.delete')}>
          <Icon name="close" size={16} className="text-on-surface-faint" />
        </button>
      ) : (
        <button
          onClick={onOpen}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-on-surface btn-press shrink-0"
        >
          {t('wiseImport.bridge_review')}
        </button>
      )}
    </div>
  );
}

function BridgeConfirmSheet({
  bridge,
  participants,
  baseCurrency,
  onApply,
  onCreateParticipant,
  onClose,
}: {
  bridge: ReimbursementBridge;
  participants: Participant[];
  baseCurrency: string;
  onApply: (bridge: ReimbursementBridge, participantId: string, shareAmountCents: number) => void;
  onCreateParticipant: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const suggested = matchParticipantByName(bridge.counterpartyName, participants);
  const others = participants.filter((p) => !p.isOwner);
  const [participantId, setParticipantId] = useState<string | null>(suggested?.participantId ?? null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState(bridge.counterpartyName ?? '');
  const share = bridge.transferAmountCents;

  const handleCreate = async () => {
    const id = await onCreateParticipant(newName);
    if (id) {
      setParticipantId(id);
      setShowNewInput(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose} title={t('wiseImport.bridge_sheet_title')}>
      <div className="flex flex-col gap-4 pb-2">
        {/* The pair: purchase vs incoming repayment. */}
        <div className="bg-surface-container rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-on-surface truncate">
              {bridge.candidate.description}
            </span>
            <span className="text-sm font-extrabold tabular text-on-surface shrink-0">
              −{formatMoney(bridge.candidate.amountCents, baseCurrency).replace(/^[-−+]/, '')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-faint">
              {bridge.counterpartyName ?? t('wiseImport.bridge_someone')} ·{' '}
              {t('wiseImport.bridge_days_apart', { count: bridge.daysApart })}
            </span>
            <span className="text-sm font-extrabold tabular text-success shrink-0">
              +{formatMoney(bridge.transferAmountCents, baseCurrency).replace(/^[-−+]/, '')}
            </span>
          </div>
        </div>

        {/* Person picker (suggested + create). */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-on-surface">{t('wiseImport.transfer_person')}</p>
          <div className="flex gap-2 flex-wrap">
            {others.map((p) => (
              <button
                key={p.id}
                onClick={() => setParticipantId(p.id)}
                className={`px-3 py-2 rounded-xl text-xs font-medium btn-press flex items-center gap-1.5 ${
                  participantId === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {p.name}
                {suggested?.participantId === p.id && (
                  <span className="text-[9px] font-bold opacity-80">
                    · {t('wiseImport.transfer_suggested')}
                  </span>
                )}
              </button>
            ))}
            {showNewInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('wiseImport.transfer_new_person')}
                  className="px-3 py-2 rounded-xl text-xs bg-surface-high text-on-surface w-32 outline-none"
                />
                <button
                  onClick={handleCreate}
                  disabled={newName.trim().length === 0}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center btn-press disabled:opacity-40"
                >
                  <Icon name="check" size={16} className="text-on-surface" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewInput(true)}
                className="px-3 py-2 rounded-xl text-xs font-medium btn-press flex items-center gap-1 bg-surface-high text-on-surface-dim"
              >
                <Icon name="add" size={14} />
                {t('wiseImport.transfer_new_person')}
              </button>
            )}
          </div>
        </div>

        {/* What this means, in money. */}
        <div className="rounded-2xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(124,160,255,0.10)' }}>
          <p className="text-[11px] text-on-surface-dim leading-relaxed">
            {t('wiseImport.bridge_explainer', {
              name: participantName(participants, participantId) || (bridge.counterpartyName ?? t('wiseImport.bridge_someone')),
              share: formatMoney(share, baseCurrency),
              total: formatMoney(bridge.candidate.amountCents, baseCurrency),
            })}
          </p>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--primary-dim)' }}>
            {t('wiseImport.bridge_my_cost', {
              amount: formatMoney(bridge.ownerShareCents, baseCurrency),
            })}
          </p>
        </div>

        <button
          onClick={() => participantId && onApply(bridge, participantId, share)}
          disabled={!participantId}
          className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press mt-1 disabled:opacity-40"
        >
          {t('wiseImport.bridge_confirm')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ────────────────────── FIELD-14: transfer UI ────────────────────── */

const ALLOCATION_KIND_ICON: Record<WiseAllocationKind, string> = {
  pay_debt: 'paid',
  person_paid_expense: 'handshake',
  wallet_transfer: 'account_balance_wallet',
  my_expense: 'receipt_long',
  settle_incoming: 'savings',
  ignore: 'block',
};

function participantName(participants: Participant[], id: string | null): string {
  if (!id) return '';
  return participants.find((p) => p.id === id)?.name ?? '';
}

function allocationSummary(
  allocations: WiseAllocation[],
  t: (k: string) => string,
  currency: string,
): string {
  const parts = allocations
    .filter((a) => a.kind !== 'ignore' && a.amountCents > 0)
    .map((a) => `${t(`wiseImport.alloc_${a.kind}`)} ${formatMoney(a.amountCents, currency)}`);
  return parts.join(' · ');
}

function TransferRow({
  draft,
  classification,
  participants,
  ready,
  baseCurrency,
  onOpen,
}: {
  draft: WiseImportDraft;
  classification: TransferClassification | undefined;
  participants: Participant[];
  ready: boolean;
  baseCurrency: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const currency = draft.currency || baseCurrency;
  const matchedName = participantName(participants, classification?.participantId ?? null);
  const summary = classification ? allocationSummary(classification.allocations, t, currency) : '';
  const sign = draft.direction === 'in' ? '+' : '−';

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-surface-container rounded-xl p-3 flex items-center gap-3 btn-press"
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(124,160,255,0.16)' }}
      >
        <Icon name="swap_horiz" size={18} className="text-primary" />
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-on-surface truncate">
          {draft.counterpartyName ?? draft.description}
        </span>
        <span className="block text-[11px] text-on-surface-faint truncate">
          {summary.length > 0
            ? summary
            : matchedName
              ? t('wiseImport.transfer_tap_classify')
              : t('wiseImport.transfer_tap_classify')}
        </span>
      </span>

      <span className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`text-sm font-extrabold tabular ${draft.direction === 'in' ? 'text-success' : 'text-on-surface'}`}
        >
          {sign}
          {formatMoney(draft.amountCents, currency).replace(/^[-−+]/, '')}
        </span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{
            background: ready ? 'rgba(106,196,140,0.18)' : 'var(--warning-surface, rgba(212,160,80,0.18))',
            color: ready ? 'var(--success)' : 'var(--warning)',
          }}
        >
          <Icon name={ready ? 'check_circle' : 'tune'} size={10} />
          {ready ? t('wiseImport.transfer_ready') : t('wiseImport.transfer_review')}
        </span>
      </span>
    </button>
  );
}

function TransferClassifySheet({
  draft,
  classification,
  participants,
  wallets,
  sourceWalletId,
  debt,
  baseCurrency,
  onPatch,
  onCreateParticipant,
  onClose,
}: {
  draft: WiseImportDraft;
  classification: TransferClassification;
  participants: Participant[];
  wallets: Wallet[];
  sourceWalletId: string | null;
  debt: { iOweCents: number; theyOweCents: number };
  baseCurrency: string;
  onPatch: (patch: Partial<TransferClassification>) => void;
  onCreateParticipant: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const currency = draft.currency || baseCurrency;
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');
  const others = participants.filter((p) => !p.isOwner);
  const suggested = matchParticipantByName(draft.counterpartyName, participants);
  const matchedName = participantName(participants, classification.participantId);

  const status = transferAllocationStatus(draft.amountCents, classification.allocations);
  const remainingColor =
    status.remainingCents === 0 ? 'var(--success)' : status.remainingCents > 0 ? 'var(--warning)' : 'var(--error)';

  const updateAlloc = (id: string, patch: Partial<WiseAllocation>) =>
    onPatch({
      allocations: classification.allocations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  const removeAlloc = (id: string) =>
    onPatch({ allocations: classification.allocations.filter((a) => a.id !== id) });
  const addAlloc = () => {
    const remaining = status.remainingCents > 0 ? status.remainingCents : 0;
    const kind: WiseAllocationKind = draft.direction === 'out' ? 'my_expense' : 'ignore';
    onPatch({
      allocations: [
        ...classification.allocations,
        {
          id: newAllocationId(),
          kind,
          amountCents: remaining,
          category: draft.direction === 'out' ? draft.category : undefined,
        },
      ],
    });
  };

  const handleCreate = async () => {
    const id = await onCreateParticipant(newName);
    if (id) {
      onPatch({ participantId: id });
      setShowNewInput(false);
      setNewName('');
    }
  };

  return (
    <BottomSheet open onClose={onClose} title={t('wiseImport.transfer_sheet_title')}>
      <div className="flex flex-col gap-4 pb-2">
        {/* Header: who + how much */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">
              {draft.counterpartyName ?? draft.description}
            </p>
            <p className="text-[11px] text-on-surface-faint">
              {formatShortDate(draft.localDay)} ·{' '}
              {draft.direction === 'in'
                ? t('wiseImport.transfer_incoming')
                : t('wiseImport.transfer_outgoing')}
            </p>
          </div>
          <p className="text-lg font-extrabold tabular text-on-surface shrink-0">
            {formatMoney(draft.amountCents, currency)}
          </p>
        </div>

        {/* Participant match */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-on-surface">{t('wiseImport.transfer_person')}</p>
          <div className="flex gap-2 flex-wrap">
            {others.map((p) => (
              <button
                key={p.id}
                onClick={() => onPatch({ participantId: p.id })}
                className={`px-3 py-2 rounded-xl text-xs font-medium btn-press flex items-center gap-1.5 ${
                  classification.participantId === p.id
                    ? 'bg-primary text-on-surface'
                    : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {p.name}
                {suggested?.participantId === p.id && (
                  <span className="text-[9px] font-bold opacity-80">
                    · {t('wiseImport.transfer_suggested')}
                  </span>
                )}
              </button>
            ))}
            {showNewInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('wiseImport.transfer_new_person')}
                  className="px-3 py-2 rounded-xl text-xs bg-surface-high text-on-surface w-32 outline-none"
                />
                <button
                  onClick={handleCreate}
                  disabled={newName.trim().length === 0}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center btn-press disabled:opacity-40"
                >
                  <Icon name="check" size={16} className="text-on-surface" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewInput(true)}
                className="px-3 py-2 rounded-xl text-xs font-medium btn-press flex items-center gap-1 bg-surface-high text-on-surface-dim"
              >
                <Icon name="add" size={14} />
                {t('wiseImport.transfer_new_person')}
              </button>
            )}
          </div>
          {classification.participantId && (debt.iOweCents > 0 || debt.theyOweCents > 0) && (
            <p className="text-[11px] font-semibold" style={{ color: 'var(--primary-dim)' }}>
              {debt.iOweCents > 0
                ? t('wiseImport.transfer_you_owe', {
                    name: matchedName,
                    amount: formatMoney(debt.iOweCents, currency),
                  })
                : t('wiseImport.transfer_they_owe', {
                    name: matchedName,
                    amount: formatMoney(debt.theyOweCents, currency),
                  })}
            </p>
          )}
        </div>

        {/* OD-3 (DEC-231/DEC-242 · G9): the single shared "how splitting works"
            explainer, collapsed by default — so splitting a Wise transfer with
            someone reads the identical explanation as QuickAdd/Receipt/Shared,
            the 4th and final split surface. Copy source already exists. */}
        <SplitExplainer />

        {/* Allocations */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-on-surface">{t('wiseImport.transfer_split')}</p>
            <span className="text-[11px] font-bold tabular" style={{ color: remainingColor }}>
              {t('wiseImport.transfer_remaining', {
                amount: formatMoney(status.remainingCents, currency),
              })}
            </span>
          </div>
          {classification.allocations.map((alloc) => (
            <AllocationEditorRow
              key={alloc.id}
              alloc={alloc}
              direction={draft.direction}
              wallets={wallets}
              sourceWalletId={sourceWalletId}
              baseCurrency={currency}
              draftCategory={draft.category}
              canRemove={classification.allocations.length > 1}
              onChange={(patch) => updateAlloc(alloc.id, patch)}
              onRemove={() => removeAlloc(alloc.id)}
            />
          ))}
          <button
            onClick={addAlloc}
            className="self-start text-[11px] font-semibold text-primary btn-press flex items-center gap-1 mt-0.5"
          >
            <Icon name="add" size={14} />
            {t('wiseImport.transfer_add_slice')}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press mt-1"
        >
          {status.balanced && status.amountsValid
            ? t('wiseImport.transfer_done')
            : t('wiseImport.transfer_keep_editing')}
        </button>
      </div>
    </BottomSheet>
  );
}

function AllocationEditorRow({
  alloc,
  direction,
  wallets,
  sourceWalletId,
  baseCurrency,
  draftCategory,
  canRemove,
  onChange,
  onRemove,
}: {
  alloc: WiseAllocation;
  direction: WiseImportDraft['direction'];
  wallets: Wallet[];
  sourceWalletId: string | null;
  baseCurrency: string;
  draftCategory: string;
  canRemove: boolean;
  onChange: (patch: Partial<WiseAllocation>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const kinds = direction === 'out' ? OUTGOING_ALLOCATION_KINDS : INCOMING_ALLOCATION_KINDS;
  const otherWallets = wallets.filter((w) => w.id !== sourceWalletId);
  const [amountStr, setAmountStr] = useState((alloc.amountCents / 100).toFixed(2));

  // Re-sync only when the value changed from OUTSIDE (e.g. "add slice" fills the
  // remainder) — never while the user is typing (parsed === stored ⇒ skip).
  useEffect(() => {
    const parsed = Number(amountStr.replace(',', '.'));
    const localCents = Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0;
    if (localCents !== alloc.amountCents) setAmountStr((alloc.amountCents / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alloc.amountCents]);

  const handleAmount = (value: string) => {
    setAmountStr(value);
    const parsed = Number(value.replace(',', '.'));
    onChange({ amountCents: Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0 });
  };

  const changeKind = (kind: WiseAllocationKind) => {
    onChange({
      kind,
      category: EXPENSE_ALLOCATION_KINDS.has(kind) ? (alloc.category ?? draftCategory) : undefined,
      targetWalletId: WALLET_ALLOCATION_KINDS.has(kind)
        ? (alloc.targetWalletId ?? otherWallets[0]?.id ?? null)
        : undefined,
    });
  };

  return (
    <div className="bg-surface-high rounded-xl p-2.5 flex flex-col gap-2">
      {/* Kind + amount + remove */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar" data-no-tab-swipe>
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => changeKind(k)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold btn-press flex items-center gap-1 shrink-0 ${
                alloc.kind === k ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'
              }`}
            >
              <Icon name={ALLOCATION_KIND_ICON[k]} size={12} />
              {t(`wiseImport.alloc_${k}`)}
            </button>
          ))}
        </div>
        {canRemove && (
          <button onClick={onRemove} className="btn-press p-1 shrink-0" aria-label={t('common.delete')}>
            <Icon name="close" size={16} className="text-on-surface-faint" />
          </button>
        )}
      </div>

      {alloc.kind !== 'ignore' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-faint shrink-0">{baseCurrency}</span>
          <input
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => handleAmount(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm tabular bg-surface-container text-on-surface outline-none"
          />
        </div>
      )}

      {/* Category picker for expense slices */}
      {EXPENSE_ALLOCATION_KINDS.has(alloc.kind) && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" data-no-tab-swipe>
          {TRANSFER_EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange({ category: cat })}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium btn-press flex items-center gap-1 shrink-0 ${
                alloc.category === cat ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'
              }`}
            >
              <Icon name={getCategoryIcon(cat)} size={12} />
              {t(`categories.${cat}`)}
            </button>
          ))}
        </div>
      )}

      {/* Target wallet picker for wallet moves */}
      {WALLET_ALLOCATION_KINDS.has(alloc.kind) && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" data-no-tab-swipe>
          {otherWallets.length === 0 ? (
            <span className="text-[10px] text-on-surface-faint">{t('wiseImport.transfer_no_wallet')}</span>
          ) : (
            otherWallets.map((w) => (
              <button
                key={w.id}
                onClick={() => onChange({ targetWalletId: w.id })}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium btn-press shrink-0 ${
                  alloc.targetWalletId === w.id
                    ? 'bg-primary text-on-surface'
                    : 'bg-surface-container text-on-surface-dim'
                }`}
              >
                {w.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
