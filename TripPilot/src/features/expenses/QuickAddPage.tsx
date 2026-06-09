import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createExpenseTransaction } from '@/domain/transactions';
import { findActivePhase } from '@/domain/dates';
import { toCents, formatMoney } from '@/domain/money';
import { transactionRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';

const CATEGORIES = [
  { key: 'bar', icon: 'local_bar' },
  { key: 'restaurant', icon: 'restaurant' },
  { key: 'market', icon: 'shopping_cart' },
  { key: 'transport', icon: 'directions_bus' },
  { key: 'outing', icon: 'hiking' },
  { key: 'entertainment', icon: 'movie' },
  { key: 'health', icon: 'healing' },
  { key: 'accommodation', icon: 'hotel' },
  { key: 'other', icon: 'more_horiz' },
];

export function QuickAddPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, wallets, settings, reload } = useAppData();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [poolId, setPoolId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const activePhase = findActivePhase(phases);
  const defaultWallet = wallets.find((w) => w.isDefault);

  const effectiveWalletId = walletId ?? defaultWallet?.id ?? null;
  const effectivePoolId = poolId || pools[0]?.id || '';

  const handleSave = async () => {
    if (!trip || !activePhase || !effectivePoolId || !amount) return;

    setSaving(true);
    try {
      const amountCents = toCents(parseFloat(amount));
      const tx = createExpenseTransaction({
        tripId: trip.id,
        phaseId: activePhase.id,
        budgetPoolId: effectivePoolId,
        walletId: effectiveWalletId,
        amountCents,
        currency: trip.baseCurrency,
        category,
        description: description || t(`categories.${category}` as never),
      });
      await transactionRepository.create(tx);
      await reload();
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  if (!trip || !settings?.onboardingCompleted) return null;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('expenses.add')}</h1>
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

      <div>
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.category')}</label>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                category === cat.key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
              }`}
            >
              <Icon name={cat.icon} size={20} className={category === cat.key ? 'text-primary' : 'text-on-surface-dim'} />
              <span className="text-[10px] text-on-surface-faint">{t(`categories.${cat.key}` as never)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.description')}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(`categories.${category}` as never)}
          className="bg-transparent text-sm text-on-surface outline-none w-full"
        />
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
        <div className="flex gap-2 flex-wrap">
          {pools.map((pool) => (
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
        </div>
      </div>

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
          disabled={!amount || parseFloat(amount) <= 0 || saving}
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
