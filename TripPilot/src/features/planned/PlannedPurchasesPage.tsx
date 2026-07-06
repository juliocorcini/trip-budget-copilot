import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { formatMoney } from '@/domain/money';
import { resolveActivePhase } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { resolveAutoWalletId } from '@/domain/wallets';
import {
  isPlannedPurchaseOpen,
  plannedPurchaseReservedRemainingCents,
  plannedPurchaseProgress,
} from '@/domain/planning/planned-purchases';
import {
  addPlannedPurchase,
  updatePlannedPurchase,
  setPlannedPurchaseStatus,
  deletePlannedPurchase,
  restorePlannedPurchase,
  logPlannedPurchaseExpense,
  undoLogPlannedPurchaseExpense,
  linkExistingExpenseToPlannedPurchase,
  undoLinkExistingExpense,
} from '@/domain/orchestrators';
import { getActiveIntlLocale } from '@/domain/locale';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { BreakdownRows } from '@/components/Breakdown';
import { HelpButton } from '@/components/HelpMode';
import { showToast } from '@/components/Toast';
import { getCategoryIcon } from '@/utils/category-icons';
import type { TransactionCategory } from '@/domain/types/common';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';

/** B9: short, locale-aware date for the existing-expense picker rows. */
function formatPickerDate(dateIso: string): string {
  const safe = dateIso.length <= 10 ? `${dateIso}T12:00:00` : dateIso;
  const d = new Date(safe);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(getActiveIntlLocale(), { day: '2-digit', month: 'short' });
}

// Shopping-leaning order (the common reason to plan a buy), but the full
// taxonomy stays reachable so "Comprei" always produces a valid expense
// category. Mirrors the local CATEGORY_KEYS convention used by the expense
// screens (kept local to avoid a refactor across those pages).
const CATEGORY_KEYS: TransactionCategory[] = [
  'clothing',
  'health',
  'gifts',
  'home_day',
  'entertainment',
  'restaurant',
  'transport',
  'accommodation',
  'market',
  'other',
];

function parseEurosToCents(value: string): number | null {
  const parsed = parseFloat(value.replace(',', '.'));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

interface PurchaseFormValues {
  name: string;
  category: TransactionCategory;
  estimated: string;
  reserve: boolean;
  store: string;
  targetDate: string;
  budgetPoolId: string;
  notes: string;
}

function emptyFormValues(pools: BudgetPool[]): PurchaseFormValues {
  return {
    name: '',
    category: 'clothing',
    estimated: '',
    reserve: true,
    store: '',
    targetDate: '',
    budgetPoolId: pools[0]?.id ?? '',
    notes: '',
  };
}

function valuesFromPurchase(p: PlannedPurchase): PurchaseFormValues {
  return {
    name: p.name,
    category: (p.category as TransactionCategory) ?? 'other',
    estimated: (p.estimatedCostCents / 100).toString(),
    reserve: p.reservedCents !== null,
    store: p.store ?? '',
    targetDate: p.targetDate ?? '',
    budgetPoolId: p.budgetPoolId,
    notes: p.notes ?? '',
  };
}

/** DEC-175: the create/edit form, shared by the add panel and the inline edit. */
function PurchaseForm({
  initial,
  pools,
  currency,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PurchaseFormValues;
  pools: BudgetPool[];
  currency: string;
  submitLabel: string;
  onSubmit: (values: PurchaseFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<PurchaseFormValues>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PurchaseFormValues>(key: K, value: PurchaseFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const cents = parseEurosToCents(values.estimated);
  const isValid = values.name.trim().length > 0 && cents !== null && cents > 0 && !!values.budgetPoolId;

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.name')}</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t('planned.name_placeholder')}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.estimated')}</label>
        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
          <span className="text-on-surface-dim text-sm">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={values.estimated}
            onChange={(e) => set('estimated', e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-faint mb-2 block">{t('planned.category')}</label>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set('category', key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                values.category === key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
              }`}
            >
              <Icon
                name={getCategoryIcon(key)}
                size={20}
                className={values.category === key ? 'text-primary' : 'text-on-surface-dim'}
              />
              <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                {t(`categories.${key}` as never)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Reserve toggle — the heart of the feature: ON deducts the estimate from
          "free to spend" now; OFF only tracks the intention. */}
      <button
        type="button"
        onClick={() => set('reserve', !values.reserve)}
        className="flex items-center gap-3 bg-surface-high rounded-lg px-3 py-2.5 btn-press text-left"
      >
        <div
          className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
            values.reserve ? 'bg-primary justify-end' : 'bg-surface-container justify-start'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-on-surface">{t('planned.reserve_toggle')}</p>
          <p className="text-[10px] text-on-surface-faint mt-0.5">{t('planned.reserve_hint')}</p>
        </div>
      </button>

      {pools.length > 1 && (
        <div>
          <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.fund')}</label>
          <div className="flex gap-2 flex-wrap">
            {pools.map((pool) => (
              <button
                key={pool.id}
                type="button"
                onClick={() => set('budgetPoolId', pool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                  values.budgetPoolId === pool.id
                    ? 'bg-primary text-on-surface'
                    : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {pool.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.store')}</label>
          <input
            type="text"
            value={values.store}
            onChange={(e) => set('store', e.target.value)}
            placeholder={t('planned.store_placeholder')}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          />
        </div>
        <div className="w-36">
          <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.target_date')}</label>
          <input
            type="date"
            value={values.targetDate}
            onChange={(e) => set('targetDate', e.target.value)}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.notes')}</label>
        <input
          type="text"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function PlannedPurchasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, wallets, transactions, plannedPurchases, loading, reload } = useAppData();

  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const [buyTarget, setBuyTarget] = useState<PlannedPurchase | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyClose, setBuyClose] = useState(true);
  // B9: link an already-recorded expense (bought before the plan existed).
  const [linkTarget, setLinkTarget] = useState<PlannedPurchase | null>(null);

  const currency = trip?.baseCurrency ?? 'EUR';
  const currentPhase = resolveActivePhase(phases);
  // Charging a planned buy needs a concrete pool: the operational pools linked
  // to the active phase plus any global pool. Falls back to all live pools when
  // no phase is active (e.g. between phases).
  const poolsForForm = useMemo(() => {
    if (!currentPhase) return pools.filter((p) => p.deletedAt === null);
    const available = getAvailablePoolsForPhase(pools, links, currentPhase.id);
    return [...available.operational, ...available.global];
  }, [pools, links, currentPhase]);

  const openPurchases = useMemo(
    () => plannedPurchases.filter(isPlannedPurchaseOpen),
    [plannedPurchases],
  );
  const donePurchases = useMemo(
    () => plannedPurchases.filter((p) => !isPlannedPurchaseOpen(p)),
    [plannedPurchases],
  );
  const totalReservedCents = useMemo(
    () =>
      openPurchases.reduce(
        (sum, p) => sum + plannedPurchaseReservedRemainingCents(p, transactions),
        0,
      ),
    [openPurchases, transactions],
  );

  // B9: every transaction already attributed to ANY planned purchase — so a
  // single expense is never double-earmarked across two plans.
  const alreadyLinkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of plannedPurchases) for (const id of p.linkedTransactionIds) ids.add(id);
    return ids;
  }, [plannedPurchases]);

  // B9: candidate expenses to link — real expenses charged to the same fund,
  // not deleted and not already linked. Newest first, capped for the picker.
  const linkCandidates = useMemo(() => {
    if (!linkTarget) return [];
    return transactions
      .filter(
        (tx) =>
          tx.deletedAt === null &&
          tx.type === 'expense' &&
          tx.budgetPoolId === linkTarget.budgetPoolId &&
          !alreadyLinkedIds.has(tx.id),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  }, [linkTarget, transactions, alreadyLinkedIds]);

  if (loading || !trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  const handleCreate = async (v: PurchaseFormValues) => {
    const cents = parseEurosToCents(v.estimated);
    if (cents === null || cents <= 0 || !v.name.trim() || !v.budgetPoolId) return;
    await addPlannedPurchase({
      tripId: trip.id,
      budgetPoolId: v.budgetPoolId,
      name: v.name.trim(),
      category: v.category,
      estimatedCostCents: cents,
      reservedCents: v.reserve ? cents : null,
      store: v.store.trim() || null,
      targetDate: v.targetDate || null,
      notes: v.notes.trim() || null,
    });
    await reload();
    setShowForm(false);
    showToast(t('planned.created'), 'success');
  };

  const handleSaveEdit = async (p: PlannedPurchase, v: PurchaseFormValues) => {
    const cents = parseEurosToCents(v.estimated);
    const estimatedCostCents = cents !== null && cents > 0 ? cents : p.estimatedCostCents;
    await updatePlannedPurchase({
      ...p,
      name: v.name.trim() || p.name,
      category: v.category,
      estimatedCostCents,
      reservedCents: v.reserve ? estimatedCostCents : null,
      store: v.store.trim() || null,
      targetDate: v.targetDate || null,
      budgetPoolId: v.budgetPoolId,
      notes: v.notes.trim() || null,
    });
    await reload();
    setExpandedId(null);
    showToast(t('planned.updated'), 'success');
  };

  const handleDelete = async (p: PlannedPurchase) => {
    await deletePlannedPurchase(p.id);
    await reload();
    setExpandedId(null);
    showToast(t('planned.deleted'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 6000,
      onTap: () => {
        void restorePlannedPurchase(p).then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  const handleCancel = async (p: PlannedPurchase) => {
    await setPlannedPurchaseStatus(p, 'cancelled');
    await reload();
    setExpandedId(null);
    showToast(t('planned.cancelled'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 6000,
      onTap: () => {
        void setPlannedPurchaseStatus(p, 'planned').then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  const handleReopen = async (p: PlannedPurchase) => {
    await setPlannedPurchaseStatus(p, 'planned');
    await reload();
    showToast(t('planned.updated'), 'success');
  };

  const openBuy = (p: PlannedPurchase) => {
    const remaining = plannedPurchaseReservedRemainingCents(p, transactions);
    const defaultCents = remaining > 0 ? remaining : p.estimatedCostCents;
    setBuyAmount((defaultCents / 100).toString());
    setBuyClose(true);
    setBuyTarget(p);
  };

  const handleConfirmBuy = async () => {
    if (!buyTarget) return;
    if (!currentPhase) {
      showToast(t('planned.no_phase'), 'danger');
      return;
    }
    const cents = parseEurosToCents(buyAmount);
    if (cents === null || cents <= 0) return;
    const result = await logPlannedPurchaseExpense({
      purchase: buyTarget,
      expense: {
        tripId: trip.id,
        phaseId: currentPhase.id,
        budgetPoolId: buyTarget.budgetPoolId,
        // DEC-473: a planned purchase is the owner's own money — auto policy.
        walletId: resolveAutoWalletId(wallets),
        amountCents: cents,
        currency: trip.baseCurrency,
        category: buyTarget.category,
        description: buyTarget.name,
        placeLabel: buyTarget.store,
      },
      close: buyClose,
    });
    setBuyTarget(null);
    setExpandedId(null);
    await reload();
    showToast(t('planned.bought_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 6000,
      onTap: () => {
        void undoLogPlannedPurchaseExpense({
          transactionId: result.transaction.id,
          previousPurchase: result.previousPurchase,
        }).then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  // B9: attribute an EXISTING expense to this purchase (no new transaction).
  const handleLinkExisting = async (tx: Transaction) => {
    if (!linkTarget) return;
    const result = await linkExistingExpenseToPlannedPurchase({
      purchase: linkTarget,
      transaction: tx,
    });
    setLinkTarget(null);
    setExpandedId(null);
    await reload();
    showToast(t('planned.linked_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 6000,
      onTap: () => {
        void undoLinkExistingExpense(result.previousPurchase).then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('planned.title')}</h1>
        <HelpButton screenId="planned" />
      </div>

      {plannedPurchases.length === 0 && !showForm && (
        <EmptyState
          icon="shopping_bag"
          title={t('planned.empty_title')}
          body={t('planned.empty_body')}
          cta={{ label: t('planned.empty_cta'), icon: 'add', onClick: () => setShowForm(true) }}
        />
      )}

      {/* Summary: what the planned buys are quietly taking out of "free to spend". */}
      {totalReservedCents > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'var(--highlight-subtle)' }}
        >
          <Icon name="savings" size={20} className="text-primary" />
          <p className="text-xs text-on-surface-dim leading-relaxed">
            {t('planned.summary_reserved', {
              amount: formatMoney(totalReservedCents, currency),
              count: openPurchases.filter((p) => p.reservedCents !== null).length,
            })}
          </p>
        </div>
      )}

      {/* Open purchases — the actionable bucket */}
      {openPurchases.length > 0 && (
        <div className="flex flex-col gap-2" data-help-anchor="planned-list">
          {openPurchases.map((p) => {
            const remaining = plannedPurchaseReservedRemainingCents(p, transactions);
            const progress = plannedPurchaseProgress(p, transactions);
            const expanded = expandedId === p.id;
            const meta = [t(`categories.${p.category}` as never) as string, p.store ?? undefined]
              .filter((s): s is string => !!s)
              .join(' · ');
            return (
              <div key={p.id} className="bg-surface-container rounded-xl p-4">
                <button
                  onClick={() => setExpandedId((prev) => (prev === p.id ? null : p.id))}
                  className="w-full text-left btn-press"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                        <Icon name={getCategoryIcon(p.category)} size={18} className="text-on-surface-dim" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{p.name}</p>
                        {meta && <p className="text-xs text-on-surface-faint mt-0.5 truncate">{meta}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.reservedCents !== null ? (
                        <p className="text-sm font-extrabold tabular text-primary">
                          {formatMoney(remaining, currency)}
                        </p>
                      ) : (
                        <p className="text-[11px] font-semibold text-on-surface-faint">
                          {t('planned.tracking_badge')}
                        </p>
                      )}
                      <Icon
                        name={expanded ? 'expand_less' : 'expand_more'}
                        size={18}
                        className="text-on-surface-faint"
                      />
                    </div>
                  </div>
                  {progress.spentCents > 0 && (
                    <>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden mt-3"
                        style={{ background: 'var(--surface-container-high)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progress.percent}%`, background: 'var(--primary)' }}
                        />
                      </div>
                      <p className="text-xs text-on-surface-faint mt-1.5">
                        {t('planned.spent_of', {
                          spent: formatMoney(progress.spentCents, currency),
                          estimated: formatMoney(p.estimatedCostCents, currency),
                        })}
                      </p>
                    </>
                  )}
                </button>

                {expanded && (
                  <div
                    className="mt-4 pt-4 flex flex-col gap-4"
                    style={{ borderTop: '1px solid var(--surface-container-high)' }}
                  >
                    {p.reservedCents !== null && (
                      <div>
                        <p className="text-xs font-semibold text-on-surface-dim mb-2">
                          {t('planned.breakdown_heading')}
                        </p>
                        <BreakdownRows
                          items={[
                            { label: t('planned.bd_estimated'), cents: p.estimatedCostCents, kind: 'base' },
                            { label: t('planned.bd_spent'), cents: progress.spentCents, kind: 'subtract' },
                          ]}
                          totalLabel={t('planned.bd_remaining')}
                          totalCents={remaining}
                          currency={currency}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => openBuy(p)}
                      className="w-full py-2.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-2"
                      data-help-anchor="planned-buy"
                    >
                      <Icon name="shopping_cart_checkout" size={18} className="text-on-surface" />
                      {t('planned.bought')}
                    </button>

                    {/* B9: attribute an expense already recorded before the plan */}
                    <button
                      onClick={() => setLinkTarget(p)}
                      className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2"
                    >
                      <Icon name="link" size={18} className="text-on-surface-dim" />
                      {t('planned.link_existing')}
                    </button>

                    <div>
                      <p className="text-xs font-semibold text-on-surface-dim mb-2">{t('planned.edit_title')}</p>
                      <PurchaseForm
                        initial={valuesFromPurchase(p)}
                        pools={poolsForForm}
                        currency={currency}
                        submitLabel={t('common.save')}
                        onSubmit={(v) => handleSaveEdit(p, v)}
                        onCancel={() => setExpandedId(null)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCancel(p)}
                        className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim font-medium text-xs btn-press"
                      >
                        {t('planned.cancel_purchase')}
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-2 btn-press rounded-lg bg-error/10"
                        aria-label={t('planned.delete')}
                      >
                        <Icon name="delete" size={16} className="text-error" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add panel / trigger */}
      {showForm ? (
        <div className="bg-surface-container rounded-xl p-4">
          <PurchaseForm
            initial={emptyFormValues(poolsForForm)}
            pools={poolsForForm}
            currency={currency}
            submitLabel={t('common.add')}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        plannedPurchases.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
            style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            data-help-anchor="planned-add"
          >
            <Icon name="add" size={18} className="text-primary" />
            {t('planned.add')}
          </button>
        )
      )}

      {/* Done bucket (bought / cancelled) — collapsed by default */}
      {donePurchases.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((prev) => !prev)}
            className="w-full flex items-center gap-2 px-1 py-2 btn-press"
          >
            <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider">
              {t('planned.section_done')} · {donePurchases.length}
            </p>
            <Icon
              name={showDone ? 'expand_less' : 'expand_more'}
              size={16}
              className="text-on-surface-faint ml-auto"
            />
          </button>
          {showDone && (
            <div className="flex flex-col gap-2">
              {donePurchases.map((p) => (
                <div
                  key={p.id}
                  className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <Icon
                    name={p.status === 'bought' ? 'check_circle' : 'cancel'}
                    size={18}
                    className={p.status === 'bought' ? 'text-success' : 'text-on-surface-faint'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                    <p className="text-[11px] text-on-surface-faint">
                      {p.status === 'bought' ? t('planned.status_bought') : t('planned.status_cancelled')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReopen(p)}
                    className="text-xs font-semibold text-primary btn-press px-2 py-1"
                  >
                    {t('planned.reopen')}
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 btn-press"
                    aria-label={t('planned.delete')}
                  >
                    <Icon name="delete" size={16} className="text-error" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* "Comprei" sheet */}
      <BottomSheet
        open={buyTarget !== null}
        onClose={() => setBuyTarget(null)}
        title={buyTarget ? t('planned.buy_sheet_title', { name: buyTarget.name }) : ''}
      >
        {buyTarget && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('planned.buy_amount')}</label>
              <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
                <span className="text-on-surface-dim text-sm">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0,00"
                  className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBuyClose((prev) => !prev)}
              className="flex items-center gap-3 bg-surface-high rounded-lg px-3 py-2.5 btn-press text-left"
            >
              <div
                className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                  buyClose ? 'bg-primary justify-end' : 'bg-surface-container justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-on-surface">{t('planned.buy_close_label')}</p>
                <p className="text-[10px] text-on-surface-faint mt-0.5">{t('planned.buy_close_hint')}</p>
              </div>
            </button>

            <button
              onClick={handleConfirmBuy}
              className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
            >
              {t('planned.buy_confirm')}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* B9: pick an existing expense to attribute to this planned purchase */}
      <BottomSheet
        open={linkTarget !== null}
        onClose={() => setLinkTarget(null)}
        title={linkTarget ? t('planned.link_sheet_title', { name: linkTarget.name }) : ''}
      >
        {linkTarget && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-on-surface-faint leading-relaxed mb-1">
              {t('planned.link_sheet_hint')}
            </p>
            {linkCandidates.length === 0 ? (
              <p className="text-sm text-on-surface-dim py-6 text-center">
                {t('planned.link_empty')}
              </p>
            ) : (
              linkCandidates.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => handleLinkExisting(tx)}
                  className="w-full text-left bg-surface-high rounded-lg px-3 py-2.5 btn-press flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                      <Icon
                        name={getCategoryIcon(tx.category ?? 'other')}
                        size={16}
                        className="text-on-surface-dim"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {tx.description || (t(`categories.${tx.category}` as never) as string)}
                      </p>
                      <p className="text-[11px] text-on-surface-faint mt-0.5">
                        {formatPickerDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold tabular text-on-surface shrink-0">
                    {formatMoney(tx.amountCents, tx.currency)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
