import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createPoolSummary, createBudgetPool, createBudgetPoolPhaseLink } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { formatMoney } from '@/domain/money';
import { sortPhasesByOrder } from '@/domain/dates';
import { budgetPoolRepository, budgetPoolPhaseLinkRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';
import type { BudgetPoolScope } from '@/domain/types/common';

export function FundsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, transactions, loading, reload } = useAppData();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<BudgetPoolScope>('linked_phases');
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (loading || !trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  const sortedPhases = sortPhasesByOrder(phases);
  const phaseNameById = new Map(phases.map((p) => [p.id, p.name]));

  const togglePhase = (phaseId: string) => {
    setSelectedPhaseIds((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId],
    );
  };

  const resetForm = () => {
    setShowForm(false);
    setName('');
    setAmount('');
    setScope('linked_phases');
    setSelectedPhaseIds([]);
  };

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValid =
    name.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (scope === 'global' || selectedPhaseIds.length > 0);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const pool = createBudgetPool({
        tripId: trip.id,
        name: name.trim(),
        scope,
        totalAmountCents: Math.round(parsedAmount * 100),
        currency: trip.baseCurrency,
      });
      await budgetPoolRepository.create(pool);
      if (scope === 'linked_phases') {
        await Promise.all(
          selectedPhaseIds.map((phaseId) =>
            budgetPoolPhaseLinkRepository.create(createBudgetPoolPhaseLink(pool.id, phaseId)),
          ),
        );
      }
      await reload();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('funds.title')}</h1>
      </div>

      {pools.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="account_balance_wallet" size={32} className="text-on-surface-mute mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('funds.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {pools.map((pool) => {
          const summary = createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id));
          const linkedNames = links
            .filter((l) => l.budgetPoolId === pool.id && l.deletedAt === null)
            .map((l) => phaseNameById.get(l.phaseId))
            .filter((n): n is string => !!n);

          return (
            <div key={pool.id} className="bg-surface-container rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-on-surface">{pool.name}</p>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {pool.scope === 'global'
                      ? t('funds.scope_global')
                      : linkedNames.length > 0
                        ? `${t('funds.linked_phases')}: ${linkedNames.join(', ')}`
                        : t('funds.no_linked_phases')}
                  </p>
                </div>
                <p className="text-sm font-extrabold tabular text-success">
                  {formatMoney(summary.remainingCents, pool.currency)}
                </p>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden mt-3"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, summary.percentUsed)}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
              <p className="text-xs text-on-surface-faint mt-1.5">
                {formatMoney(summary.spentCents, pool.currency)} / {formatMoney(summary.totalCents, pool.currency)}
              </p>
            </div>
          );
        })}
      </div>

      {showForm ? (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.amount')}</label>
            <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
              <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.scope')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('linked_phases')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  scope === 'linked_phases' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('funds.scope_linked')}
              </button>
              <button
                onClick={() => setScope('global')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  scope === 'global' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('funds.scope_global')}
              </button>
            </div>
          </div>
          {scope === 'linked_phases' && (
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.linked_phases')}</label>
              <div className="flex gap-2 flex-wrap">
                {sortedPhases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => togglePhase(phase.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      selectedPhaseIds.includes(phase.id)
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {phase.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
            >
              {saving ? t('common.loading') : t('common.add')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
          style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
        >
          <Icon name="add" size={18} className="text-primary" />
          {t('funds.add')}
        </button>
      )}
    </div>
  );
}
