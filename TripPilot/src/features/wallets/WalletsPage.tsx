import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { calculateWalletBalance, calculateCashReconciliation } from '@/domain/wallets';
import { formatMoney, toCents } from '@/domain/money';
import { walletRepository } from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Wallet } from '@/domain/types/wallet';
import type { WalletType } from '@/domain/types/common';
import { Icon } from '@/components/Icon';

export function WalletsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, wallets, transactions, loading, reload } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WalletType>('cash');
  const [newBalance, setNewBalance] = useState('');
  const [reconcileWallet, setReconcileWallet] = useState<Wallet | null>(null);
  const [countedBalance, setCountedBalance] = useState('');

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

  const handleReconcile = async () => {
    if (!reconcileWallet || !countedBalance) return;
    const balance = calculateWalletBalance(reconcileWallet, transactions);
    const counted = toCents(parseFloat(countedBalance.replace(',', '.')));
    const result = calculateCashReconciliation(balance.currentBalanceCents, counted);
    if (result.needsAdjustment) {
      alert(t('wallets.difference', { amount: formatMoney(result.differenceCents, reconcileWallet.currency) }));
    } else {
      alert(t('wallets.reconcile_match'));
    }
    setReconcileWallet(null);
    setCountedBalance('');
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
          <button onClick={() => navigate(-1)} className="btn-press p-1">
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
          <div className="flex gap-2">
            {(['cash', 'digital', 'debit_card'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setNewType(type)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  newType === type ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {type}
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
                  <p className="text-xs text-on-surface-faint mt-0.5">{wallet.walletType} · {wallet.currency}</p>
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
                  onClick={() => setReconcileWallet(wallet)}
                  className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
                >
                  {t('wallets.reconcile')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {reconcileWallet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setReconcileWallet(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-[430px] bg-surface-container rounded-t-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-on-surface mb-3">{t('wallets.reconcile')}: {reconcileWallet.name}</p>
            <p className="text-xs text-on-surface-dim mb-2">
              {t('wallets.expected_balance')}: {formatMoney(
                calculateWalletBalance(reconcileWallet, transactions).currentBalanceCents,
                reconcileWallet.currency,
              )}
            </p>
            <input
              type="number"
              value={countedBalance}
              onChange={(e) => setCountedBalance(e.target.value)}
              placeholder={t('wallets.counted_balance')}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mb-3"
            />
            <button
              onClick={handleReconcile}
              className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
