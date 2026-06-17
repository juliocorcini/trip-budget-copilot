import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { calculateOwnerPersonalCost, scaleSharesToTotal } from '@/domain/splitting';
import { formatMoney, fromCents, toCents, formatAnchorHint, convertToBaseCents } from '@/domain/money';
import { formatDate, localDayOf, localClockTime, moveToLocalDay } from '@/domain/dates';
import { transactionRepository, participantShareRepository } from '@/data/repositories';
import {
  softDeleteTransactionsBatch,
  restoreTransactionsBatch,
  linkExistingExpenseToPlannedPurchase,
  undoLinkExistingExpense,
} from '@/domain/orchestrators';
import {
  compatiblePlannedPurchasesForExpense,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { AttachmentSection } from '@/features/attachments/AttachmentSection';
import { PlaceField } from '@/features/location/PlaceField';
import { placeToTransactionFields } from '@/domain/location';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { CurrentPlace } from '@/domain/types/common';

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

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { trip, pools, wallets, participants, transactions, plannedPurchases, settings, loading, reload } =
    useAppData();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [shares, setShares] = useState<ParticipantShare[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // D-IMP-03: link this already-recorded expense to a planned purchase, from the
  // expense side (the reverse of the picker on the Planned Purchases screen).
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('other');
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  // D-BUG-08: the place is edited with the shared <PlaceField> (rename, use my
  // location, nearby, find online, recents) instead of a bare text input.
  const [editPlace, setEditPlace] = useState<CurrentPlace | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const found = await transactionRepository.getById(id);
      const txShares = found ? await participantShareRepository.getByTransactionId(found.id) : [];
      if (cancelled) return;
      setTx(found ?? null);
      setShares(txShares);
      setTxLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || txLoading) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  if (!trip || !tx) {
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">{t('expenses.detail_title')}</h1>
        </div>
        <p className="text-sm text-on-surface-dim text-center py-8">{t('expenses.not_found')}</p>
      </div>
    );
  }

  const pool = pools.find((p) => p.id === tx.budgetPoolId) ?? null;
  const wallet = wallets.find((w) => w.id === tx.walletId) ?? null;
  // D-IMP-03: a single expense is attributed to at most one planned purchase.
  // The link lives on the purchase (`linkedTransactionIds`), so we resolve both
  // the current link and the compatible (same-fund, open, not-yet-linked here)
  // candidates from the expense side. Income is never a planned-purchase buy.
  const linkedPurchase =
    tx.type === 'expense'
      ? (plannedPurchases.find((p) => p.linkedTransactionIds.includes(tx.id)) ?? null)
      : null;
  const linkCandidates = linkedPurchase
    ? []
    : compatiblePlannedPurchasesForExpense(tx, plannedPurchases);
  const participantById = new Map(participants.map((p) => [p.id, p]));
  const payer = tx.paidByParticipantId ? participantById.get(tx.paidByParticipantId) : null;
  const owner = participants.find((p) => p.isOwner) ?? null;

  // DEC-128: mental anchor under the amount ("≈ R$ 124").
  const anchorHint = settings
    ? formatAnchorHint(
        tx.amountCents,
        { anchorCurrency: settings.anchorCurrency, anchorRatePer1: settings.anchorRatePer1 },
        tx.currency,
      )
    : null;

  const startEdit = () => {
    setEditAmount(fromCents(tx.amountCents).toFixed(2));
    setEditDescription(tx.description);
    setEditCategory(tx.category ?? 'other');
    setEditPoolId(tx.budgetPoolId);
    setEditWalletId(tx.walletId);
    setEditDate(localDayOf(tx.date));
    setEditPlace(
      tx.placeLabel
        ? { label: tx.placeLabel, lat: tx.latitude, lng: tx.longitude, placeId: tx.placeId }
        : null,
    );
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    const parsed = parseFloat(editAmount.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    try {
      const newAmountCents = toCents(parsed);
      // BUG-001 (R6-01): keep the local wall-clock time on the chosen local day.
      const newDate = moveToLocalDay(tx.date, editDate);
      let newPersonalCost = tx.personalCostCents;
      let newShares = shares;

      if (tx.isShared && shares.length > 0 && newAmountCents !== tx.amountCents) {
        newShares = scaleSharesToTotal(shares, newAmountCents);
        await Promise.all(newShares.map((s) => participantShareRepository.update(s)));
        // BUG-004 (R6-04, DEC-071): rejected shares return to the payer —
        // the owner's cost is NOT simply their own share.
        newPersonalCost = owner
          ? calculateOwnerPersonalCost({ ...tx, amountCents: newAmountCents }, newShares, owner.id)
          : null;
      } else if (!tx.isShared) {
        newPersonalCost = newAmountCents;
      }

      const updated = await transactionRepository.update({
        ...tx,
        amountCents: newAmountCents,
        // E9 (M9): re-derive the base value with the frozen rate (foreign), else
        // it equals the amount (same-currency). The currency/rate stay fixed.
        baseCurrencyAmountCents:
          tx.exchangeRate !== null
            ? convertToBaseCents(newAmountCents, tx.exchangeRate)
            : newAmountCents,
        personalCostCents: newPersonalCost,
        description: editDescription.trim() || tx.description,
        category: editCategory,
        budgetPoolId: editPoolId,
        walletId: editWalletId,
        date: newDate,
        ...placeToTransactionFields(editPlace),
      });
      setTx(updated);
      setShares(newShares);
      setEditing(false);
      // Editing used to close silently — confirm the change like every other
      // mutation (the success toast carries the haptic, N8).
      showToast(t('expenses.edited_toast'), 'success');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  // D-IMP-03: attribute THIS expense to a planned purchase — reuses the exact
  // orchestrator the Planned screen uses (no new transaction, reserve shrinks
  // once). Undo restores the pre-link purchase snapshot.
  const handleLinkToPlanned = async (purchase: PlannedPurchase) => {
    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    setLinkPickerOpen(false);
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

  // DEC-126: single delete goes through the same batch orchestrator (shares
  // cascade included) so the undo toast can restore the exact previous state
  // even after navigating back to the list.
  const handleDelete = async () => {
    await softDeleteTransactionsBatch([tx.id]);
    setShowDeleteConfirm(false);
    await reload();
    navigate('/expenses', { replace: true });
    showToast(t('expenses.deleted_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 8000,
      onTap: () => {
        void restoreTransactionsBatch([tx.id]).then(() => {
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
        <h1 className="text-heading font-bold text-on-surface">{t('expenses.detail_title')}</h1>
      </div>

      {!editing ? (
        <>
          <div className="bg-surface-container rounded-2xl p-5 text-center">
            <div
              className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2"
              style={{ background: '#C75B3918' }}
            >
              <Icon name={getCategoryIcon(tx.category)} size={24} className="text-primary" />
            </div>
            <p className="text-[32px] font-extrabold tabular text-on-surface leading-none">
              {formatMoney(tx.amountCents, tx.currency)}
            </p>
            {/* E9 (M9): foreign expense — show the frozen base-currency equivalent. */}
            {tx.exchangeRate !== null && tx.currency !== trip.baseCurrency && (
              <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">
                ≈ {formatMoney(tx.baseCurrencyAmountCents, trip.baseCurrency)}
              </p>
            )}
            {/* DEC-128: mental anchor under the amount ("≈ R$ 124") */}
            {anchorHint && (
              <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">{anchorHint}</p>
            )}
            <p className="text-sm text-on-surface-dim mt-2">{tx.description}</p>
          </div>

          <div className="bg-surface-container rounded-xl divide-y divide-on-surface-mute">
            <DetailRow
              label={t('expenses.category')}
              value={tx.category ? t(`categories.${tx.category}` as never) : '—'}
            />
            <DetailRow label={t('expenses.date')} value={formatDate(localDayOf(tx.date))} />
            {/* M5: local wall-clock time + place (place row only when present). */}
            <DetailRow label={t('expenses.time')} value={localClockTime(tx.date)} />
            {tx.placeLabel && <DetailRow label={t('expenses.location_label')} value={tx.placeLabel} />}
            <DetailRow label={t('expenses.fund')} value={pool?.name ?? '—'} />
            <DetailRow
              label={t('expenses.wallet')}
              value={wallet?.name ?? t('expenses.wallet_not_set')}
              warning={!wallet}
            />
            {tx.isShared && (
              <>
                <DetailRow
                  label={t('expenses.financial_flow')}
                  value={formatMoney(tx.amountCents, tx.currency)}
                />
                <DetailRow
                  label={t('expenses.personal_cost')}
                  value={formatMoney(tx.personalCostCents ?? tx.amountCents, tx.currency)}
                />
              </>
            )}
          </div>

          {tx.isShared && shares.length > 0 && (
            <div>
              <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
                {t('expenses.shared_with')}
              </p>
              <div className="bg-surface-container rounded-xl divide-y divide-on-surface-mute">
                {shares.map((share) => {
                  const participant = participantById.get(share.participantId);
                  const isPayer = share.participantId === tx.paidByParticipantId;
                  return (
                    <div key={share.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="person" size={18} className="text-on-surface-dim" />
                        <span className="text-sm text-on-surface">
                          {participant?.isOwner
                            ? t('shared.owner_tag')
                            : (participant?.nickname ?? participant?.name ?? '—')}
                        </span>
                        {isPayer && payer && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-success/15 text-success">
                            {t('expenses.paid_by', {
                              name: payer.isOwner ? t('shared.owner_tag') : payer.name,
                            })}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold tabular text-on-surface">
                        {formatMoney(share.shareAmountCents, tx.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tx.notes && (
            <div className="bg-surface-container rounded-xl p-4">
              <p className="text-xs text-on-surface-faint mb-1">{t('expenses.description')}</p>
              <p className="text-sm text-on-surface">{tx.notes}</p>
            </div>
          )}

          {/* DEC-206 (G1): attach receipt/proof photos to this expense. */}
          <AttachmentSection transactionId={tx.id} />

          {/* D-IMP-03: planned-purchase link from the expense side. */}
          {linkedPurchase ? (
            <button
              onClick={() => navigate('/planned')}
              className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
            >
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="link" size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-on-surface-faint">{t('expenses.linked_planned_label')}</p>
                <p className="text-sm font-semibold text-on-surface truncate">{linkedPurchase.name}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          ) : (
            linkCandidates.length > 0 && (
              <button
                onClick={() => setLinkPickerOpen(true)}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2"
              >
                <Icon name="link" size={18} className="text-on-surface-dim" />
                {t('expenses.link_planned')}
              </button>
            )
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 py-3 rounded-xl font-medium btn-press"
              style={{ background: '#D9404015', color: 'var(--error)' }}
            >
              {t('common.delete')}
            </button>
            <button
              onClick={startEdit}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press"
            >
              {t('common.edit')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-surface-container rounded-2xl p-5">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.amount')}</label>
            <div className="flex items-baseline gap-1">
              <span className="text-on-surface-dim text-lg">{tx.currency}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
                autoFocus
              />
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.description')}</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="bg-transparent text-sm text-on-surface outline-none w-full"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.category')}</label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setEditCategory(key)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                    editCategory === key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
                  }`}
                >
                  <Icon
                    name={getCategoryIcon(key)}
                    size={20}
                    className={editCategory === key ? 'text-primary' : 'text-on-surface-dim'}
                  />
                  {/* R-03: long labels wrap with hyphenation instead of overflowing. */}
                  <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                    {t(`categories.${key}` as never)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date')}</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
            />
          </div>

          {/* D-BUG-08: full place apparatus on edit (use my location, nearby,
              find online, recents) — gated GPS/online features by the setting. */}
          <PlaceField
            value={editPlace}
            onChange={setEditPlace}
            category={editCategory}
            transactions={transactions}
            autoCapture={false}
            locationFeaturesEnabled={!!settings?.locationCaptureEnabled}
          />

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
            <div className="flex gap-2 flex-wrap">
              {pools.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditPoolId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    editPoolId === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.wallet')}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditWalletId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                  editWalletId === null
                    ? 'bg-warning/20 text-warning ring-1 ring-warning'
                    : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('expenses.wallet_not_set')}
              </button>
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setEditWalletId(w.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    editWalletId === w.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </>
      )}

      {/* D-IMP-03: pick a compatible planned purchase for this expense. */}
      <BottomSheet
        open={linkPickerOpen}
        onClose={() => setLinkPickerOpen(false)}
        title={t('expenses.link_planned_sheet_title')}
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-on-surface-faint leading-relaxed mb-1">
            {t('expenses.link_planned_hint')}
          </p>
          {linkCandidates.length === 0 ? (
            <p className="text-sm text-on-surface-dim py-6 text-center">
              {t('expenses.link_planned_empty')}
            </p>
          ) : (
            linkCandidates.map((p) => {
              const remaining = plannedPurchaseReservedRemainingCents(p, transactions);
              return (
                <button
                  key={p.id}
                  onClick={() => handleLinkToPlanned(p)}
                  className="w-full text-left bg-surface-high rounded-lg px-3 py-2.5 btn-press flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                      <Icon name={getCategoryIcon(p.category)} size={16} className="text-on-surface-dim" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                      {p.store && (
                        <p className="text-[11px] text-on-surface-faint mt-0.5 truncate">{p.store}</p>
                      )}
                    </div>
                  </div>
                  {p.reservedCents !== null ? (
                    <p className="text-sm font-bold tabular text-primary shrink-0">
                      {formatMoney(remaining, trip.baseCurrency)}
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-on-surface-faint shrink-0">
                      {t('planned.tracking_badge')}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </BottomSheet>

      {/* GAP-025: design-system confirmation instead of window.confirm */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('expenses.delete_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">{t('expenses.delete_confirm')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm btn-press"
              style={{ background: '#D9404015', color: 'var(--error)', border: '1px solid #D9404040' }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-on-surface-faint">{label}</span>
      <span className={`text-sm font-medium ${warning ? 'text-warning' : 'text-on-surface'}`}>
        {value}
      </span>
    </div>
  );
}
