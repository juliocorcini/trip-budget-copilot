import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  createExpenseTransaction,
  suggestFromDescription,
  getFrequentExpenses,
  getCategoryTypicalCents,
  detectAmountAnomaly,
} from '@/domain/transactions';
import type { ExpenseSuggestion } from '@/domain/transactions';
import { resolvePayerExpense } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import { resolveActivePhase, toSafeIsoDate } from '@/domain/dates';
import { toCents, fromCents, formatMoney, formatAnchorHint, evaluateAmountExpression } from '@/domain/money';
import { getAvailablePoolsForPhase, calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { registerExpense, transferBetweenWallets, withdrawCash } from '@/domain/orchestrators';
import { requestPersistentStorage } from '@/utils/pwa';
import { recordExpenseForSnapshot } from '@/utils/emergency-snapshot';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import type { ShareType } from '@/domain/types/common';

const CATEGORY_KEYS = [
  'bar',
  'restaurant',
  'market',
  'transport',
  'outing',
  'entertainment',
  'health',
  'accommodation',
  'other',
] as const;

export function QuickAddPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, settings, error, reload, retry } =
    useAppData();

  const initialCategory = searchParams.get('cat') ?? 'other';
  const txType = searchParams.get('type') ?? 'expense';
  const isTransfer = txType === 'transfer';
  const isWithdrawal = txType === 'withdrawal';
  const isTransferLike = isTransfer || isWithdrawal;

  // R6-21: the simulator CTA pre-fills the amount (?amount=).
  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount');
    if (!prefill) return '';
    const parsed = parseFloat(prefill);
    return Number.isNaN(parsed) || parsed <= 0 ? '' : String(parsed);
  });
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null);
  const [poolId, setPoolId] = useState<string>('');
  // GAP-027: optional retroactive date/time (empty = now)
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [isShared, setIsShared] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  // DEC-123 (D-R4-J): "Who paid?" is a first-level question (null = me).
  const [paidById, setPaidById] = useState<string | null>(null);
  // DEC-123: when someone else paid — they paid everything for me OR we split.
  const [otherPaidSplit, setOtherPaidSplit] = useState(false);
  const [splitMode, setSplitMode] = useState<ShareType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showZeroBudgetConfirm, setShowZeroBudgetConfirm] = useState(false);
  // M5: confirm an amount far above the category typical (never blocks — DEC-053).
  const [showAnomalyConfirm, setShowAnomalyConfirm] = useState(false);
  // M4: offer to duplicate a transport expense as a round trip.
  const [showRoundTrip, setShowRoundTrip] = useState(false);

  // BUG-002 (R6-02): never fall back to phases[0] — resolveActivePhase picks
  // the nearest phase (current, else last past, else first future).
  const currentPhase = resolveActivePhase(phases);
  const defaultWallet = wallets.find((w) => w.isDefault);

  // Withdrawal pulls from a non-cash wallet into a cash wallet (Core Rule 3).
  const defaultSourceWallet = isWithdrawal
    ? (wallets.find((w) => w.isDefault && w.walletType !== 'cash') ??
       wallets.find((w) => w.walletType !== 'cash') ??
       defaultWallet)
    : defaultWallet;
  const effectiveSourceWalletId = walletId ?? defaultSourceWallet?.id ?? null;

  const cashWallets = wallets.filter((w) => w.walletType === 'cash');
  const targetCandidates = (isWithdrawal && cashWallets.length > 0 ? cashWallets : wallets).filter(
    (w) => w.id !== effectiveSourceWalletId,
  );
  const effectiveTargetWalletId =
    targetWalletId && targetCandidates.some((w) => w.id === targetWalletId)
      ? targetWalletId
      : targetCandidates.length === 1
        ? targetCandidates[0]!.id
        : null;

  const effectiveWalletId = walletId ?? defaultWallet?.id ?? null;

  // DEC-039/040: only pools linked to the active phase + global pools are
  // selectable; auto-select happens only with exactly one operational pool.
  const availablePools = currentPhase
    ? getAvailablePoolsForPhase(pools, links, currentPhase.id)
    : { operational: [], global: [], autoSelectedPoolId: null };
  const selectablePools = [...availablePools.operational, ...availablePools.global];
  const effectivePoolId =
    poolId && selectablePools.some((p) => p.id === poolId)
      ? poolId
      : (availablePools.autoSelectedPoolId ?? '');

  const selectedPool = selectablePools.find((p) => p.id === effectivePoolId) ?? null;
  const selectedPoolFreeToSpendCents =
    selectedPool && currentPhase
      ? calculateFreeToSpend(
          selectedPool,
          envelopes.filter((e) => e.budgetPoolId === selectedPool.id),
          filterTransactionsByPool(transactions, selectedPool.id),
          links.filter((l) => l.budgetPoolId === selectedPool.id),
          currentPhase.id,
          occurrences,
        ).freeToSpendCents
      : null;

  const owner = participants.find((p) => p.isOwner) ?? null;
  const effectivePaidById = paidById ?? owner?.id ?? null;
  const canSplit = !isTransferLike && participants.length > 1;
  // DEC-123: someone else paid — first-level state, independent of splitting.
  const otherPaid = owner !== null && effectivePaidById !== null && effectivePaidById !== owner.id;
  const wantsSplit = otherPaid ? otherPaidSplit : isShared;
  const payer = participants.find((p) => p.id === effectivePaidById) ?? null;
  const payerName = payer ? (payer.nickname ?? payer.name) : '';

  const toggleShared = () => {
    setIsShared((prev) => {
      const next = !prev;
      if (next && selectedParticipantIds.length === 0) {
        setSelectedParticipantIds(participants.map((p) => p.id));
      }
      return next;
    });
  };

  const selectPayer = (id: string) => {
    setPaidById(id);
    // DEC-123: simple case prefilled — splitting with the payer needs no setup.
    if (owner && id !== owner.id && selectedParticipantIds.length < 2) {
      setSelectedParticipantIds([owner.id, id]);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  // M1: the amount field accepts a calculator expression ("12+3,50").
  const evaluatedAmount = evaluateAmountExpression(amount);
  const amountCentsPreview =
    evaluatedAmount !== null && evaluatedAmount > 0 ? toCents(evaluatedAmount) : 0;

  // M2/M3/M5: capture helpers derived purely from existing transactions.
  const frequentExpenses = !isTransferLike ? getFrequentExpenses(transactions) : [];
  const descriptionSuggestion = !isTransferLike
    ? suggestFromDescription(transactions, description)
    : null;
  const categoryTypicalCents = !isTransferLike ? getCategoryTypicalCents(transactions, category) : 0;
  const isAmountAnomaly = !isTransferLike && detectAmountAnomaly(amountCentsPreview, categoryTypicalCents);

  const applySuggestion = (suggestion: ExpenseSuggestion) => {
    setCategory(suggestion.category);
    setDescription(suggestion.description);
    setAmount(String(fromCents(suggestion.amountCents)));
  };

  // DEC-128: mental anchor while typing — "€20 ≈ R$ 124".
  const anchorHint =
    settings && trip && amountCentsPreview > 0
      ? formatAnchorHint(
          amountCentsPreview,
          { anchorCurrency: settings.anchorCurrency, anchorRatePer1: settings.anchorRatePer1 },
          trip.baseCurrency,
        )
      : null;

  const customSumCents = selectedParticipantIds.reduce((sum, pid) => {
    const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
    return sum + (Number.isNaN(value) ? 0 : Math.round(value * 100));
  }, 0);
  const customRemainingCents = amountCentsPreview - customSumCents;

  const previewShareCents =
    wantsSplit && selectedParticipantIds.length > 0 && owner && selectedParticipantIds.includes(owner.id)
      ? splitMode === 'equal'
        ? Math.round(amountCentsPreview / selectedParticipantIds.length)
        : (() => {
            const value = parseFloat((customAmounts[owner.id] ?? '').replace(',', '.'));
            return Number.isNaN(value) ? 0 : Math.round(value * 100);
          })()
      : null;

  const canSaveTransferLike =
    !isTransferLike ||
    (effectiveSourceWalletId !== null &&
      effectiveTargetWalletId !== null &&
      effectiveSourceWalletId !== effectiveTargetWalletId);

  // Builds the expense transaction + shares from the current form state. Reading
  // it on demand lets M4 register an identical return trip with a fresh id.
  const buildExpense = () => {
    const amountCents = toCents(evaluatedAmount!);
    const tx = createExpenseTransaction({
      tripId: trip!.id,
      phaseId: currentPhase!.id,
      budgetPoolId: effectivePoolId,
      walletId: effectiveWalletId,
      amountCents,
      currency: trip!.baseCurrency,
      category,
      description: description || t(`categories.${category}` as never),
      date: customDate ? toSafeIsoDate(customDate) : undefined,
    });

    const splitActive =
      canSplit && wantsSplit && selectedParticipantIds.length >= 2 && effectivePaidById !== null;
    // DEC-114/123: the payer flow applies whenever someone else paid (even
    // without splitting — truth-table row 4) or a split is active.
    const payerFlowActive =
      owner !== null && effectivePaidById !== null && (otherPaid || splitActive);

    let finalShares: ParticipantShare[] = [];
    if (payerFlowActive) {
      const customAmountsCents = Object.fromEntries(
        selectedParticipantIds.map((pid) => {
          const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
          return [pid, Number.isNaN(value) ? 0 : Math.round(value * 100)];
        }),
      );
      const resolution = resolvePayerExpense({
        transactionId: tx.id,
        amountCents,
        ownerId: owner!.id,
        payerId: effectivePaidById!,
        didSplit: splitActive,
        participantIds: selectedParticipantIds,
        shareType: splitMode,
        customAmountsCents,
      });
      tx.isShared = resolution.isShared;
      tx.paidByParticipantId = effectivePaidById;
      tx.personalCostCents = resolution.personalCostCents;
      // When someone else paid, no money left the user's wallets (DEC-114).
      if (!resolution.movesOwnerWallet) tx.walletId = null;
      finalShares = resolution.shares;
    }

    return { transaction: tx, shares: finalShares };
  };

  const persistExpense = async () => {
    const { transaction, shares } = buildExpense();
    await registerExpense({ transaction, shares });
    // GAP-R2-005: idempotent — ensures storage persistence after the first expense.
    requestPersistentStorage();
    // BUG-002: refresh the emergency snapshot every few expenses (best-effort).
    void recordExpenseForSnapshot();
  };

  const finishAndGoHome = async () => {
    await reload();
    navigate('/dashboard');
  };

  // Actually registers the expense (after any confirmation sheets are cleared).
  const commitExpense = async () => {
    if (!trip || !currentPhase || evaluatedAmount === null || evaluatedAmount <= 0) return;
    setShowAnomalyConfirm(false);
    setShowZeroBudgetConfirm(false);
    setSaving(true);
    try {
      await persistExpense();
      // M4: a transport expense offers to log the return trip too.
      if (category === 'transport') {
        setShowRoundTrip(true);
        return;
      }
      await finishAndGoHome();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!trip || !currentPhase || evaluatedAmount === null || evaluatedAmount <= 0) return;

    // Transfers and withdrawals move money between wallets and never touch the
    // budget (budgetPoolId/personalCostCents = null — Core Rule 3).
    if (isTransferLike) {
      if (!canSaveTransferLike) return;
      setSaving(true);
      try {
        const input = {
          tripId: trip.id,
          phaseId: currentPhase.id,
          sourceWalletId: effectiveSourceWalletId!,
          targetWalletId: effectiveTargetWalletId!,
          amountCents: toCents(evaluatedAmount),
          currency: trip.baseCurrency,
          description:
            description || (isWithdrawal ? t('fab.register_withdrawal') : t('fab.register_transfer')),
        };
        await (isWithdrawal ? withdrawCash(input) : transferBetweenWallets(input));
        await finishAndGoHome();
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!effectivePoolId) return;

    // M5: confirm an amount far above the category typical (never blocks — DEC-053).
    if (isAmountAnomaly) {
      setShowAnomalyConfirm(true);
      return;
    }
    // DEC-053(a): zero/negative budget never blocks — it asks for confirmation.
    if (selectedPoolFreeToSpendCents !== null && selectedPoolFreeToSpendCents <= 0) {
      setShowZeroBudgetConfirm(true);
      return;
    }

    await commitExpense();
  };

  // M5: after confirming the anomaly, still honor the zero-budget confirmation.
  const confirmAfterAnomaly = async () => {
    setShowAnomalyConfirm(false);
    if (selectedPoolFreeToSpendCents !== null && selectedPoolFreeToSpendCents <= 0) {
      setShowZeroBudgetConfirm(true);
      return;
    }
    await commitExpense();
  };

  // M4: register the return trip (identical expense, fresh id) then leave.
  const handleRoundTripYes = async () => {
    setShowRoundTrip(false);
    setSaving(true);
    try {
      await persistExpense();
      await finishAndGoHome();
    } finally {
      setSaving(false);
    }
  };

  const handleRoundTripNo = async () => {
    setShowRoundTrip(false);
    await finishAndGoHome();
  };

  // DEC-109: failed DB read shows recovery instead of silently rendering nothing.
  if (error) return <DataErrorScreen onRetry={retry} />;

  if (!trip || !settings?.onboardingCompleted) return null;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 px-5">
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">
          {isTransfer ? t('fab.register_transfer') : isWithdrawal ? t('fab.register_withdrawal') : t('expenses.add')}
        </h1>
        <div className="w-8" />
      </div>

      {/* M3: 1-tap repeat of the most frequent expenses (derived, not stored). */}
      {frequentExpenses.length > 0 && (
        <div>
          <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.repeat_label')}</label>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {frequentExpenses.map((fav, index) => (
              <button
                key={index}
                onClick={() => applySuggestion(fav)}
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container btn-press"
              >
                <Icon name={getCategoryIcon(fav.category)} size={16} className="text-on-surface-dim" />
                <span className="text-xs text-left">
                  <span className="block font-medium text-on-surface truncate max-w-[120px]">{fav.description}</span>
                  <span className="block text-on-surface-faint tabular">
                    {formatMoney(fav.amountCents, trip.baseCurrency)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.amount')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{trip.baseCurrency}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
            autoFocus
          />
        </div>
        {anchorHint && (
          <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">{anchorHint}</p>
        )}
      </div>

      {!isTransferLike && (
      <div>
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.category')}</label>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                category === key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
              }`}
            >
              <Icon name={getCategoryIcon(key)} size={20} className={category === key ? 'text-primary' : 'text-on-surface-dim'} />
              {/* R-03: long labels (e.g. "Entretenimento") wrap with hyphenation
                  instead of overflowing the chip — works for any label ×3 languages. */}
              <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                {t(`categories.${key}` as never)}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.description')}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isWithdrawal
              ? t('fab.register_withdrawal')
              : isTransfer
                ? t('fab.register_transfer')
                : t(`categories.${category}` as never)
          }
          className="bg-transparent text-sm text-on-surface outline-none w-full"
        />
        {/* M2: memory by description — 1 tap fills category + value from last use. */}
        {descriptionSuggestion && (
          <button
            onClick={() => applySuggestion(descriptionSuggestion)}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 ring-1 ring-primary/30 btn-press w-full text-left"
          >
            <Icon name="auto_awesome" size={16} className="text-primary shrink-0" />
            <span className="text-xs text-on-surface flex-1">
              {t('expenses.suggestion_hint', {
                category: t(`categories.${descriptionSuggestion.category}` as never),
                amount: formatMoney(descriptionSuggestion.amountCents, trip.baseCurrency),
              })}
            </span>
          </button>
        )}
      </div>

      {!isTransferLike && (
      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date_time')}</label>
        <input
          type="datetime-local"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          className="bg-transparent text-sm text-on-surface outline-none w-full"
        />
        <p className="text-[10px] text-on-surface-faint mt-1">{t('expenses.date_time_hint')}</p>
      </div>
      )}

      {!isTransferLike && (
      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
        {selectablePools.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-on-surface-dim">{t('expenses.no_pool_for_phase')}</p>
            <button
              onClick={() => navigate('/funds')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-press"
              style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            >
              {t('funds.add')}
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {availablePools.operational.map((pool) => (
              <button
                key={pool.id}
                onClick={() => setPoolId(pool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                  effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {pool.name}
              </button>
            ))}
            {availablePools.global.map((pool) => (
              <button
                key={pool.id}
                onClick={() => setPoolId(pool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                  effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                <Icon
                  name="public"
                  size={12}
                  className={effectivePoolId === pool.id ? 'text-on-surface' : 'text-on-surface-faint'}
                />
                {pool.name}
              </button>
            ))}
          </div>
        )}
        {selectablePools.length > 0 && !effectivePoolId && (
          <p className="text-[10px] text-on-surface-faint mt-2">{t('expenses.choose_pool_hint')}</p>
        )}
      </div>
      )}

      {!isTransferLike && (
      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.wallet')}</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setWalletId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              effectiveWalletId === null ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('expenses.wallet_not_set')}
          </button>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => setWalletId(wallet.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                effectiveWalletId === wallet.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {wallet.name}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── WHO PAID? (DEC-123 / D-R4-J) — first-level question + split ── */}
      {canSplit && (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.who_paid')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPayer(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    effectivePaidById === p.id
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                </button>
              ))}
            </div>
          </div>

          {otherPaid && (
            <div>
              <label className="text-xs text-on-surface-faint mb-2 block">
                {t('expenses.other_paid_question')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOtherPaidSplit(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                    !otherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t('expenses.other_paid_full')}
                </button>
                <button
                  onClick={() => setOtherPaidSplit(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                    otherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t('expenses.other_paid_split')}
                </button>
              </div>
              {/* DEC-114: never a gift — the cost stays mine, as a debt. */}
              {!otherPaidSplit && amountCentsPreview > 0 && (
                <p className="text-xs font-semibold text-warning mt-2">
                  {t('expenses.debt_full_hint', {
                    amount: formatMoney(amountCentsPreview, trip.baseCurrency),
                    name: payerName,
                  })}
                </p>
              )}
            </div>
          )}

          {!otherPaid && (
            <button
              onClick={toggleShared}
              className="w-full flex items-center justify-between btn-press"
            >
              <span className="text-sm text-on-surface font-medium flex items-center gap-2">
                <Icon name="group" size={18} className="text-on-surface-dim" />
                {t('expenses.shared_toggle')}
              </span>
              <span
                className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: isShared ? 'var(--primary)' : 'var(--surface-high)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-all"
                  style={{ left: isShared ? '18px' : '2px' }}
                />
              </span>
            </button>
          )}

          {wantsSplit && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('expenses.participants_label')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {participants.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => toggleParticipant(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                        selectedParticipantIds.includes(p.id)
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {p.nickname ?? p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('expenses.split_mode')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSplitMode('equal')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      splitMode === 'equal' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.split_equal')}
                  </button>
                  <button
                    onClick={() => setSplitMode('custom')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      splitMode === 'custom' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.split_custom')}
                  </button>
                </div>
              </div>

              {splitMode === 'custom' && (
                <div className="flex flex-col gap-2">
                  {participants
                    .filter((p) => selectedParticipantIds.includes(p.id))
                    .map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-dim flex-1 truncate">
                          {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                        </span>
                        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                          <span className="text-on-surface-faint text-xs">{trip.baseCurrency}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={customAmounts[p.id] ?? ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="0,00"
                            className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                          />
                        </div>
                      </div>
                    ))}
                  {customRemainingCents !== 0 && amountCentsPreview > 0 && (
                    <p className="text-xs text-warning">
                      {t('expenses.split_remaining', {
                        amount: formatMoney(customRemainingCents, trip.baseCurrency),
                      })}{' '}
                      {t('expenses.split_remainder_to_payer')}
                    </p>
                  )}
                </div>
              )}

              {previewShareCents !== null &&
                amountCentsPreview > 0 &&
                (otherPaid ? (
                  // DEC-114: my share stays my cost AND becomes a debt to the payer.
                  <p className="text-xs font-semibold text-warning">
                    {t('expenses.debt_share_hint', {
                      amount: formatMoney(previewShareCents, trip.baseCurrency),
                      name: payerName,
                    })}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-success">
                    {t('expenses.your_share', {
                      amount: formatMoney(previewShareCents, trip.baseCurrency),
                    })}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {!isTransferLike && participants.length <= 1 && (
        <p className="text-xs text-on-surface-faint px-1">
          {t('expenses.no_participants_hint')}
        </p>
      )}

      {isTransferLike && (
        <>
          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.source_wallet')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => setWalletId(wallet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    effectiveSourceWalletId === wallet.id
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {wallet.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.target_wallet')}
            </label>
            {targetCandidates.length === 0 ? (
              <p className="text-xs text-warning">{t('expenses.no_target_wallet')}</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {targetCandidates.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setTargetWalletId(wallet.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      effectiveTargetWalletId === wallet.id
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-on-surface-faint mt-2">
              {t('expenses.transfer_no_budget_hint')}
            </p>
          </div>
        </>
      )}

      {amountCentsPreview > 0 && (
        <div className="bg-surface-high rounded-xl p-3 text-center">
          <p className="text-xs text-on-surface-faint">{t('expenses.amount')}</p>
          <p className="text-lg font-bold tabular text-on-surface">
            {formatMoney(amountCentsPreview, trip.baseCurrency)}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={
            amountCentsPreview <= 0 ||
            saving ||
            !canSaveTransferLike ||
            (!isTransferLike && !effectivePoolId)
          }
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      <BottomSheet
        open={showZeroBudgetConfirm}
        onClose={() => setShowZeroBudgetConfirm(false)}
        title={t('expenses.zero_budget_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">
            {t('expenses.zero_budget_body', {
              amount: formatMoney(selectedPoolFreeToSpendCents ?? 0, trip.baseCurrency),
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowZeroBudgetConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={commitExpense}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.zero_budget_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* M5: anomaly confirmation — catches typos, never blocks (DEC-053). */}
      <BottomSheet
        open={showAnomalyConfirm}
        onClose={() => setShowAnomalyConfirm(false)}
        title={t('expenses.anomaly_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">
            {t('expenses.anomaly_body', {
              amount: formatMoney(amountCentsPreview, trip.baseCurrency),
              category: t(`categories.${category}` as never),
              typical: formatMoney(categoryTypicalCents, trip.baseCurrency),
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnomalyConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmAfterAnomaly}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.anomaly_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* M4: transport round trip — duplicates the expense for the return leg. */}
      <BottomSheet
        open={showRoundTrip}
        onClose={handleRoundTripNo}
        title={t('expenses.round_trip_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">{t('expenses.round_trip_body')}</p>
          <div className="flex gap-2">
            <button
              onClick={handleRoundTripNo}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.round_trip_no')}
            </button>
            <button
              onClick={handleRoundTripYes}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.round_trip_yes')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
