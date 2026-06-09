import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer, calculatePersonalCost } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import { findActivePhase } from '@/domain/dates';
import { toCents, formatMoney } from '@/domain/money';
import { getAvailablePoolsForPhase, calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { registerExpense, transferBetweenWallets, withdrawCash } from '@/domain/orchestrators';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
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
  const { trip, phases, pools, links, envelopes, transactions, wallets, participants, settings, reload } =
    useAppData();

  const initialCategory = searchParams.get('cat') ?? 'other';
  const txType = searchParams.get('type') ?? 'expense';
  const isTransfer = txType === 'transfer';
  const isWithdrawal = txType === 'withdrawal';
  const isTransferLike = isTransfer || isWithdrawal;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null);
  const [poolId, setPoolId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [isShared, setIsShared] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [paidById, setPaidById] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<ShareType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showZeroBudgetConfirm, setShowZeroBudgetConfirm] = useState(false);

  const activePhase = findActivePhase(phases);
  const currentPhase = activePhase ?? phases[0] ?? null;
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
        ).freeToSpendCents
      : null;

  const owner = participants.find((p) => p.isOwner) ?? null;
  const effectivePaidById = paidById ?? owner?.id ?? null;
  const canSplit = !isTransferLike && participants.length > 1;

  const toggleShared = () => {
    setIsShared((prev) => {
      const next = !prev;
      if (next && selectedParticipantIds.length === 0) {
        setSelectedParticipantIds(participants.map((p) => p.id));
      }
      return next;
    });
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  const amountCentsPreview = amount ? toCents(parseFloat(amount) || 0) : 0;
  const customSumCents = selectedParticipantIds.reduce((sum, pid) => {
    const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
    return sum + (Number.isNaN(value) ? 0 : Math.round(value * 100));
  }, 0);
  const customRemainingCents = amountCentsPreview - customSumCents;

  const previewShareCents =
    isShared && selectedParticipantIds.length > 0 && owner && selectedParticipantIds.includes(owner.id)
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

  const handleSave = async () => {
    if (!trip || !currentPhase || !amount) return;
    if (!isTransferLike && !effectivePoolId) return;
    if (!canSaveTransferLike) return;

    // DEC-053(a): zero/negative budget never blocks — it asks for confirmation.
    if (
      !isTransferLike &&
      !showZeroBudgetConfirm &&
      selectedPoolFreeToSpendCents !== null &&
      selectedPoolFreeToSpendCents <= 0
    ) {
      setShowZeroBudgetConfirm(true);
      return;
    }
    setShowZeroBudgetConfirm(false);

    setSaving(true);
    try {
      const amountCents = toCents(parseFloat(amount));

      // Transfers and withdrawals move money between wallets and never touch
      // the budget (budgetPoolId/personalCostCents = null — Core Rule 3).
      if (isTransferLike) {
        const input = {
          tripId: trip.id,
          phaseId: currentPhase.id,
          sourceWalletId: effectiveSourceWalletId!,
          targetWalletId: effectiveTargetWalletId!,
          amountCents,
          currency: trip.baseCurrency,
          description:
            description || (isWithdrawal ? t('fab.register_withdrawal') : t('fab.register_transfer')),
        };
        await (isWithdrawal ? withdrawCash(input) : transferBetweenWallets(input));
        await reload();
        navigate('/dashboard');
        return;
      }

      const splitActive =
        canSplit && isShared && selectedParticipantIds.length >= 2 && effectivePaidById !== null;
      const ownerPaid = !splitActive || effectivePaidById === owner?.id;

      const tx = createExpenseTransaction({
        tripId: trip.id,
        phaseId: currentPhase.id,
        budgetPoolId: effectivePoolId,
        // When someone else paid, no money left the user's wallets.
        walletId: ownerPaid ? effectiveWalletId : null,
        amountCents,
        currency: trip.baseCurrency,
        category,
        description: description || t(`categories.${category}` as never),
        isShared: splitActive,
        paidByParticipantId: splitActive ? effectivePaidById : undefined,
      });

      let finalShares: ParticipantShare[] = [];
      if (splitActive) {
        const customAmountsCents = Object.fromEntries(
          selectedParticipantIds.map((pid) => {
            const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
            return [pid, Number.isNaN(value) ? 0 : Math.round(value * 100)];
          }),
        );
        finalShares = buildSharesWithPayer({
          transactionId: tx.id,
          amountCents,
          participantIds: selectedParticipantIds,
          paidByParticipantId: effectivePaidById!,
          shareType: splitMode,
          customAmountsCents,
        });
        tx.personalCostCents = owner ? calculatePersonalCost(finalShares, owner.id) : null;
      }

      await registerExpense({ transaction: tx, shares: finalShares });

      await reload();
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  if (!trip || !settings?.onboardingCompleted) return null;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 px-5">
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">
          {isTransfer ? t('fab.register_transfer') : isWithdrawal ? t('fab.register_withdrawal') : t('expenses.add')}
        </h1>
        <div className="w-8" />
      </div>

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.amount')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{trip.baseCurrency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
            autoFocus
          />
        </div>
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
              <span className="text-[10px] text-on-surface-faint">{t(`categories.${key}` as never)}</span>
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
      </div>

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

      {/* ── SHARED EXPENSE (split) ── */}
      {canSplit && (
        <div className="bg-surface-container rounded-xl p-4">
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

          {isShared && (
            <div className="mt-4 flex flex-col gap-3">
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
                  {t('expenses.who_paid')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {participants.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPaidById(p.id)}
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

              {previewShareCents !== null && amountCentsPreview > 0 && (
                <p className="text-xs font-semibold text-success">
                  {t('expenses.your_share', {
                    amount: formatMoney(previewShareCents, trip.baseCurrency),
                  })}
                </p>
              )}
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

      {amount && parseFloat(amount) > 0 && (
        <div className="bg-surface-high rounded-xl p-3 text-center">
          <p className="text-xs text-on-surface-faint">{t('expenses.amount')}</p>
          <p className="text-lg font-bold tabular text-on-surface">
            {formatMoney(toCents(parseFloat(amount)), trip.baseCurrency)}
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
            !amount ||
            parseFloat(amount) <= 0 ||
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
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.zero_budget_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
