import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { calculateWalletBalance, calculateCashReconciliation } from '@/domain/wallets';
import { resolveActivePhase } from '@/domain/dates';
import { formatMoney, toCents } from '@/domain/money';
import { reconcileWallet } from '@/domain/orchestrators';
import { walletRepository } from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import { getCategoryIcon } from '@/utils/category-icons';
import type { Wallet } from '@/domain/types/wallet';
import type { WalletType, TransactionCategory } from '@/domain/types/common';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';

const ADJUSTMENT_CATEGORIES = ['bar', 'restaurant', 'market', 'transport', 'entertainment', 'other'] as const;

// PAR-005 (R6-18): full wallet type list for creation, labels via i18n.
const WALLET_TYPES: WalletType[] = ['cash', 'digital', 'debit_card', 'credit_card', 'other'];

export function WalletsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, wallets, transactions, loading, reload } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WalletType>('cash');
  const [newBalance, setNewBalance] = useState('');
  const [reconcilingWallet, setReconcilingWallet] = useState<Wallet | null>(null);
  const [countedBalance, setCountedBalance] = useState('');
  const [adjustmentCategory, setAdjustmentCategory] = useState<TransactionCategory>('other');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const handleSetDefault = async (wallet: Wallet) => {
    if (!trip) return;
    await walletRepository.clearDefaults(trip.id);
    await walletRepository.update({ ...wallet, isDefault: true });
    await reload();
  };

  const handleAddWallet = async () => {
    if (!trip || !newName.trim()) return;
    const wallet: Wallet = {
      ...createSyncMetadata(),
      tripId: trip.id,
      name: newName.trim(),
      walletType: newType,
      currency: trip.baseCurrency,
      initialBalanceCents: newBalance ? toCents(parseFloat(newBalance)) : 0,
      isDefault: wallets.length === 0,
      notes: null,
    };
    await walletRepository.create(wallet);
    setNewName('');
    setNewBalance('');
    setShowAdd(false);
    await reload();
  };

  const expectedCents = reconcilingWallet
    ? calculateWalletBalance(reconcilingWallet, transactions).currentBalanceCents
    : 0;
  const countedCents = countedBalance ? toCents(parseFloat(countedBalance.replace(',', '.'))) : null;
  const reconcileResult =
    countedCents !== null ? calculateCashReconciliation(expectedCents, countedCents) : null;
  const isMissingCash = reconcileResult !== null && reconcileResult.differenceCents < 0;

  const closeReconcileSheet = () => {
    setReconcilingWallet(null);
    setCountedBalance('');
    setAdjustmentCategory('other');
    setAdjustmentReason('');
  };

  const handleReconcile = async () => {
    if (!trip || !reconcilingWallet || countedCents === null || !reconcileResult) return;

    if (!reconcileResult.needsAdjustment) {
      showToast(t('wallets.reconcile_match'), 'success');
      closeReconcileSheet();
      return;
    }

    // BUG-002 (R6-02): resolveActivePhase instead of the phases[0] fallback.
    const activePhase = resolveActivePhase(phases);
    const operationalPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0];
    if (!activePhase || !operationalPool) return;

    await reconcileWallet({
      tripId: trip.id,
      phaseId: activePhase.id,
      budgetPoolId: operationalPool.id,
      walletId: reconcilingWallet.id,
      expectedBalanceCents: expectedCents,
      countedBalanceCents: countedCents,
      currency: reconcilingWallet.currency,
      reason: adjustmentReason.trim() || t('wallets.adjustment_default_reason'),
      category: isMissingCash ? adjustmentCategory : 'reconciliation',
    });
    showToast(t('wallets.adjustment_created'), 'success');
    closeReconcileSheet();
    await reload();
  };

  if (loading) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  if (!trip) {
    navigate('/welcome');
    return null;
  }

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">{t('wallets.title')}</h1>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
        >
          {t('wallets.add')}
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('wallets.add')}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          />
          <div className="flex gap-2 flex-wrap">
            {WALLET_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setNewType(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium btn-press ${
                  newType === type ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t(`wallets.type_${type}` as never)}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            placeholder={t('wallets.balance')}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          />
          <button
            onClick={handleAddWallet}
            className="py-2.5 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press"
          >
            {t('common.save')}
          </button>
        </div>
      )}

      {wallets.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="account_balance_wallet" size={32} className="text-on-surface-mute mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('wallets.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {wallets.map((wallet) => {
          const balance = calculateWalletBalance(wallet, transactions);
          return (
            <div key={wallet.id} className="bg-surface-container rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-on-surface">{wallet.name}</p>
                    {wallet.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                        {t('wallets.default')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {t(`wallets.type_${wallet.walletType}` as never)} · {wallet.currency}
                  </p>
                </div>
                <p className="text-lg font-extrabold tabular text-on-surface">
                  {formatMoney(balance.currentBalanceCents, wallet.currency)}
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                {!wallet.isDefault && (
                  <button
                    onClick={() => handleSetDefault(wallet)}
                    className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                  >
                    {t('wallets.set_default')}
                  </button>
                )}
                <button
                  onClick={() => setReconcilingWallet(wallet)}
                  className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                >
                  {t('wallets.reconcile')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <BottomSheet
        open={reconcilingWallet !== null}
        onClose={closeReconcileSheet}
        title={reconcilingWallet ? `${t('wallets.reconcile')}: ${reconcilingWallet.name}` : undefined}
      >
        {reconcilingWallet && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">
              {t('wallets.expected_balance')}:{' '}
              <span className="font-bold tabular text-on-surface">
                {formatMoney(expectedCents, reconcilingWallet.currency)}
              </span>
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={countedBalance}
              onChange={(e) => setCountedBalance(e.target.value)}
              placeholder={t('wallets.counted_balance')}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              autoFocus
            />

            {reconcileResult && reconcileResult.needsAdjustment && (
              <>
                <p className={`text-xs font-semibold ${isMissingCash ? 'text-error' : 'text-success'}`}>
                  {t(isMissingCash ? 'wallets.diff_missing' : 'wallets.diff_surplus', {
                    amount: formatMoney(Math.abs(reconcileResult.differenceCents), reconcilingWallet.currency),
                  })}
                </p>

                {isMissingCash ? (
                  <div>
                    <label className="text-xs text-on-surface-faint mb-2 block">
                      {t('wallets.adjustment_category')}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {ADJUSTMENT_CATEGORIES.map((key) => (
                        <button
                          key={key}
                          onClick={() => setAdjustmentCategory(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                            adjustmentCategory === key
                              ? 'bg-primary text-on-surface'
                              : 'bg-surface-high text-on-surface-dim'
                          }`}
                        >
                          <Icon name={getCategoryIcon(key)} size={14} />
                          {t(`categories.${key}` as never)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-on-surface-faint mb-1 block">
                      {t('wallets.adjustment_reason')}
                    </label>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder={t('wallets.adjustment_default_reason')}
                      className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
                    />
                  </div>
                )}
              </>
            )}

            {reconcileResult && !reconcileResult.needsAdjustment && (
              <p className="text-xs font-semibold text-success">{t('wallets.reconcile_match')}</p>
            )}

            <button
              onClick={handleReconcile}
              disabled={countedCents === null}
              className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
            >
              {reconcileResult?.needsAdjustment ? t('wallets.create_adjustment') : t('common.confirm')}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
