import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { calculateOwnerPersonalCost, scaleSharesToTotal } from '@/domain/splitting';
import { formatMoney, fromCents, toCents, formatAnchorHint } from '@/domain/money';
import { formatDate, localDayOf, localClockTime, moveToLocalDay } from '@/domain/dates';
import { transactionRepository, participantShareRepository } from '@/data/repositories';
import { softDeleteTransactionsBatch, restoreTransactionsBatch } from '@/domain/orchestrators';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';

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
  const { trip, pools, wallets, participants, settings, loading, reload } = useAppData();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [shares, setShares] = useState<ParticipantShare[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('other');
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  // M5: the place is editable as free text (rename or clear).
  const [editPlace, setEditPlace] = useState('');

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
    setEditPlace(tx.placeLabel ?? '');
    setEditing(true);
  };

  // M5: rename keeps coordinates; clearing the name drops the whole place; a
  // changed name drops the provider id (it no longer matches that POI).
  const resolveEditedPlaceFields = () => {
    const trimmed = editPlace.trim();
    if (trimmed === '') {
      return { placeLabel: null, latitude: null, longitude: null, placeId: null };
    }
    return {
      placeLabel: trimmed,
      latitude: tx!.latitude,
      longitude: tx!.longitude,
      placeId: trimmed === (tx!.placeLabel ?? '') ? tx!.placeId : null,
    };
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
        baseCurrencyAmountCents: newAmountCents,
        personalCostCents: newPersonalCost,
        description: editDescription.trim() || tx.description,
        category: editCategory,
        budgetPoolId: editPoolId,
        walletId: editWalletId,
        date: newDate,
        ...resolveEditedPlaceFields(),
      });
      setTx(updated);
      setShares(newShares);
      setEditing(false);
      await reload();
    } finally {
      setSaving(false);
    }
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

          {/* M5: edit or clear the place (leave empty to remove the location). */}
          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.location_label')}</label>
            <input
              type="text"
              value={editPlace}
              onChange={(e) => setEditPlace(e.target.value)}
              placeholder={t('expenses.location_name_placeholder')}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
            />
          </div>

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
