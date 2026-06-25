import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useWalletTracking } from '@/hooks/useWalletTracking';
import { resolveActivePhase, toSafeIsoDate } from '@/domain/dates';
import { toCents, formatMoney } from '@/domain/money';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { createIncomeTransaction } from '@/domain/transactions';
import { registerIncome } from '@/domain/orchestrators';
import { requestPersistentStorage } from '@/utils/pwa';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';

/**
 * B8 (DEC-212): register REAL income received mid-trip — a reimbursement, a
 * paycheck, a top-up. It GROWS the chosen pool and CREDITS the chosen wallet
 * (the realization of F17's planned income, which was projection-only). Kept as
 * a dedicated, focused page so the critical expense flow (QuickAddPage) is never
 * touched. Currency is the trip base for V1 (foreign-currency income deferred).
 */
export function IncomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, wallets, settings, error, retry, reload } = useAppData();
  // GATE 5 (D10): only ask which wallet received the money when tracking is on.
  const walletTrackingActive = useWalletTracking();

  const activePhase = useMemo(() => resolveActivePhase(phases), [phases]);

  const availablePools = useMemo(
    () =>
      activePhase
        ? getAvailablePoolsForPhase(pools, links, activePhase.id)
        : { operational: [], global: [], otherPhases: [], autoSelectedPoolId: null },
    [pools, links, activePhase],
  );
  const primaryPools = [...availablePools.operational, ...availablePools.global];
  // E02 (DEC-322): off-phase funds are selectable too (secondary group), so income
  // can be registered into a fund that belongs to another leg of the trip.
  const selectablePools = [...primaryPools, ...availablePools.otherPhases];

  const [amount, setAmount] = useState('');
  const [poolId, setPoolId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Default to a primary (active-phase/global) pool — an off-phase fund is never
  // auto-selected, only chosen on purpose (DEC-322).
  const effectivePoolId = poolId ?? availablePools.autoSelectedPoolId ?? primaryPools[0]?.id ?? null;
  const activeWallets = wallets.filter((w) => w.deletedAt === null);

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const amountCents = Number.isFinite(parsedAmount) && parsedAmount > 0 ? toCents(parsedAmount) : 0;
  const canSave = amountCents > 0 && effectivePoolId !== null && activePhase !== null && !saving;

  if (error) return <DataErrorScreen onRetry={retry} />;
  if (!trip || !settings?.onboardingCompleted) return null;

  const handleSave = async () => {
    if (!trip || !activePhase || !effectivePoolId || amountCents <= 0 || saving) return;
    setSaving(true);
    try {
      const transaction = createIncomeTransaction({
        tripId: trip.id,
        phaseId: activePhase.id,
        budgetPoolId: effectivePoolId,
        walletId,
        amountCents,
        currency: trip.baseCurrency,
        description: description.trim() || t('income.default_description'),
        date: customDate ? toSafeIsoDate(customDate) : undefined,
      });
      await registerIncome(transaction);
      requestPersistentStorage();
      showToast(
        t('income.saved_toast', { amount: formatMoney(amountCents, trip.baseCurrency) }),
        'success',
      );
      await reload();
      navigate('/dashboard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5">
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('income.title')}</h1>
        <div className="w-8" />
      </div>

      <p className="text-xs text-on-surface-dim px-1">{t('income.intro')}</p>

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('income.amount')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{trip.baseCurrency}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            aria-label={t('income.amount')}
            className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
            autoFocus
          />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('income.description')}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('income.default_description')}
          className="bg-transparent text-sm text-on-surface outline-none w-full"
        />
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-2 block">{t('income.grows_fund')}</label>
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
            {primaryPools.map((pool) => (
              <button
                key={pool.id}
                onClick={() => setPoolId(pool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                  effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {pool.scope === 'global' && (
                  <Icon
                    name="public"
                    size={12}
                    className={effectivePoolId === pool.id ? 'text-on-surface' : 'text-on-surface-faint'}
                  />
                )}
                {pool.name}
              </button>
            ))}
            {/* E02 (DEC-322): funds from another phase — selectable, just out of
                the active-phase focus. */}
            {availablePools.otherPhases.length > 0 && (
              <div className="w-full mt-1">
                <p className="text-[10px] text-on-surface-faint mb-1.5">
                  {t('expenses.fund_other_phases')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {availablePools.otherPhases.map((pool) => (
                    <button
                      key={pool.id}
                      onClick={() => setPoolId(pool.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                        effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      <Icon
                        name="schedule"
                        size={12}
                        className={effectivePoolId === pool.id ? 'text-on-surface' : 'text-on-surface-faint'}
                      />
                      {pool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {walletTrackingActive && (
      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-2 block">{t('income.credits_wallet')}</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setWalletId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              walletId === null ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('expenses.wallet_not_set')}
          </button>
          {activeWallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => setWalletId(wallet.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                walletId === wallet.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {wallet.name}
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date_time')}</label>
        <input
          type="datetime-local"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          aria-label={t('expenses.date_time')}
          className="bg-transparent text-sm text-on-surface outline-none w-full"
        />
      </div>

      {!activePhase && <p className="text-xs text-warning px-1">{t('income.no_phase')}</p>}

      <div className="flex gap-2 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
